import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getEquivalentMatchDateWindow(match: any) {
  const matchTime = new Date(match.match_date).getTime();
  const windowMs = 36 * 60 * 60 * 1000;

  return {
    start: new Date(matchTime - windowMs).toISOString(),
    end: new Date(matchTime + windowMs).toISOString(),
  };
}

function normalizeTeamName(team: any) {
  return String(team || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isEquivalentFixture(
  sourceMatch: any,
  candidateMatch: any
) {
  const sourceHome = normalizeTeamName(sourceMatch.home_team);
  const sourceAway = normalizeTeamName(sourceMatch.away_team);
  const candidateHome = normalizeTeamName(
    candidateMatch.home_team
  );
  const candidateAway = normalizeTeamName(
    candidateMatch.away_team
  );

  if (
    sourceHome !== candidateHome ||
    sourceAway !== candidateAway
  ) {
    return false;
  }

  const sourceDate = new Date(sourceMatch.match_date);
  const candidateDate = new Date(candidateMatch.match_date);

  if (
    Number.isNaN(sourceDate.getTime()) ||
    Number.isNaN(candidateDate.getTime())
  ) {
    return false;
  }

  return (
    Math.abs(sourceDate.getTime() - candidateDate.getTime()) <=
    36 * 60 * 60 * 1000
  );
}

async function getMatchesToUpdate(match: any) {
  const matchesById = new Map<string, any>();

  matchesById.set(match.id, match);

  if (match.api_match_id) {
    const { data: linkedMatches, error: linkedMatchesError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("api_match_id", match.api_match_id);

    if (linkedMatchesError) {
      throw linkedMatchesError;
    }

    (linkedMatches || []).forEach((linkedMatch: any) => {
      matchesById.set(linkedMatch.id, linkedMatch);
    });
  }

  const { start, end } = getEquivalentMatchDateWindow(match);

  const { data: sameFixtureMatches, error } = await supabase
    .from("matches")
    .select("*")
    .gte("match_date", start)
    .lte("match_date", end);

  if (error) {
    throw error;
  }

  (sameFixtureMatches || []).forEach((candidate: any) => {
    if (isEquivalentFixture(match, candidate)) {
      matchesById.set(candidate.id, candidate);
    }
  });

  return Array.from(matchesById.values());
}

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

    const matchesToUpdate = await getMatchesToUpdate(match);

    const matchIds = matchesToUpdate.map(
      (linkedMatch: any) => linkedMatch.id
    );

    const { data: predictions } =
      await supabase
        .from("predictions")
        .select("*")
        .in("match_id", matchIds);

    const predictionsByUser = new Map<string, any>();

    for (const prediction of predictions || []) {
      if (!predictionsByUser.has(prediction.user_id)) {
        predictionsByUser.set(
          prediction.user_id,
          prediction
        );
      }
    }

    let homeBets = 0;
    let drawBets = 0;
    let awayBets = 0;

    for (const p of predictionsByUser.values()) {
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

    const newOdds = {
      cote_home: Number(
        (1 / newHome).toFixed(2)
      ),

      cote_draw: Number(
        (1 / newDraw).toFixed(2)
      ),

      cote_away: Number(
        (1 / newAway).toFixed(2)
      ),

      odds_updated_at: new Date().toISOString(),
    };

    await supabase
      .from("matches")
      .update(newOdds)
      .in("id", matchIds);

    return NextResponse.json({
      success: true,
      updated: matchIds.length,
      odds: newOdds,
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
