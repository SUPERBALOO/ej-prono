import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {

    const { data: matches, error } = await supabase
      .from("matches")
      .select("*")
      .not("api_match_id", "is", null)
      .neq("status", "finished");

    if (error) {
      throw error;
    }

    if (!matches?.length) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: "Aucun match à synchroniser",
      });
    }

    let updated = 0;

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

        if (!data || !data.id) {
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
            data.score?.fullTime?.home ?? null,

          away_score:
            data.score?.fullTime?.away ?? null,

          status,

          live_status: data.status ?? null,

          live_minute:
            data.minute ??
            data.matchday ??
            null,
        };

        const { error: updateError } = await supabase
          .from("matches")
          .update(updateData)
          .eq("id", match.id);

        if (updateError) {
          console.error(updateError);
          continue;
        }

        updated++;

        // Match terminé => calcul des points

        if (
          status === "finished" &&
          match.status !== "finished"
        ) {

          try {

            const origin =
              process.env.NEXT_PUBLIC_SITE_URL ||
              "http://localhost:3000";

            await fetch(
              `${origin}/api/calculate-points`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  matchId: match.id,
                }),
              }
            );

          } catch (err) {
            console.error(
              "Erreur calculate-points",
              err
            );
          }
        }

      } catch (err) {

        console.error(
          `Erreur match ${match.api_match_id}`,
          err
        );

      }
    }

    return NextResponse.json({
      success: true,
      updated,
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