import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return;
  }

  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);

    if (!match) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

function calculatePredictionPoints(prediction, match) {
  const cote =
    Number(
      prediction.locked_odds ??
        prediction.prediction_odds ??
        1
    ) || 1;

  if (
    prediction.pred_home === match.home_score &&
    prediction.pred_away === match.away_score
  ) {
    return {
      points: Math.round(100 * cote),
      exact_score: true,
    };
  }

  const realResult =
    match.home_score > match.away_score
      ? "HOME"
      : match.home_score < match.away_score
        ? "AWAY"
        : "DRAW";

  const predResult =
    prediction.pred_home > prediction.pred_away
      ? "HOME"
      : prediction.pred_home < prediction.pred_away
        ? "AWAY"
        : "DRAW";

  return {
    points:
      realResult === predResult
        ? Math.round(50 * cote)
        : 0,
    exact_score: false,
  };
}

async function fetchAll(createQuery, pageSize = 1000) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery().range(
      from,
      from + pageSize - 1
    );

    if (error) {
      throw error;
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      return rows;
    }
  }
}

loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Variables Supabase manquantes");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const finalApiMatchId = "537390";

const { data: correctedMatches, error: correctionError } =
  await supabase
    .from("matches")
    .update({
      home_score: 0,
      away_score: 0,
      full_time_home_score: 1,
      full_time_away_score: 0,
      extra_time_home_score: 1,
      extra_time_away_score: 0,
      penalty_home_score: null,
      penalty_away_score: null,
      score_duration: "EXTRA_TIME",
      live_status: "AET",
      score_details: {
        halftime: {
          home: 0,
          away: 0,
        },
        regularTime: {
          home: 0,
          away: 0,
        },
        fulltime: {
          home: 1,
          away: 0,
        },
        extratime: {
          home: 1,
          away: 0,
        },
        penalty: {
          home: null,
          away: null,
        },
        manualCorrection:
          "Score reglementaire corrige: 0-0 a 90 min, Espagne 1-0 Argentine apres prolongation.",
      },
    })
    .eq("api_match_id", finalApiMatchId)
    .select("id,concours_id,home_team,away_team");

if (correctionError) {
  throw correctionError;
}

const { data: matches, error: matchesError } = await supabase
  .from("matches")
  .select("id,home_score,away_score,status")
  .eq("status", "finished")
  .not("home_score", "is", null)
  .not("away_score", "is", null);

if (matchesError) {
  throw matchesError;
}

const matchById = new Map(matches.map((match) => [match.id, match]));

const predictions = await fetchAll(() =>
  supabase
    .from("predictions")
    .select(
      "user_id,match_id,pred_home,pred_away,prediction_odds,locked_odds"
    )
    .in("match_id", matches.map((match) => match.id))
);

const pointRows = [];

for (const prediction of predictions) {
  const match = matchById.get(prediction.match_id);

  if (!match) {
    continue;
  }

  const expected = calculatePredictionPoints(prediction, match);

  pointRows.push({
    user_id: prediction.user_id,
    match_id: prediction.match_id,
    points: expected.points,
    exact_score: expected.exact_score,
  });
}

const batchSize = 500;
let upserted = 0;

for (let i = 0; i < pointRows.length; i += batchSize) {
  const { error } = await supabase
    .from("points")
    .upsert(pointRows.slice(i, i + batchSize), {
      onConflict: "user_id,match_id",
    });

  if (error) {
    throw error;
  }

  upserted += pointRows.slice(i, i + batchSize).length;
}

console.log(
  JSON.stringify(
    {
      correctedMatches,
      predictionsRecalculated: predictions.length,
      pointsUpserted: upserted,
    },
    null,
    2
  )
);
