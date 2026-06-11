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

    const { data: participants, error: participantsError } =
      await supabase
        .from("participants_concours")
        .select(`
          joueur_id,
          profiles (
            pseudo
          )
        `)
        .eq("concours_id", concoursID);

    if (participantsError) {
      throw participantsError;
    }

    const classement: any[] = [];

    for (const participant of participants || []) {

      const { data: predictions, error: predictionsError } =
        await supabase
          .from("predictions")
          .select(`
            id,
            pred_home,
            pred_away,
            match_id
          `)
          .eq("user_id", participant.joueur_id);

      if (predictionsError) {
        throw predictionsError;
      }

      let totalPoints = 0;
      let bonsPronos = 0;
      let scoresExacts = 0;

      for (const prediction of predictions || []) {

        const { data: match, error: matchError } =
          await supabase
            .from("matches")
            .select(`
              home_score,
              away_score
            `)
            .eq("id", prediction.match_id)
            .single();

        if (matchError || !match) {
          continue;
        }

        if (
          match.home_score === null ||
          match.away_score === null
        ) {
          continue;
        }

        const resultatReel =
          match.home_score > match.away_score
            ? "1"
            : match.home_score < match.away_score
            ? "2"
            : "N";

        const resultatProno =
          prediction.pred_home > prediction.pred_away
            ? "1"
            : prediction.pred_home < prediction.pred_away
            ? "2"
            : "N";

        if (resultatReel === resultatProno) {
          totalPoints += 1;
          bonsPronos++;
        }

        if (
          prediction.pred_home === match.home_score &&
          prediction.pred_away === match.away_score
        ) {
          totalPoints += 2;
          scoresExacts++;
        }
      }

      classement.push({
        pseudo:
          participant.profiles?.[0]?.pseudo ??
          "Joueur",
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

    console.error("Erreur classement :", error);

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