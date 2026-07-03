import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { importCompetitionMatches } from "@/lib/importCompetitionMatches";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { concoursId, fromStage } = await req.json();

    if (!concoursId) {
      return NextResponse.json(
        { error: "concoursId manquant" },
        { status: 400 }
      );
    }

    const result = await importCompetitionMatches({
      supabase,
      concoursId,
      fromStage,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
