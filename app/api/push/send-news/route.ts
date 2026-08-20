import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webPush, { type PushSubscription } from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !==
      `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const newsResponse = await fetch(
    new URL("/api/le-mans-news", req.url),
    { cache: "no-store" }
  );
  const { news } = await newsResponse.json();
  const latest = news?.[0];

  if (!latest?.url) {
    return NextResponse.json({ success: true, sent: 0, reason: "no-news" });
  }

  const { data: state } = await supabase
    .from("news_notification_state")
    .select("last_article_url")
    .eq("source", "le-mans-fc")
    .maybeSingle();

  if (!state) {
    await supabase.from("news_notification_state").upsert({
      source: "le-mans-fc",
      last_article_url: latest.url,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, sent: 0, reason: "initialized" });
  }

  if (state.last_article_url === latest.url) {
    return NextResponse.json({ success: true, sent: 0, reason: "unchanged" });
  }

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@ej-prono.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("enabled", true)
    .eq("news_enabled", true);

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
    } catch (error) {
      console.error("Notification actu impossible", error);
    }
  }

  await supabase.from("news_notification_state").upsert({
    source: "le-mans-fc",
    last_article_url: latest.url,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, sent });
}
