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
        .select("id,match_date,status")
        .eq("concours_id", concoursID);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds =
      matches?.map((match) => match.id) || [];

    const recentFinishedMatchIds = (matches || [])
      .filter((match: any) => match.status === "finished")
      .sort(
        (a: any, b: any) =>
          new Date(b.match_date || 0).getTime() -
          new Date(a.match_date || 0).getTime()
      )
      .slice(0, 3)
      .map((match: any) => match.id);

    const recentFinishedMatchIdsSet = new Set(
      recentFinishedMatchIds
    );

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
              match_id,
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

      const previousPointsData = (pointsData || []).filter(
        (row: any) =>
          !recentFinishedMatchIdsSet.has(row.match_id)
      );

      const previousPoints = previousPointsData.reduce(
        (sum, row) => sum + (row.points || 0),
        0
      );

      const previousScoresExacts =
        previousPointsData.filter(
          (row: any) => row.exact_score
        ).length;

      const previousBonsPronos =
        previousPointsData.filter(
          (row: any) => (row.points || 0) > 0
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
        previous_points: previousPoints,
        previous_bons_pronos: previousBonsPronos,
        previous_scores_exacts: previousScoresExacts,
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

    const currentRanks = new Map<string, number>();

    classement.forEach((row, index) => {
      currentRanks.set(row.user_id, index + 1);
    });

    const previousClassement = [...classement].sort(
      (a, b) => {
        if (b.previous_points !== a.previous_points) {
          return b.previous_points - a.previous_points;
        }

        if (
          b.previous_scores_exacts !==
          a.previous_scores_exacts
        ) {
          return (
            b.previous_scores_exacts -
            a.previous_scores_exacts
          );
        }

        return (
          b.previous_bons_pronos -
          a.previous_bons_pronos
        );
      }
    );

    const previousRanks = new Map<string, number>();

    previousClassement.forEach((row, index) => {
      previousRanks.set(row.user_id, index + 1);
    });

    const classementWithMovement = classement.map((row) => {
      const currentRank =
        currentRanks.get(row.user_id) || null;
      const previousRank =
        previousRanks.get(row.user_id) || null;

      return {
        ...row,
        current_rank: currentRank,
        previous_rank: previousRank,
        rank_movement:
          currentRank && previousRank
            ? previousRank - currentRank
            : 0,
        rank_recent_matches_count:
          recentFinishedMatchIds.length,
      };
    });

    return NextResponse.json(classementWithMovement);

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
