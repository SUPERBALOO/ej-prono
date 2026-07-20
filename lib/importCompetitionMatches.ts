import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRankingsMap,
  buildTeamStrengthMap,
  getClubMatchOddsUpdate,
  getMatchOddsUpdate,
} from "@/lib/odds";
import {
  getApiFootballScoreUpdate,
  getMatchScoreUpdate,
} from "@/lib/matchScores";

const stageOrder = [
  "GROUP_STAGE",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

type ApiTeam = {
  name?: string | null;
  crest?: string | null;
};

type ApiMatch = {
  id: number | string;
  stage?: string | null;
  group?: string | null;
  status: string;
  utcDate: string;
  homeTeam?: ApiTeam | null;
  awayTeam?: ApiTeam | null;
  score?: {
    winner?: string | null;
    duration?: string | null;
    fullTime?: Record<string, number | null>;
    regularTime?: Record<string, number | null>;
    extraTime?: Record<string, number | null>;
    penalties?: Record<string, number | null>;
  } | null;
};

type ResolvedTeam = {
  name: string;
  crest: string | null;
};

type ApiFootballFixture = {
  fixture?: {
    id?: number | string;
    date?: string | null;
    status?: {
      short?: string | null;
      long?: string | null;
      elapsed?: number | null;
    } | null;
  } | null;
  league?: {
    round?: string | null;
  } | null;
  teams?: {
    home?: {
      name?: string | null;
      logo?: string | null;
    } | null;
    away?: {
      name?: string | null;
      logo?: string | null;
    } | null;
  } | null;
  goals?: {
    home?: number | null;
    away?: number | null;
  } | null;
  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    } | null;
    fulltime?: {
      home?: number | null;
      away?: number | null;
    } | null;
    extratime?: {
      home?: number | null;
      away?: number | null;
    } | null;
    penalty?: {
      home?: number | null;
      away?: number | null;
    } | null;
  } | null;
};

type ApiFootballStanding = {
  rank?: number | null;
  points?: number | null;
  team?: {
    name?: string | null;
  } | null;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferApiFootballLeagueId(competition: any) {
  const explicitLeagueId =
    competition.api_league_id ||
    competition.api_competition_id;

  if (explicitLeagueId) {
    return explicitLeagueId;
  }

  const label = normalizeText(
    `${competition.nom ?? ""} ${competition.concours_nom ?? ""}`
  );

  if (label.includes("ligue 1")) {
    return 61;
  }

  return null;
}

function inferApiFootballSeason(competition: any) {
  if (competition.api_season) {
    return Number(competition.api_season);
  }

  if (competition.season) {
    return Number(competition.season);
  }

  const startDate =
    competition.date_debut ||
    competition.start_date ||
    competition.date_start ||
    competition.concours_date_debut;

  if (startDate) {
    const year = new Date(startDate).getFullYear();

    if (!Number.isNaN(year)) {
      return year;
    }
  }

  const label = `${competition.nom ?? ""} ${
    competition.concours_nom ?? ""
  }`;
  const years = Array.from(
    label.matchAll(/\b(20\d{2})\b/g),
    (match) => Number(match[1])
  ).filter((year) => !Number.isNaN(year));

  if (!years.length) {
    return null;
  }

  if (years.length > 1) {
    return Math.min(...years);
  }

  if (normalizeText(label).includes("ligue 1")) {
    return years[0] - 1;
  }

  return years[0];
}

function withApiFootballDefaults(competition: any) {
  return {
    ...competition,
    api_league_id: inferApiFootballLeagueId(competition),
    api_season: inferApiFootballSeason(competition),
  };
}

export function getAllowedStages(fromStage?: string | null) {
  if (!fromStage) {
    return null;
  }

  const stageIndex = stageOrder.indexOf(fromStage);

  if (stageIndex === -1) {
    return null;
  }

  return stageOrder.slice(stageIndex);
}

export function inferImportStageFromConcoursName(
  name?: string | null
) {
  const normalized = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normalized.includes("1/8") ||
    normalized.includes("huitieme") ||
    normalized.includes("huitiemes") ||
    normalized.includes("last 16")
  ) {
    return "LAST_16";
  }

  return null;
}

function getScoreValue(
  score: ApiMatch["score"],
  period:
    | "fullTime"
    | "regularTime"
    | "extraTime"
    | "penalties",
  side: "home" | "away"
) {
  return (
    score?.[period]?.[side] ??
    score?.[period]?.[
      side === "home" ? "homeTeam" : "awayTeam"
    ] ??
    null
  );
}

function scoreWinnerSide(
  score: ApiMatch["score"]
): "home" | "away" | null {
  if (score?.winner === "HOME_TEAM") {
    return "home";
  }

  if (score?.winner === "AWAY_TEAM") {
    return "away";
  }

  const periods =
    score?.duration === "PENALTY_SHOOTOUT"
      ? (["fullTime", "penalties"] as const)
      : (["fullTime", "regularTime"] as const);

  for (const period of periods) {
    const home = getScoreValue(score, period, "home");
    const away = getScoreValue(score, period, "away");

    if (
      home !== null &&
      away !== null &&
      home !== away
    ) {
      return home > away ? "home" : "away";
    }
  }

  return null;
}

function getWinnerTeam(match?: ApiMatch) {
  if (!match) {
    return null;
  }

  const side = scoreWinnerSide(match.score);

  if (side === "home" && match.homeTeam?.name) {
    return {
      name: match.homeTeam.name,
      crest: match.homeTeam.crest ?? null,
    };
  }

  if (side === "away" && match.awayTeam?.name) {
    return {
      name: match.awayTeam.name,
      crest: match.awayTeam.crest ?? null,
    };
  }

  return null;
}

function getLoserTeam(match?: ApiMatch) {
  if (!match) {
    return null;
  }

  const side = scoreWinnerSide(match.score);

  if (side === "home" && match.awayTeam?.name) {
    return {
      name: match.awayTeam.name,
      crest: match.awayTeam.crest ?? null,
    };
  }

  if (side === "away" && match.homeTeam?.name) {
    return {
      name: match.homeTeam.name,
      crest: match.homeTeam.crest ?? null,
    };
  }

  return null;
}

function buildResolvedTeamMap(matches: ApiMatch[]) {
  const byStage = new Map<string, ApiMatch[]>();

  for (const match of matches) {
    if (!match.stage) {
      continue;
    }

    const stageMatches = byStage.get(match.stage) || [];
    stageMatches.push(match);
    byStage.set(match.stage, stageMatches);
  }

  for (const stageMatches of byStage.values()) {
    stageMatches.sort(
      (a, b) =>
        new Date(a.utcDate).getTime() -
        new Date(b.utcDate).getTime()
    );
  }

  const resolved = new Map<
    string | number,
    {
      home: ResolvedTeam | null;
      away: ResolvedTeam | null;
    }
  >();

  for (const match of matches) {
    resolved.set(match.id, {
      home: match.homeTeam?.name
        ? {
            name: match.homeTeam.name,
            crest: match.homeTeam.crest ?? null,
          }
        : null,
      away: match.awayTeam?.name
        ? {
            name: match.awayTeam.name,
            crest: match.awayTeam.crest ?? null,
          }
        : null,
    });
  }

  const deriveFromPreviousWinners = (
    stage: string,
    previousStage: string
  ) => {
    const stageMatches = byStage.get(stage) || [];
    const previousMatches =
      byStage.get(previousStage) || [];

    stageMatches.forEach((match, index) => {
      const current = resolved.get(match.id);

      if (!current || (current.home && current.away)) {
        return;
      }

      resolved.set(match.id, {
        home:
          current.home ||
          getWinnerTeam(previousMatches[index * 2]),
        away:
          current.away ||
          getWinnerTeam(previousMatches[index * 2 + 1]),
      });
    });
  };

  deriveFromPreviousWinners(
    "QUARTER_FINALS",
    "LAST_16"
  );
  deriveFromPreviousWinners(
    "SEMI_FINALS",
    "QUARTER_FINALS"
  );

  const semiFinals =
    byStage.get("SEMI_FINALS") || [];

  for (const finalStage of [
    "FINAL",
    "THIRD_PLACE",
  ]) {
    const stageMatches = byStage.get(finalStage) || [];

    stageMatches.forEach((match) => {
      const current = resolved.get(match.id);

      if (!current || (current.home && current.away)) {
        return;
      }

      const resolver =
        finalStage === "FINAL"
          ? getWinnerTeam
          : getLoserTeam;

      resolved.set(match.id, {
        home: current.home || resolver(semiFinals[0]),
        away: current.away || resolver(semiFinals[1]),
      });
    });
  }

  return resolved;
}

function getFootballDataStatus(status: string) {
  switch (status) {
    case "FINISHED":
      return "finished";

    case "LIVE":
    case "IN_PLAY":
    case "PAUSED":
      return "live";

    default:
      return "scheduled";
  }
}

function getApiFootballStatus(status?: string | null) {
  switch (status) {
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "SUSP":
    case "INT":
    case "LIVE":
      return "live";

    case "FT":
    case "AET":
    case "PEN":
      return "finished";

    default:
      return "scheduled";
  }
}

async function fetchFootballDataMatches(competition: any) {
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${competition.api_competition_id}/matches`,
    {
      headers: {
        "X-Auth-Token":
          process.env.FOOTBALL_DATA_API_KEY!,
      },
    }
  );

  const data = await response.json();

  if (!response.ok || !data.matches) {
    throw new Error(
      data?.message || "Aucun match trouve"
    );
  }

  return {
    rawCount: data.matches.length,
    matches: data.matches as ApiMatch[],
  };
}

async function fetchApiFootballFixtures(competition: any) {
  const { api_league_id: leagueId, api_season: season } =
    withApiFootballDefaults(competition);

  if (!leagueId || !season) {
    throw new Error(
      "Competition API-Football incomplete"
    );
  }

  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}`,
    {
      headers: {
        "x-apisports-key":
          process.env.API_FOOTBALL_KEY!,
      },
    }
  );

  const data = await response.json();

  if (!response.ok || !Array.isArray(data.response)) {
    throw new Error(
      data?.message ||
        data?.errors?.requests ||
        "Aucun match trouve"
    );
  }

  return {
    rawCount: data.response.length,
    fixtures: data.response as ApiFootballFixture[],
  };
}

async function fetchApiFootballPreviousStandings(
  competition: any
) {
  const {
    api_league_id: leagueId,
    api_season: currentSeason,
  } = withApiFootballDefaults(competition);
  const season = Number(currentSeason) - 1;

  if (!leagueId || !season) {
    return [];
  }

  const response = await fetch(
    `https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`,
    {
      headers: {
        "x-apisports-key":
          process.env.API_FOOTBALL_KEY!,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.errors?.requests ||
        "Classement API-Football introuvable"
    );
  }

  const standings =
    data.response?.[0]?.league?.standings?.[0];

  if (!Array.isArray(standings)) {
    return [];
  }

  return standings
    .filter(
      (standing: ApiFootballStanding) =>
        standing.team?.name && standing.rank
    )
    .map((standing: ApiFootballStanding) => ({
      team_name: standing.team!.name!,
      previous_rank: standing.rank!,
      strength_points:
        standing.points != null
          ? 1200 + standing.points * 7
          : null,
      home_bonus_points: 60,
    }));
}

async function getCompetitionTeamStrengths(
  supabase: SupabaseClient,
  competition: any
) {
  const { data, error } = await supabase
    .from("competition_team_rankings")
    .select(
      "team_name,previous_rank,strength_points,home_bonus_points"
    )
    .eq("competition_id", competition.id)
    .eq("season", competition.api_season)
    .eq("active", true);

  if (error) {
    console.warn(
      "Classements clubs Supabase indisponibles",
      error.message
    );
  }

  if (data?.length) {
    return data;
  }

  try {
    return await fetchApiFootballPreviousStandings(
      competition
    );
  } catch (error) {
    console.warn(
      "Classement clubs API-Football indisponible",
      error
    );
    return [];
  }
}

function buildFallbackTeamStrengthsFromMatches(
  matches: Array<{
    home_team?: string | null;
    away_team?: string | null;
  }>
) {
  const teamNames = Array.from(
    new Set(
      matches.flatMap((match) =>
        [match.home_team, match.away_team].filter(Boolean)
      ) as string[]
    )
  ).sort((a, b) => a.localeCompare(b));

  return buildTeamStrengthMap(
    teamNames.map((teamName, index) => ({
      team_name: teamName,
      previous_rank: index + 1,
      strength_points: 1500,
      home_bonus_points: 60,
    }))
  );
}

export async function importCompetitionMatches({
  supabase,
  concoursId,
  fromStage,
}: {
  supabase: SupabaseClient;
  concoursId: string;
  fromStage?: string | null;
}) {
  const { data: concours, error: concoursError } =
    await supabase
      .from("concours")
      .select("id,nom,competition_id,date_debut,date_fin")
      .eq("id", concoursId)
      .single();

  if (concoursError || !concours?.competition_id) {
    throw new Error("Aucune competition liee");
  }

  const effectiveFromStage =
    fromStage ||
    inferImportStageFromConcoursName(concours.nom);

  const allowedStages =
    getAllowedStages(effectiveFromStage);

  const { data: competition, error: competitionError } =
    await supabase
      .from("competitions")
      .select("*")
      .eq("id", concours.competition_id)
      .single();

  if (competitionError || !competition) {
    throw new Error("Competition introuvable");
  }

  const competitionContext = {
    ...competition,
    concours_nom: concours.nom,
    concours_date_debut: concours.date_debut,
    concours_date_fin: concours.date_fin,
  };

  const apiProvider =
    competition.api_provider || "football-data";

  let ignoredCount = 0;
  let validMatches: any[] = [];
  let teamStrengthsMap = buildTeamStrengthMap([]);

  if (apiProvider === "api-football") {
    const apiCompetition =
      withApiFootballDefaults(competitionContext);
    const { rawCount, fixtures } =
      await fetchApiFootballFixtures(apiCompetition);
    const teamStrengths =
      await getCompetitionTeamStrengths(
        supabase,
        apiCompetition
      );

    teamStrengthsMap =
      buildTeamStrengthMap(teamStrengths);

    validMatches = fixtures
      .filter(
        (fixture) =>
          fixture.fixture?.id &&
          fixture.fixture?.date &&
          fixture.teams?.home?.name &&
          fixture.teams?.away?.name
      )
      .map((fixture) => {
        const status = getApiFootballStatus(
          fixture.fixture?.status?.short
        );

        return {
          api_match_id: fixture.fixture!.id,
          concours_id: concoursId,
          home_team: fixture.teams!.home!.name,
          away_team: fixture.teams!.away!.name,
          home_logo: fixture.teams!.home!.logo ?? null,
          away_logo: fixture.teams!.away!.logo ?? null,
          match_date: fixture.fixture!.date,
          phase: fixture.league?.round ?? null,
          groupe: null,
          status,
          live_status:
            fixture.fixture?.status?.short ?? null,
          live_minute:
            fixture.fixture?.status?.elapsed ?? null,
          ...getApiFootballScoreUpdate(fixture, status),
        };
      });

    if (!teamStrengthsMap.size) {
      teamStrengthsMap =
        buildFallbackTeamStrengthsFromMatches(validMatches);
    }

    ignoredCount = rawCount - validMatches.length;
  } else {
    const { rawCount, matches: apiMatches } =
      await fetchFootballDataMatches(competition);
    const resolvedTeams =
      buildResolvedTeamMap(apiMatches);

    validMatches = apiMatches
      .filter(
        (match) =>
          resolvedTeams.get(match.id)?.home?.name &&
          resolvedTeams.get(match.id)?.away?.name &&
          (!allowedStages ||
            (!!match.stage &&
              allowedStages.includes(match.stage)))
      )
      .map((match) => {
        const teams = resolvedTeams.get(match.id)!;

        return {
          api_match_id: match.id,
          concours_id: concoursId,
          home_team: teams.home!.name,
          away_team: teams.away!.name,
          home_logo: teams.home!.crest,
          away_logo: teams.away!.crest,
          match_date: match.utcDate,
          phase: match.stage ?? null,
          groupe: match.group ?? null,
          status: getFootballDataStatus(match.status),
          ...getMatchScoreUpdate(match.score),
        };
      });

    ignoredCount = rawCount - validMatches.length;
  }

  if (!validMatches.length) {
    return {
      success: true,
      imported: 0,
      ignored: ignoredCount,
      fromStage: effectiveFromStage || null,
      oddsUpdated: 0,
      oddsSkipped: 0,
    };
  }

  const { data: importedMatches, error } =
    await supabase
      .from("matches")
      .upsert(validMatches, {
        onConflict: "concours_id,api_match_id",
      })
      .select("*");

  if (error) {
    throw error;
  }

  const { data: rankings } = await supabase
    .from("fifa_rankings")
    .select("team_name,fifa_rank,fifa_points");

  const rankingsMap = buildRankingsMap(rankings || []);

  let oddsUpdated = 0;
  let oddsSkipped = 0;

  for (const match of importedMatches || []) {
    const oddsUpdate =
      apiProvider === "api-football"
        ? getClubMatchOddsUpdate(
            match,
            teamStrengthsMap
          )
        : getMatchOddsUpdate(match, rankingsMap);

    if (!oddsUpdate) {
      oddsSkipped++;
      continue;
    }

    const { error: oddsError } = await supabase
      .from("matches")
      .update(oddsUpdate)
      .eq("id", match.id);

    if (oddsError) {
      oddsSkipped++;
    } else {
      oddsUpdated++;
    }
  }

  return {
    success: true,
    imported: validMatches.length,
    ignored: ignoredCount,
    fromStage: effectiveFromStage || null,
    oddsUpdated,
    oddsSkipped,
  };
}
