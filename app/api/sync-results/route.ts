import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculatePoints } from "@/lib/calculatePoints";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getScoreValue(
  score: any,
  side: "home" | "away"
) {
  const regularTime =
    score?.regularTime?.[side] ??
    score?.regularTime?.[
      side === "home" ? "homeTeam" : "awayTeam"
    ];

  if (regularTime !== null && regularTime !== undefined) {
    return regularTime;
  }

  return (
    score?.fullTime?.[side] ??
    score?.fullTime?.[
      side === "home" ? "homeTeam" : "awayTeam"
    ] ??
    null
  );
}

export async function GET() {
  try {
    const { data: matches, error } = await supabase
      .from("matches")
      .select("*")
      .not("api_match_id", "is", null)
      .in("status", ["scheduled", "live"]);

    if (error) {
      throw error;
    }

    if (!matches?.length) {
      return NextResponse.json({
        success: true,
        updated: 0,
        processed: 0,
        message: "Aucun match à synchroniser",
      });
    }

    let updated = 0;
    let processed = 0;

    for (const match of matches) {
      try {
        const response = await fetch(
          `https://api.football-data.org/v4/matches/${match.api_match_id}`,
          {
            headers: {
              "X-Auth-Token":
                process.env.FOOTBALL_DATA_API_KEY!,
            },
          }
        );

        const data = await response.json();

        if (!data?.id) {
          continue;
        }

        let status = "scheduled";

        switch (data.status) {
          case "LIVE":
          case "IN_PLAY":
          case "PAUSED":
            status = "live";
            break;

          case "FINISHED":
            status = "finished";
            break;

          default:
            status = "scheduled";
        }

        const updateData = {
          home_score:
            getScoreValue(data.score, "home"),

          away_score:
            getScoreValue(data.score, "away"),

          status,

          live_status:
            data.status ?? null,

          live_minute:
            data.minute ?? null,
        };

        const { error: updateError } =
          await supabase
            .from("matches")
            .update(updateData)
            .eq("id", match.id);

        if (updateError) {
          console.error(
            `Erreur update match ${match.id}`,
            updateError
          );
          continue;
        }

        updated++;

        // Match qui vient juste de se terminer
        if (
          status === "finished" &&
          match.status !== "finished"
        ) {
          const recalculated =
            await calculatePoints(match.id);

          processed += recalculated;

          console.log(
            `Match ${match.id} terminé - ${recalculated} pronostics recalculés`
          );
        }

      } catch (err) {
        console.error(
          `Erreur match ${match.api_match_id}`,
          err
        );
      }
    }

    console.log(
      `${updated} matchs synchronisés`
    );

    return NextResponse.json({
      success: true,
      updated,
      processed,
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
