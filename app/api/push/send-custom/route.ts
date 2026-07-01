import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webPush, {
  type PushSubscription,
  type WebPushError,
} from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function configureWebPush() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ||
    "mailto:contact@ej-prono.app";

  if (!publicKey || !privateKey) {
    throw new Error("Variables VAPID manquantes");
  }

  webPush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue";
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Session invalide" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "Action reservee aux administrateurs" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const url = String(body.url || "/dashboard").trim();

    if (!title || !message) {
      return NextResponse.json(
        { error: "Titre et message requis" },
        { status: 400 }
      );
    }

    configureWebPush();

    const { data: subscriptions, error } =
      await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("enabled", true);

    if (error) {
      throw error;
    }

    let sent = 0;

    for (const row of subscriptions || []) {
      try {
        await webPush.sendNotification(
          row.subscription as PushSubscription,
          JSON.stringify({
            title,
            body: message,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            url,
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
          console.error(pushError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      subscriptionsChecked: subscriptions?.length || 0,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error(error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
