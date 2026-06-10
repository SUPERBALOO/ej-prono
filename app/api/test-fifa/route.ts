import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://inside.fifa.com/fifa-world-ranking/men",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      }
    );

    const html = await response.text();

    const franceIndex = html.indexOf('"countryName":"France"');

    let franceBlock = "";

    if (franceIndex > -1) {
      franceBlock = html.substring(
        Math.max(0, franceIndex - 2000),
        Math.min(html.length, franceIndex + 2000)
      );
    }

    return NextResponse.json({
      found: franceIndex > -1,
      franceBlock,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    });
  }
}