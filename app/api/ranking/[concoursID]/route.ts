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
        .from("participants_concours")
        .select("*")
        .eq("concours_id", concoursId);

    if (participantsError) {
      throw participantsError;
    }

    const classement: any[] = [];

    for (const participant of participants || []) {

      // Profil du joueur
      const { data: profil } =
        await supabase
          .from("profiles")
          .select("pseudo")
          .eq("id", participant.joueur_id)
          .single();

      // Points du joueur
      const { data: pointsRows, error: pointsError } =
        await supabase
          .from("points")
          .select(`
            points,
            exact_score
          `)
          .eq("user_id", participant.joueur_id);

      if (pointsError) {
        throw pointsError;
      }

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
        pseudo: profil?.pseudo || "Joueur",
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