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

    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select("id")
        .eq("concours_id", concoursID);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds =
      matches?.map((match) => match.id) || [];

    // Profils
    let profils: any[] | null = null;
    let profilsError: any = null;

    const profilsResult = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    profils = profilsResult.data;
    profilsError = profilsResult.error;

    if (profilsError) {
      throw profilsError;
    }

    const pseudoMap: Record<string, string> = {};
    const avatarMap: Record<string, string | null> = {};
    const firstNameMap: Record<string, string | null> = {};
    const lastNameMap: Record<string, string | null> = {};
    const companyMap: Record<string, string | null> = {};

    (profils || []).forEach((p) => {
      pseudoMap[p.id] = p.pseudo;
      avatarMap[p.id] = p.avatar_url || null;
      firstNameMap[p.id] = p.first_name || null;
      lastNameMap[p.id] = p.last_name || null;
      companyMap[p.id] = p.company || null;
    });

    const classement = [];

    for (const participant of participants || []) {
      const userId = participant.joueur_id;

      const { data: pointsData } = matchIds.length
        ? await supabase
            .from("points")
            .select(`
              points,
              exact_score
            `)
            .eq("user_id", userId)
            .in("match_id", matchIds)
        : { data: [] };

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
        user_id: userId,
        pseudo:
          pseudoMap[userId] || "Joueur",
        avatar_url: avatarMap[userId] || null,
        first_name: firstNameMap[userId] || null,
        last_name: lastNameMap[userId] || null,
        company: companyMap[userId] || null,
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
