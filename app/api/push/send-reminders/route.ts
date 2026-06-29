import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";
import webPush, {
  type PushSubscription,
  type WebPushError,
} from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REMINDER_WINDOW_HOURS = Number(
  process.env.PUSH_REMINDER_WINDOW_HOURS || 24
);

const REMINDER_TYPE = `${REMINDER_WINDOW_HOURS}h`;

function configureWebPush() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const privateKey =
    process.env.VAPID_PRIVATE_KEY;

  const subject =
    process.env.VAPID_SUBJECT ||
    "mailto:contact@ej-prono.app";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Variables VAPID manquantes"
    );
  }

  webPush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret =
      process.env.CRON_SECRET;

    if (
      cronSecret &&
      req.headers.get("authorization") !==
        `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    configureWebPush();

    const now = new Date();
    const reminderLimit = new Date(
      now.getTime() +
        REMINDER_WINDOW_HOURS *
          60 *
          60 *
          1000
    );

    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select("*")
        .neq("status", "finished")
        .gte("match_date", now.toISOString())
        .lte(
          "match_date",
          reminderLimit.toISOString()
        );

    if (matchesError) {
      throw matchesError;
    }

    let remindersSent = 0;
    let usersChecked = 0;

    for (const match of matches || []) {
      const {
        data: participants,
        error: participantsError,
      } = await supabase
        .from("participants_concours")
        .select("joueur_id")
        .eq("concours_id", match.concours_id);

      if (participantsError) {
        throw participantsError;
      }

      const userIds =
        participants?.map(
          (participant: any) =>
            participant.joueur_id
        ) || [];

      usersChecked += userIds.length;

      if (!userIds.length) {
        continue;
      }

      const {
        data: predictions,
        error: predictionsError,
      } = await supabase
        .from("predictions")
        .select("user_id")
        .eq("match_id", match.id)
        .in("user_id", userIds);

      if (predictionsError) {
        throw predictionsError;
      }

      const predictedUserIds = new Set(
        (predictions || []).map(
          (prediction: any) =>
            prediction.user_id
        )
      );

      const missingUserIds = userIds.filter(
        (userId: string) =>
          !predictedUserIds.has(userId)
      );

      if (!missingUserIds.length) {
        continue;
      }

      const {
        data: existingLogs,
        error: logsError,
      } = await supabase
        .from("push_reminder_logs")
        .select("user_id")
        .eq("match_id", match.id)
        .eq("reminder_type", REMINDER_TYPE)
        .in("user_id", missingUserIds);

      if (logsError) {
        throw logsError;
      }

      const alreadyReminded = new Set(
        (existingLogs || []).map(
          (log: any) => log.user_id
        )
      );

      const usersToNotify =
        missingUserIds.filter(
          (userId: string) =>
            !alreadyReminded.has(userId)
        );

      if (!usersToNotify.length) {
        continue;
      }

      const {
        data: subscriptions,
        error: subscriptionsError,
      } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("enabled", true)
        .in("user_id", usersToNotify);

      if (subscriptionsError) {
        throw subscriptionsError;
      }

      const subscriptionsByUser =
        new Map<string, any[]>();

      for (const subscription of subscriptions || []) {
        const current =
          subscriptionsByUser.get(
            subscription.user_id
          ) || [];

        current.push(subscription);
        subscriptionsByUser.set(
          subscription.user_id,
          current
        );
      }

      for (const userId of usersToNotify) {
        const userSubscriptions =
          subscriptionsByUser.get(userId) || [];

        if (!userSubscriptions.length) {
          continue;
        }

        let sentForUser = false;

        for (const row of userSubscriptions) {
          try {
            await webPush.sendNotification(
              row.subscription as PushSubscription,
              JSON.stringify({
                title: "EJ Prono - rappel",
                body: `Tu as encore un prono a faire : ${match.home_team} vs ${match.away_team}.`,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                url: `/concours/${match.concours_id}?tab=pronostics`,
              })
            );

            sentForUser = true;
          } catch (error: unknown) {
            const pushError =
              error as WebPushError;

            if (
              pushError.statusCode === 404 ||
              pushError.statusCode === 410
            ) {
              await supabase
                .from("push_subscriptions")
                .update({
                  enabled: false,
                  updated_at:
                    new Date().toISOString(),
                })
                .eq("endpoint", row.endpoint);
            } else {
              console.error(pushError);
            }
          }
        }

        if (sentForUser) {
          remindersSent++;

          await supabase
            .from("push_reminder_logs")
            .upsert(
              {
                user_id: userId,
                match_id: match.id,
                reminder_type: REMINDER_TYPE,
                sent_at:
                  new Date().toISOString(),
              },
              {
                onConflict:
                  "user_id,match_id,reminder_type",
              }
            );
        }
      }
    }

    return NextResponse.json({
      success: true,
      matchesChecked: matches?.length || 0,
      usersChecked,
      remindersSent,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue";

    console.error(error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
