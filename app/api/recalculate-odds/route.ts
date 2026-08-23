import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  applyPlayerInfluence,
  buildRankingsMap,
  buildTeamStrengthMap,
  getDynamicClubMatchOddsUpdate,
  getMatchOddsUpdate,
} from "@/lib/odds";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchAndStorePreviousClubStandings(
  competition: any
) {
  const leagueId = Number(competition.api_league_id);
  const currentSeason = Number(competition.api_season);
  const previousSeason = currentSeason - 1;

  if (
    !leagueId ||
    !previousSeason ||
    !process.env.API_FOOTBALL_KEY
  ) {
    return [];
  }

  async function fetchLeagueRows(
    targetLeagueId: number,
    rankOffset = 0
  ) {
    const response = await fetch(
      `https://v3.football.api-sports.io/standings?league=${targetLeagueId}&season=${previousSeason}`,
      {
        headers: {
          "x-apisports-key":
            process.env.API_FOOTBALL_KEY!,
        },
        cache: "no-store",
      }
    );
    const result = await response.json();
    const standings =
      result.response?.[0]?.league?.standings?.[0];

    if (!response.ok || !Array.isArray(standings)) {
      return [];
    }

    return standings
      .filter(
        (standing: any) =>
          standing.team?.name && standing.rank
      )
      .map((standing: any) => {
        const previousRank =
          rankOffset + standing.rank;

        return {
          competition_id: competition.id,
          season: currentSeason,
          team_name: standing.team.name,
          previous_rank: previousRank,
          strength_points: Math.max(
            1150,
            1850 - (previousRank - 1) * 35
          ),
          home_bonus_points: 60,
          active: true,
          updated_at: new Date().toISOString(),
        };
      });
  }

  const primaryRows = await fetchLeagueRows(leagueId);
  const promotedTeamRows =
    leagueId === 61
      ? await fetchLeagueRows(62, 18)
      : [];
  const rows = [...primaryRows, ...promotedTeamRows];

  if (rows.length) {
    await supabase
      .from("competition_team_rankings")
      .upsert(rows, {
        onConflict: "competition_id,season,team_name",
      });
  }

  return rows;
}

async function recalculateMissingContestOdds(
  concoursId: string,
  force = false
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

  const matchesToUpdate = force
    ? matches || []
    : (matches || []).filter(
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

    const { data: storedTeamRankings } =
      await rankingsQuery;

    const fetchedTeamRankings =
      await fetchAndStorePreviousClubStandings(
        competition
      );
    const teamRankings = [
      ...fetchedTeamRankings,
      ...(storedTeamRankings || []),
    ];

    const strengthsMap = buildTeamStrengthMap(
      teamRankings || []
    );

    if (!strengthsMap.size) {
      throw new Error(
        "Classement de la saison précédente introuvable. Importez-le avant de recalculer les cotes."
      );
    }

    const { data: relatedContests } = await supabase
      .from("concours")
      .select("id")
      .eq("competition_id", competition.id);
    const relatedContestIds = (relatedContests || []).map(
      (relatedContest: any) => relatedContest.id
    );
    const { data: competitionMatches } = relatedContestIds.length
      ? await supabase
          .from("matches")
          .select(
            "api_match_id,home_team,away_team,match_date,home_score,away_score,status"
          )
          .in("concours_id", relatedContestIds)
          .eq("status", "finished")
      : { data: [] };
    const uniqueCompletedMatches = new Map<string, any>();

    for (const completedMatch of competitionMatches || []) {
      const fixtureKey =
        completedMatch.api_match_id ||
        `${completedMatch.home_team}|${completedMatch.away_team}|${completedMatch.match_date}`;
      uniqueCompletedMatches.set(fixtureKey, completedMatch);
    }

    for (const match of matchesToUpdate) {
      const oddsUpdate = getDynamicClubMatchOddsUpdate(
        match,
        strengthsMap,
        [...uniqueCompletedMatches.values()]
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

  const matchIdsToUpdate = matchesToUpdate.map(
    (match: any) => match.id
  );
  const { data: contestPredictions } = matchIdsToUpdate.length
    ? await supabase
        .from("predictions")
        .select(
          "match_id,user_id,pred_home,pred_away,created_at"
        )
        .in("match_id", matchIdsToUpdate)
    : { data: [] };

  for (const match of matchesToUpdate) {
    const oddsUpdate = oddsByMatch.get(match.id);

    if (!oddsUpdate) {
      skipped++;
      continue;
    }

    const predictionsByUser = new Map<string, any>();
    for (const prediction of contestPredictions || []) {
      if (prediction.match_id !== match.id) continue;

      const existing = predictionsByUser.get(prediction.user_id);
      if (
        !existing ||
        String(prediction.created_at) > String(existing.created_at)
      ) {
        predictionsByUser.set(prediction.user_id, prediction);
      }
    }

    const choices = { home: 0, draw: 0, away: 0 };
    for (const prediction of predictionsByUser.values()) {
      if (prediction.pred_home > prediction.pred_away) choices.home++;
      else if (prediction.pred_home < prediction.pred_away)
        choices.away++;
      else choices.draw++;
    }
    const playerOdds = applyPlayerInfluence(oddsUpdate, choices);
    const finalOddsUpdate = playerOdds
      ? {
          ...oddsUpdate,
          cote_home: playerOdds.cote_home,
          cote_draw: playerOdds.cote_draw,
          cote_away: playerOdds.cote_away,
        }
      : oddsUpdate;

    const { error } = await supabase
      .from("matches")
      .update(finalOddsUpdate)
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
    const { matchId, concoursId, force } = await req.json();

    if (concoursId && !matchId) {
      const result =
        await recalculateMissingContestOdds(
          concoursId,
          force === true
        );

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

    // Les avis joueurs ne doivent pas renverser la cote de
    // référence lorsque l'échantillon est encore très faible.
    // Le poids progresse avec le nombre de participants et reste
    // plafonné à 25 %, même lorsque le concours devient très actif.
    const influencedOdds = applyPlayerInfluence(
      {
        home_probability: fifaHome,
        draw_probability: fifaDraw,
        away_probability: fifaAway,
      },
      { home: homeBets, draw: drawBets, away: awayBets }
    );

    if (!influencedOdds) {
      return NextResponse.json({
        success: true,
        message: "Pas assez de paris pour ajuster les cotes",
      });
    }

    const newOdds = {
      cote_home: influencedOdds.cote_home,
      cote_draw: influencedOdds.cote_draw,
      cote_away: influencedOdds.cote_away,
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
      playerWeight: influencedOdds.playerWeight,
      predictionsCount: total,
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
