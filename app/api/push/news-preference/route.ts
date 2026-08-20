import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const token = req.headers
    .get("authorization")
    ?.replace("Bearer ", "");

  if (!token) return null;

  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("news_enabled")
    .eq("user_id", user.id)
    .eq("enabled", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    available: !!data?.length,
    enabled: data?.some((row) => row.news_enabled) || false,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { enabled } = await req.json();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .update({
      news_enabled: enabled === true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("enabled", true)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json(
      { error: "Active d'abord les notifications sur cet appareil." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, enabled: enabled === true });
}
