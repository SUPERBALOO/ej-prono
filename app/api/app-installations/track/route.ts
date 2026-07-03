import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ success: true });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: true });
    }

    const body = await req.json().catch(() => ({}));
    const platform = String(
      body.platform || "unknown"
    ).slice(0, 50);
    const source = String(
      body.source || "unknown"
    ).slice(0, 50);
    const userAgent = req.headers
      .get("user-agent")
      ?.slice(0, 500);

    const { error } = await supabase
      .from("app_install_events")
      .upsert(
        {
          user_id: user.id,
          platform,
          source,
          user_agent: userAgent || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,platform,source",
        }
      );

    if (error) {
      console.error("app_install_events:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: true });
  }
}
