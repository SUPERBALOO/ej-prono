import { NextResponse } from "next/server";

const NEWS_URL =
  "https://www.lemansfc.fr/index.php?section=actualites";
const SITE_URL = "https://www.lemansfc.fr/";

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    nbsp: " ",
    laquo: "«",
    raquo: "»",
  };

  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&([a-z]+);/gi, (entity, name) =>
      entities[name.toLowerCase()] ?? entity
    )
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(path?: string) {
  if (!path) return null;

  return new URL(path, SITE_URL).toString();
}

function parseNews(html: string) {
  const blocks = html.match(
    /<div class="actu-filtre">[\s\S]*?(?=<div class="actu-filtre">|$)/gi
  ) || [];

  return blocks.slice(0, 3).flatMap((block) => {
    const category = block.match(
      /<button[^>]*>([\s\S]*?)<\/button>/i
    )?.[1];
    const date = block.match(
      /Le\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i
    )?.[1];
    const image = block.match(
      /background-image:\s*url\(([^)]+)\)/i
    )?.[1];
    const title = block.match(
      /font-family:\s*Gotham2[^>]*>([\s\S]*?)<\/div>/i
    )?.[1];
    const description = block.match(
      /<p class="desc">([\s\S]*?)<\/p>/i
    )?.[1];
    const href = block.match(
      /href=['"]([^'"]*actualites-contenu[^'"]*)['"]/i
    )?.[1];

    if (!title || !href) return [];

    return [{
      title: decodeHtml(title),
      category: decodeHtml(category || "Actualité"),
      date: date || null,
      description: decodeHtml(description || ""),
      imageUrl: absoluteUrl(image?.replace(/["']/g, "")),
      url: absoluteUrl(href),
    }];
  });
}

export async function GET() {
  try {
    const response = await fetch(NEWS_URL, {
      headers: {
        "User-Agent": "EJ-Prono/1.0",
      },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Le Mans FC: HTTP ${response.status}`);
    }

    const news = parseNews(await response.text());

    return NextResponse.json(
      { news },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=900, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Actualités Le Mans FC indisponibles", error);

    return NextResponse.json(
      { news: [] },
      { status: 200 }
    );
  }
}
