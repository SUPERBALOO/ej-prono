import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const now = new Date().toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("odds_locked", false);

  let locked = 0;

  for (const match of matches || []) {
    if (match.match_date <= now) {
      await supabase
        .from("matches")
        .update({
          odds_locked: true,
        })
        .eq("id", match.id);

      locked++;
    }
  }

  return NextResponse.json({
    success: true,
    locked,
  });
}