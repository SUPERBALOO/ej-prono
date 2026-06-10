import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { concoursId: string } }
) {
  try {
    const concoursId = params.concoursId;

    // Participants du concours
    const { data: participants, error: participantsError } =
      await supabase
        .from("participants")
        .select(`
          user_id,
          profiles (
            pseudo
          )
        `)
        .eq("concours_id", concoursId);

    if (participantsError) throw participantsError;

    const classement: any[] = [];

    for (const participant of participants || []) {

      const { data: pointsRows } = await supabase
        .from("points")
        .select(`
          points,
          exact_score
        `)
        .eq("user_id", participant.user_id);

      const totalPoints =
        pointsRows?.reduce(
          (sum, p) => sum + (p.points || 0),
          0
        ) || 0;

      const bonsPronos =
        pointsRows?.filter(
          p => (p.points || 0) > 0
        ).length || 0;

      const scoresExacts =
        pointsRows?.filter(
          p => p.exact_score === true
        ).length || 0;

      classement.push({
        pseudo: participant.profiles?.pseudo || "Joueur",
        points: totalPoints,
        bons_pronos: bonsPronos,
        scores_exacts: scoresExacts,
      });
    }

    classement.sort(
      (a, b) => b.points - a.points
    );

    return NextResponse.json(classement);

  } catch (error: any) {

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