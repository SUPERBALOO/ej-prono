import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      user_id,
      match_id,
      pred_home,
      pred_away,
    } = await req.json();

    const { data: match, error: matchError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("id", match_id)
        .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: "Match introuvable" },
        { status: 404 }
      );
    }

    let predictionOdds = match.cote_draw;

    if (pred_home > pred_away) {
      predictionOdds = match.cote_home;
    }

    if (pred_home < pred_away) {
      predictionOdds = match.cote_away;
    }

    const { error } = await supabase
      .from("predictions")
      .upsert(
        {
          user_id,
          match_id,
          pred_home,
          pred_away,

          prediction_odds: predictionOdds,
          locked_odds: predictionOdds,
        },
        {
          onConflict: "user_id,match_id",
        }
      );
console.log("UPSERT ERROR =", error);
console.log("USER =", user_id);
console.log("MATCH =", match_id);
    if (error) {
      throw error;
    }

await fetch(
  "http://localhost:3000/api/recalculate-odds",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      matchId: match_id,
    }),
  }
);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}