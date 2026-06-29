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

    if (!fifaHome || !fifaDraw || !fifaAway) {
      return NextResponse.json({
        success: true,
        message:
          "Probabilités FIFA manquantes, cotes conservées",
      });
    }

    const PLAYER_WEIGHT = 0.50;

    const newHome =
      fifaHome * (1 - PLAYER_WEIGHT) +
      playerHome * PLAYER_WEIGHT;

    const newDraw =
      fifaDraw * (1 - PLAYER_WEIGHT) +
      playerDraw * PLAYER_WEIGHT;

    const newAway =
      fifaAway * (1 - PLAYER_WEIGHT) +
      playerAway * PLAYER_WEIGHT;

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
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
