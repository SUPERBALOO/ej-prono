import { NextResponse } from "next/server";

export async function GET() {
  const response = await fetch(
    "https://v3.football.api-sports.io/rankings",
    {
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY!,
      },
    }
  );

  const data = await response.json();

  return NextResponse.json(data);
}