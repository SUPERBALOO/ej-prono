import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch(
    "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
    {
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY!,
      },
    }
  );

  const data = await response.json();

  return NextResponse.json({
    results: data.results,
    errors: data.errors,
    first: data.response?.[0] ?? null,
  });
}
