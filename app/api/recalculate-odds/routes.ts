import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { matchId } = await req.json();

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (!match) {
      throw new Error("Match introuvable");
    }

    const { data: predictions } =
      await supabase
        .from("predictions")
        .select("*")
        .eq("match_id", matchId);

    let homeBets = 0;
    let drawBets = 0;
    let awayBets = 0;

    for (const p of predictions || []) {
      if (p.pred_home > p.pred_away) homeBets++;
      else if (p.pred_home < p.pred_away) awayBets++;
      else drawBets++;
    }

    const total =
      homeBets + drawBets + awayBets;

    if (total < 2) {
      return NextResponse.json({
        success: true,
        message:
          "Pas assez de paris pour ajuster les cotes",
      });
    }

    const playerHome = homeBets / total;
    const playerDraw = drawBets / total;
    const playerAway = awayBets / total;

    const fifaHome =
      match.home_probability;

    const fifaDraw =
      match.draw_probability;

    const fifaAway =
      match.away_probability;

    const PLAYER_PRIOR_SIZE = 40;
    const MAX_PLAYER_WEIGHT = 0.25;
    const playerWeight = Math.min(
      MAX_PLAYER_WEIGHT,
      total / (total + PLAYER_PRIOR_SIZE)
    );

    const newHome =
        fifaHome * (1 - playerWeight) +
        playerHome * playerWeight;

    const newDraw =
        fifaDraw * (1 - playerWeight) +
        playerDraw * playerWeight;

    const newAway =
        fifaAway * (1 - playerWeight) +
        playerAway * playerWeight;

    await supabase
      .from("matches")
      .update({
        cote_home: Number(
          (1 / newHome).toFixed(2)
        ),

        cote_draw: Number(
          (1 / newDraw).toFixed(2)
        ),

        cote_away: Number(
          (1 / newAway).toFixed(2)
        ),
      })
      .eq("id", matchId);

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
