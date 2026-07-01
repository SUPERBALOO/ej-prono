import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildRankingsMap,
  getMatchOddsUpdate,
} from "@/lib/odds";
import { getMatchScoreUpdate } from "@/lib/matchScores";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stageOrder = [
  "GROUP_STAGE",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

function getAllowedStages(fromStage?: string) {
  if (!fromStage) {
    return null;
  }

  const stageIndex = stageOrder.indexOf(fromStage);

  if (stageIndex === -1) {
    return null;
  }

  return stageOrder.slice(stageIndex);
}

export async function POST(req: NextRequest) {
  try {
    const { concoursId, fromStage } = await req.json();
    const allowedStages = getAllowedStages(fromStage);

    const { data: concours, error: concoursError } = await supabase
      .from("concours")
      .select("competition_id")
      .eq("id", concoursId)
      .single();

    if (concoursError || !concours?.competition_id) {
      return NextResponse.json(
        { error: "Aucune compétition liée" },
        { status: 400 }
      );
    }

    const { data: competition, error: competitionError } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", concours.competition_id)
      .single();

    if (competitionError || !competition) {
      return NextResponse.json(
        { error: "Compétition introuvable" },
        { status: 400 }
      );
    }

    console.log(
      "Import compétition :",
      competition.nom,
      competition.api_competition_id
    );

    const response = await fetch(
      `https://api.football-data.org/v4/competitions/${competition.api_competition_id}/matches`,
      {
        headers: {
          "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY!,
        },
      }
    );

    const data = await response.json();

    if (!data.matches) {
      console.log("Réponse API :", data);

      return NextResponse.json(
        { error: "Aucun match trouvé" },
        { status: 400 }
      );
    }

    // DEBUG
    console.log("Premier match complet :");
    console.log(
      JSON.stringify(data.matches[0], null, 2)
    );

    console.log("Home Team :");
    console.log(data.matches[0].homeTeam);

    console.log("Away Team :");
    console.log(data.matches[0].awayTeam);

    const matchsValides = data.matches
      .filter(
        (m: any) =>
          m.homeTeam?.name &&
          m.awayTeam?.name &&
          (!allowedStages ||
            allowedStages.includes(m.stage))
      )
      .map((m: any) => ({
        api_match_id: m.id,

        concours_id: concoursId,

        home_team: m.homeTeam.name,
        away_team: m.awayTeam.name,
        home_logo: m.homeTeam?.crest ?? null,
        away_logo: m.awayTeam?.crest ?? null,

        match_date: m.utcDate,

        phase: m.stage ?? null,
        groupe: m.group ?? null,

        status:
          m.status === "FINISHED"
            ? "finished"
            : m.status === "IN_PLAY"
            ? "live"
            : "scheduled",

        ...getMatchScoreUpdate(m.score),
      }));

    console.log(
      `${matchsValides.length} matchs valides sur ${data.matches.length}`
    );

    if (!matchsValides.length) {
      return NextResponse.json({
        success: true,
        imported: 0,
        ignored: data.matches.length,
        fromStage: fromStage || null,
        oddsUpdated: 0,
        oddsSkipped: 0,
      });
    }

    const {
      data: importedMatches,
      error,
    } = await supabase
      .from("matches")
      .upsert(matchsValides, {
        onConflict: "concours_id,api_match_id",
      })
      .select("*");

    if (error) {
      console.error("Erreur Supabase :", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const { data: rankings } = await supabase
      .from("fifa_rankings")
      .select("team_name,fifa_rank,fifa_points");

    const rankingsMap =
      buildRankingsMap(rankings || []);

    let oddsUpdated = 0;
    let oddsSkipped = 0;

    for (const match of importedMatches || []) {
      const oddsUpdate =
        getMatchOddsUpdate(
          match,
          rankingsMap
        );

      if (!oddsUpdate) {
        oddsSkipped++;
        continue;
      }

      const { error: oddsError } =
        await supabase
          .from("matches")
          .update(oddsUpdate)
          .eq("id", match.id);

      if (oddsError) {
        console.error(
          "Erreur mise à jour cotes :",
          match.id,
          oddsError
        );
        oddsSkipped++;
      } else {
        oddsUpdated++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: matchsValides.length,
      ignored:
        data.matches.length - matchsValides.length,
      fromStage: fromStage || null,
      oddsUpdated,
      oddsSkipped,
    });

  } catch (err: any) {
    console.error("Erreur générale :", err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}
