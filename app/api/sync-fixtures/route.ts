import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeTeamName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aliases: Record<string, string> = {
  "south korea": "korea republic",
  "iran": "ir iran",
  "usa": "united states",
};

function sameTeam(a: string, b: string) {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);

  if (na === nb) return true;

  if (aliases[na] === nb) return true;
  if (aliases[nb] === na) return true;

  return false;
}

export async function GET() {
  try {
    const { data: matches, error } = await supabase
      .from("matches")
      .select("*")
      .is("api_fixture_id", null);

    if (error) {
      throw error;
    }

    if (!matches?.length) {
      return NextResponse.json({
        success: true,
        message: "Aucun match à synchroniser",
      });
    }

    console.log(`${matches.length} matchs à synchroniser`);

    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY!,
        },
      }
    );

    const data = await response.json();

    const fixtures = data.response || [];

    console.log(`${fixtures.length} fixtures récupérées`);

    let updated = 0;

    for (const match of matches) {
      const fixture = fixtures.find((f: any) => {
        return (
          sameTeam(
            match.home_team,
            f.teams.home.name
          ) &&
          sameTeam(
            match.away_team,
            f.teams.away.name
          )
        );
      });

      if (!fixture) {
        console.log(
          "NON TROUVE :",
          match.home_team,
          "vs",
          match.away_team
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from("matches")
        .update({
          api_fixture_id: fixture.fixture.id,
        })
        .eq("id", match.id);

      if (!updateError) {
        updated++;
      }
    }

    return NextResponse.json({
      results: data.results,
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