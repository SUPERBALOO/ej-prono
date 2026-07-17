import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildRankingsMap,
  buildTeamStrengthMap,
  getClubMatchOddsUpdate,
  getMatchOddsUpdate,
} from "@/lib/odds";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildFallbackClubStrengths(matches: any[]) {
  const teamNames = Array.from(
    new Set(
      matches.flatMap((match) =>
        [match.home_team, match.away_team].filter(Boolean)
      )
    )
  ).sort((a, b) => String(a).localeCompare(String(b)));

  return buildTeamStrengthMap(
    teamNames.map((teamName, index) => ({
      team_name: teamName,
      previous_rank: index + 1,
      strength_points: 1500,
      home_bonus_points: 60,
    }))
  );
}

async function recalculateMissingContestOdds(
  concoursId: string
) {
  const { data: concours, error: concoursError } =
    await supabase
      .from("concours")
      .select("id,competition_id")
      .eq("id", concoursId)
      .single();

  if (concoursError || !concours?.competition_id) {
    throw new Error("Concours introuvable");
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", concours.competition_id)
    .single();

  if (!competition) {
    throw new Error("Competition introuvable");
  }

  const { data: matches, error: matchesError } =
    await supabase
      .from("matches")
      .select("*")
      .eq("concours_id", concoursId)
      .order("match_date", { ascending: true });

  if (matchesError) {
    throw matchesError;
  }

  const matchesToUpdate = (matches || []).filter(
    (match: any) =>
      match.cote_home == null ||
      match.cote_draw == null ||
      match.cote_away == null
  );

  if (!matchesToUpdate.length) {
    return {
      success: true,
      updated: 0,
      skipped: 0,
      message: "Aucune cote manquante",
    };
  }

  const apiProvider =
    competition?.api_provider || "football-data";

  let oddsByMatch = new Map<string, any>();

  if (apiProvider === "api-football") {
    let rankingsQuery = supabase
      .from("competition_team_rankings")
      .select(
        "team_name,previous_rank,strength_points,home_bonus_points"
      )
      .eq("competition_id", competition.id)
      .eq("active", true);

    if (competition.api_season) {
      rankingsQuery = rankingsQuery.eq(
        "season",
        competition.api_season
      );
    }

    const { data: teamRankings } = await rankingsQuery;

    let strengthsMap = buildTeamStrengthMap(
      teamRankings || []
    );

    if (!strengthsMap.size) {
      strengthsMap =
        buildFallbackClubStrengths(matches || []);
    }

    for (const match of matchesToUpdate) {
      const oddsUpdate = getClubMatchOddsUpdate(
        match,
        strengthsMap
      );

      if (oddsUpdate) {
        oddsByMatch.set(match.id, oddsUpdate);
      }
    }
  } else {
    const { data: rankings } = await supabase
      .from("fifa_rankings")
      .select("team_name,fifa_rank,fifa_points");

    const rankingsMap = buildRankingsMap(rankings || []);

    for (const match of matchesToUpdate) {
      const oddsUpdate = getMatchOddsUpdate(
        match,
        rankingsMap
      );

      if (oddsUpdate) {
        oddsByMatch.set(match.id, oddsUpdate);
      }
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const match of matchesToUpdate) {
    const oddsUpdate = oddsByMatch.get(match.id);

    if (!oddsUpdate) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from("matches")
      .update(oddsUpdate)
      .eq("id", match.id);

    if (error) {
      skipped++;
    } else {
      updated++;
    }
  }

  return {
    success: true,
    updated,
    skipped,
  };
}

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
    const { matchId, concoursId } = await req.json();

    if (concoursId && !matchId) {
      const result =
        await recalculateMissingContestOdds(concoursId);

      return NextResponse.json(result);
    }

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
