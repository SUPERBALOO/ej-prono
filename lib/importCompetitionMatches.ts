import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRankingsMap,
  getMatchOddsUpdate,
} from "@/lib/odds";
import { getMatchScoreUpdate } from "@/lib/matchScores";

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
      .select("id,nom,competition_id")
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

  const apiMatches = data.matches as ApiMatch[];
  const resolvedTeams =
    buildResolvedTeamMap(apiMatches);

  const validMatches = apiMatches
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

  if (!validMatches.length) {
    return {
      success: true,
      imported: 0,
      ignored: data.matches.length,
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
    const oddsUpdate = getMatchOddsUpdate(
      match,
      rankingsMap
    );

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
    ignored: data.matches.length - validMatches.length,
    fromStage: effectiveFromStage || null,
    oddsUpdated,
    oddsSkipped,
  };
}
