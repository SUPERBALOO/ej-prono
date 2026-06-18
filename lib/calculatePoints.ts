import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function calculatePoints() {
  const { data: predictions, error } =
    await supabase
      .from("predictions")
      .select(`
        *,
        matches (
          id,
          home_score,
          away_score,
          status
        )
      `);

  if (error) {
    throw error;
  }

  let processed = 0;

  for (const prediction of predictions || []) {

    const match = prediction.matches;

    if (!match) continue;

    if (
      match.home_score === null ||
      match.away_score === null
    ) {
      continue;
    }

    const realHome = match.home_score;
    const realAway = match.away_score;

    const predHome = prediction.pred_home;
    const predAway = prediction.pred_away;

    let points = 0;
    let exactScore = false;

    const cote =
      Number(prediction.prediction_odds) || 1;

    if (
      predHome === realHome &&
      predAway === realAway
    ) {

      exactScore = true;

      points = Math.round(
        100 * cote
      );

    } else {

      const realResult =
        realHome > realAway
          ? "HOME"
          : realHome < realAway
          ? "AWAY"
          : "DRAW";

      const predResult =
        predHome > predAway
          ? "HOME"
          : predHome < predAway
          ? "AWAY"
          : "DRAW";

      if (realResult === predResult) {

        points = Math.round(
          50 * cote
        );

      }
    }

    await supabase
      .from("points")
      .upsert(
        {
          user_id: prediction.user_id,
          match_id: prediction.match_id,
          points,
          exact_score: exactScore,
        },
        {
          onConflict: "user_id,match_id",
        }
      );

    processed++;
  }

  return processed;
}