import { createClient } from "@supabase/supabase-js";
import webPush, {
  type PushSubscription,
  type WebPushError,
} from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type NewsNotificationResult = {
  sent: number;
  reason: "initialized" | "unchanged" | "notified";
};

export async function sendLeMansNewsNotifications(
  origin: string
): Promise<NewsNotificationResult> {
  const newsResponse = await fetch(
    new URL("/api/le-mans-news", origin),
    { cache: "no-store" }
  );

  if (!newsResponse.ok) {
    throw new Error(
      `Actualites Le Mans FC indisponibles (${newsResponse.status})`
    );
  }

  const { news } = await newsResponse.json();
  const latest = news?.[0];

  if (!latest?.url) {
    throw new Error("Aucune actualite Le Mans FC trouvee");
  }

  const { data: state, error: stateError } = await supabase
    .from("news_notification_state")
    .select("last_article_url")
    .eq("source", "le-mans-fc")
    .maybeSingle();

  if (stateError) {
    throw stateError;
  }

  if (!state) {
    const { error } = await supabase
      .from("news_notification_state")
      .upsert({
        source: "le-mans-fc",
        last_article_url: latest.url,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return { sent: 0, reason: "initialized" };
  }

  if (state.last_article_url === latest.url) {
    return { sent: 0, reason: "unchanged" };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("Variables VAPID manquantes");
  }

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT ||
      "mailto:contact@ej-prono.app",
    publicKey,
    privateKey
  );

  const { data: subscriptions, error: subscriptionsError } =
    await supabase
      .from("push_subscriptions")
      .select("endpoint,subscription")
      .eq("enabled", true)
      .eq("news_enabled", true);

  if (subscriptionsError) {
    throw subscriptionsError;
  }

  let sent = 0;

  for (const row of subscriptions || []) {
    try {
      await webPush.sendNotification(
        row.subscription as PushSubscription,
        JSON.stringify({
          title: "Nouvelle actu Le Mans FC",
          body: latest.title,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          url: latest.url,
        })
      );
      sent++;
    } catch (error: unknown) {
      const pushError = error as WebPushError;

      if (
        pushError.statusCode === 404 ||
        pushError.statusCode === 410
      ) {
        await supabase
          .from("push_subscriptions")
          .update({
            enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("endpoint", row.endpoint);
      } else {
        console.error(
          "Notification actu impossible",
          pushError
        );
      }
    }
  }

  const { error: updateError } = await supabase
    .from("news_notification_state")
    .upsert({
      source: "le-mans-fc",
      last_article_url: latest.url,
      updated_at: new Date().toISOString(),
    });

  if (updateError) {
    throw updateError;
  }

  return { sent, reason: "notified" };
}
