import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isLeMansTeam(team: string | null | undefined) {
  return (team || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes("le mans");
}

function shouldDoubleLeMansPoints(match: {
  home_team?: string | null;
  away_team?: string | null;
  home_score: number;
  away_score: number;
}) {
  if (
    isLeMansTeam(match.home_team) &&
    match.home_score > match.away_score
  ) {
    return true;
  }

  return (
    isLeMansTeam(match.away_team) &&
    match.away_score > match.home_score
  );
}

export async function calculatePoints(
  matchId: string
) {
  const { data: predictions, error } =
    await supabase
      .from("predictions")
      .select(`
        *,
        matches (
          id,
        home_score,
        away_score,
        home_team,
        away_team,
        status
      )
    `)
      .eq("match_id", matchId);

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
      Number(
        prediction.locked_odds ??
          prediction.prediction_odds
      ) || 1;

    if (
      predHome === realHome &&
      predAway === realAway
    ) {
      exactScore = true;
      points = Math.round(100 * cote);
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
        points = Math.round(50 * cote);
      }
    }

    if (
      points > 0 &&
      shouldDoubleLeMansPoints({
        home_team: match.home_team,
        away_team: match.away_team,
        home_score: realHome,
        away_score: realAway,
      })
    ) {
      points *= 2;
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
