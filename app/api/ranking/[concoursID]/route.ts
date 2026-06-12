import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ concoursID: string }> }
) {
  try {
    const { concoursID } = await params;

    // Participants du concours
    const { data: participants, error: participantsError } =
      await supabase
        .from("participants_concours")
        .select("joueur_id")
        .eq("concours_id", concoursID);

    if (participantsError) {
      throw participantsError;
    }

    const userIds =
      participants?.map((p) => p.joueur_id) || [];

    // Profils
    const { data: profils } = await supabase
      .from("profiles")
      .select("id,pseudo")
      .in("id", userIds);

    const pseudoMap: Record<string, string> = {};

    (profils || []).forEach((p) => {
      pseudoMap[p.id] = p.pseudo;
    });

    const classement = [];

    for (const participant of participants || []) {
      const userId = participant.joueur_id;

      const { data: pointsData } = await supabase
        .from("points")
        .select(`
          points,
          exact_score
        `)
        .eq("user_id", userId);

      const totalPoints = (pointsData || []).reduce(
        (sum, row) => sum + (row.points || 0),
        0
      );

      const scoresExacts = (pointsData || []).filter(
        (row) => row.exact_score
      ).length;

      const bonsPronos = (pointsData || []).filter(
        (row) => (row.points || 0) > 0
      ).length;

      classement.push({
        pseudo:
          pseudoMap[userId] || "Joueur",
        points: totalPoints,
        bons_pronos: bonsPronos,
        scores_exacts: scoresExacts,
      });
    }

    classement.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (b.scores_exacts !== a.scores_exacts) {
        return b.scores_exacts - a.scores_exacts;
      }

      return b.bons_pronos - a.bons_pronos;
    });

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