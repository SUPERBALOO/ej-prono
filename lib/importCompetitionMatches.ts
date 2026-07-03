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

  const validMatches = data.matches
    .filter(
      (match: any) =>
        match.homeTeam?.name &&
        match.awayTeam?.name &&
        (!allowedStages ||
          allowedStages.includes(match.stage))
    )
    .map((match: any) => ({
      api_match_id: match.id,
      concours_id: concoursId,
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
      home_logo: match.homeTeam?.crest ?? null,
      away_logo: match.awayTeam?.crest ?? null,
      match_date: match.utcDate,
      phase: match.stage ?? null,
      groupe: match.group ?? null,
      status: getFootballDataStatus(match.status),
      ...getMatchScoreUpdate(match.score),
    }));

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
