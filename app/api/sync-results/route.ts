import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { data: matches, error } = await supabase
      .from("matches")
      .select(`
        id,
        api_fixture_id,
        status
      `)
      .not("api_fixture_id", "is", null);

    if (error) {
      throw error;
    }

    let updated = 0;

    for (const match of matches || []) {

      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?id=${match.api_fixture_id}`,
        {
          headers: {
            "x-apisports-key":
              process.env.API_FOOTBALL_KEY!,
          },
        }
      );

      const data = await response.json();

      const fixture = data.response?.[0];

      if (!fixture) {
        continue;
      }

      const shortStatus =
        fixture.fixture.status.short;

      let status = "scheduled";

      if (
        shortStatus === "1H" ||
        shortStatus === "HT" ||
        shortStatus === "2H" ||
        shortStatus === "ET" ||
        shortStatus === "BT" ||
        shortStatus === "P"
      ) {
        status = "live";
      }

      if (
        shortStatus === "FT" ||
        shortStatus === "AET" ||
        shortStatus === "PEN"
      ) {
        status = "finished";
      }

      await supabase
        .from("matches")
        .update({
          home_score: fixture.goals.home,
          away_score: fixture.goals.away,
          status,
          live_status: shortStatus,
          live_minute:
            fixture.fixture.status.elapsed,
        })
        .eq("id", match.id);

      updated++;
    }

    // Recalcul automatique des points
    const origin = new URL(req.url).origin;

    try {
      await fetch(
        `${origin}/api/calculate-points`
      );
    } catch (e) {
      console.error(
        "Erreur calculate-points :",
        e
      );
    }

    return NextResponse.json({
      success: true,
      updated,
    });

  } catch (error: any) {

    console.error(
      "Erreur sync-results :",
      error
    );

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