
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeTeamName(name: string) {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  const mapping: Record<string, string> = {
    "south korea": "korea republic",
    "iran": "ir iran",
    "united states": "usa",
    "united states of america": "usa",
    "ivory coast": "côte d'ivoire",
    "turkey": "türkiye",
    "bosnia-herzegovina": "bosnia and herzegovina",
    "bosnia herzegovina": "bosnia and herzegovina",
    "dr congo": "congo dr",
    "congo democratic republic": "congo dr",
    "czechia": "czech republic",

    "cape verde islands": "cape verde",
    "cabo verde": "cape verde",
    "cape verde": "cape verde",
  };

  return mapping[normalized] || normalized;
}

function calculateOdds(
  homePoints: number,
  awayPoints: number
) {
  const diff = Math.abs(
    homePoints - awayPoints
  );

  const expectedHome =
    1 /
    (
      1 +
      Math.pow(
        10,
        (awayPoints - homePoints) / 600
      )
    );

  const expectedAway =
    1 - expectedHome;

  let drawProbability =
    0.30 - diff / 3000;

  drawProbability = Math.max(
    0.18,
    Math.min(0.30, drawProbability)
  );

  const remaining =
    1 - drawProbability;

  const homeProbability =
    expectedHome * remaining;

  const awayProbability =
    expectedAway * remaining;

  return {
    homeProbability,
    drawProbability,
    awayProbability,

    coteHome: Number(
      (1 / homeProbability).toFixed(2)
    ),

    coteDraw: Number(
      (1 / drawProbability).toFixed(2)
    ),

    coteAway: Number(
      (1 / awayProbability).toFixed(2)
    ),
  };
}

export async function GET() {
  try {
    console.log(
      "=== Mise à jour FIFA ==="
    );

    const fifaResponse = await fetch(
      "https://api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0&language=en",
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!fifaResponse.ok) {
      throw new Error(
        "Impossible de récupérer le classement FIFA"
      );
    }

    const fifaData =
      await fifaResponse.json();

    const rankings =
      fifaData.Results?.map(
        (team: any) => ({
          team_name:
            team.TeamName?.[0]
              ?.Description ||
            team.IdCountry,

          fifa_rank: team.Rank,

          fifa_points: Number(
            team.TotalPoints.toFixed(2)
          ),

          updated_at:
            new Date().toISOString(),
        })
      ) || [];

    if (!rankings.length) {
      throw new Error(
        "Aucun classement FIFA trouvé"
      );
    }

    console.log(
      `${rankings.length} équipes FIFA récupérées`
    );

    const {
      error: rankingsError,
    } = await supabase
      .from("fifa_rankings")
      .upsert(rankings, {
        onConflict: "team_name",
      });

    if (rankingsError) {
      throw rankingsError;
    }

    const rankingsMap = new Map<
      string,
      {
        rank: number;
        points: number;
      }
    >();

    for (const team of rankings) {
      rankingsMap.set(
        normalizeTeamName(
          team.team_name
        ),
        {
          rank: team.fifa_rank,
          points: team.fifa_points,
        }
      );
    }

    const {
      data: matches,
      error: matchesError,
    } = await supabase
      .from("matches")
      .select("*")
      .is("home_score", null)
      .is("away_score", null);

    if (matchesError) {
      throw matchesError;
    }

    let updatedMatches = 0;
    let skippedMatches = 0;

    for (const match of matches || []) {
      const home =
        rankingsMap.get(
          normalizeTeamName(
            match.home_team
          )
        );

      const away =
        rankingsMap.get(
          normalizeTeamName(
            match.away_team
          )
        );

      if (!home || !away) {
        console.log(
          `Classement FIFA introuvable : ${match.home_team} vs ${match.away_team}`
        );

        skippedMatches++;
        continue;
      }

      const odds =
        calculateOdds(
          home.points,
          away.points
        );

      const { error } =
        await supabase
          .from("matches")
          .update({
            fifa_home_points:
              home.points,

            fifa_away_points:
              away.points,

            home_probability:
              odds.homeProbability,

            draw_probability:
              odds.drawProbability,

            away_probability:
              odds.awayProbability,

            cote_home:
              odds.coteHome,

            cote_draw:
              odds.coteDraw,

            cote_away:
              odds.coteAway,

            odds_updated_at:
              new Date().toISOString(),
          })
          .eq("id", match.id);

      if (error) {
        console.error(
          "Erreur mise à jour :",
          match.id,
          error
        );
      } else {
        updatedMatches++;
      }
    }

    return NextResponse.json({
      success: true,
      updatedAt:
        new Date().toISOString(),
      fifaTeams:
        rankings.length,
      matchesUpdated:
        updatedMatches,
      matchesSkipped:
        skippedMatches,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
