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
  if (match.home_score === null || match.away_score === null) {
    return null;
  }

  const cote =
    Number(
      prediction.locked_odds ??
        prediction.prediction_odds ??
        1
    ) || 1;

  let points = 0;
  let exactScore = false;

  if (
    prediction.pred_home === match.home_score &&
    prediction.pred_away === match.away_score
  ) {
    exactScore = true;
    points = Math.round(100 * cote);
  } else {
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

    if (realResult === predResult) {
      points = Math.round(50 * cote);
    }
  }

  if (points > 0 && isLeMansWin(match)) {
    points *= 2;
  }

  return {
    points,
    exact_score: exactScore,
  };
}

function isLeMansTeam(team) {
  return String(team || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes("le mans");
}

function isLeMansWin(match) {
  return (
    (isLeMansTeam(match.home_team) &&
      match.home_score > match.away_score) ||
    (isLeMansTeam(match.away_team) &&
      match.away_score > match.home_score)
  );
}

function hasTiebreak(match) {
  return (
    match.score_duration === "EXTRA_TIME" ||
    match.score_duration === "PENALTY_SHOOTOUT" ||
    (match.extra_time_home_score !== null &&
      match.extra_time_away_score !== null) ||
    (match.penalty_home_score !== null &&
      match.penalty_away_score !== null)
  );
}

function playerName(profile) {
  return (
    profile?.pseudo ||
    profile?.full_name ||
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ") ||
    profile?.email ||
    "Utilisateur inconnu"
  );
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

const { data: matches, error: matchesError } = await supabase
  .from("matches")
  .select(
    [
      "id",
      "concours_id",
      "api_match_id",
      "home_team",
      "away_team",
      "match_date",
      "status",
      "home_score",
      "away_score",
      "full_time_home_score",
      "full_time_away_score",
      "extra_time_home_score",
      "extra_time_away_score",
      "penalty_home_score",
      "penalty_away_score",
      "score_duration",
      "score_details",
      "live_status",
    ].join(",")
  )
  .eq("status", "finished")
  .order("match_date", { ascending: true });

if (matchesError) {
  throw matchesError;
}

const matchById = new Map(matches.map((match) => [match.id, match]));
const concoursIds = Array.from(
  new Set(matches.map((match) => match.concours_id).filter(Boolean))
);

const { data: concoursRows, error: concoursError } =
  concoursIds.length
    ? await supabase
        .from("concours")
        .select("id,nom")
        .in("id", concoursIds)
    : { data: [], error: null };

if (concoursError) {
  throw concoursError;
}

const concoursById = new Map(
  (concoursRows || []).map((concours) => [concours.id, concours])
);

const predictions = await fetchAll(() =>
  supabase
    .from("predictions")
    .select(
      "id,user_id,match_id,pred_home,pred_away,prediction_odds,locked_odds"
    )
    .in("match_id", matches.map((match) => match.id))
);

const pointsRows = await fetchAll(() =>
  supabase
    .from("points")
    .select("user_id,match_id,points,exact_score")
    .in("match_id", matches.map((match) => match.id))
);

const userIds = Array.from(
  new Set(predictions.map((prediction) => prediction.user_id))
);

const { data: profiles, error: profilesError } =
  userIds.length
    ? await supabase
        .from("profiles")
        .select("id,pseudo,first_name,last_name,company,email")
        .in("id", userIds)
    : { data: [], error: null };

if (profilesError) {
  throw profilesError;
}

const profileById = new Map(
  (profiles || []).map((profile) => [profile.id, profile])
);
const pointsByKey = new Map(
  pointsRows.map((row) => [
    `${row.user_id}:${row.match_id}`,
    row,
  ])
);

const pointMismatches = [];
const totals = new Map();
const totalsByConcours = new Map();

for (const prediction of predictions) {
  const match = matchById.get(prediction.match_id);
  const expected = calculatePredictionPoints(prediction, match);

  if (!expected) {
    continue;
  }

  const current = pointsByKey.get(
    `${prediction.user_id}:${prediction.match_id}`
  );

  if (
    !current ||
    current.points !== expected.points ||
    current.exact_score !== expected.exact_score
  ) {
    pointMismatches.push({
      joueur: playerName(profileById.get(prediction.user_id)),
      match: `${match.home_team} vs ${match.away_team}`,
      prono: `${prediction.pred_home}-${prediction.pred_away}`,
      score: `${match.home_score}-${match.away_score}`,
      attendu: expected.points,
      actuel: current?.points ?? null,
    });
  }

  const total = totals.get(prediction.user_id) || {
    joueur: playerName(profileById.get(prediction.user_id)),
    points: 0,
    bons_pronos: 0,
    scores_exacts: 0,
  };

  total.points += expected.points;
  if (expected.points > 0) {
    total.bons_pronos++;
  }
  if (expected.exact_score) {
    total.scores_exacts++;
  }
  totals.set(prediction.user_id, total);

  const concoursTotalKey = `${match.concours_id}:${prediction.user_id}`;
  const concoursTotal =
    totalsByConcours.get(concoursTotalKey) || {
      concours:
        concoursById.get(match.concours_id)?.nom ??
        match.concours_id,
      joueur: playerName(profileById.get(prediction.user_id)),
      points: 0,
      bons_pronos: 0,
      scores_exacts: 0,
    };

  concoursTotal.points += expected.points;
  if (expected.points > 0) {
    concoursTotal.bons_pronos++;
  }
  if (expected.exact_score) {
    concoursTotal.scores_exacts++;
  }
  totalsByConcours.set(concoursTotalKey, concoursTotal);
}

const suspectTiebreaks = matches.filter(
  (match) =>
    hasTiebreak(match) &&
    match.home_score !== null &&
    match.away_score !== null &&
    match.home_score !== match.away_score
);

const spainArgentina = matches.filter((match) => {
  const label =
    `${match.home_team} ${match.away_team}`.toLowerCase();
  return label.includes("spain") && label.includes("argentina");
});

const ranking = Array.from(totals.values())
  .sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.scores_exacts !== a.scores_exacts) {
      return b.scores_exacts - a.scores_exacts;
    }
    return b.bons_pronos - a.bons_pronos;
  })
  .slice(0, 20);

const rankingByConcours = Object.values(
  Array.from(totalsByConcours.values()).reduce(
    (groups, row) => {
      groups[row.concours] ||= [];
      groups[row.concours].push(row);
      return groups;
    },
    {}
  )
).map((rows) => ({
  concours: rows[0]?.concours,
  top20: rows
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scores_exacts !== a.scores_exacts) {
        return b.scores_exacts - a.scores_exacts;
      }
      return b.bons_pronos - a.bons_pronos;
    })
    .slice(0, 20),
}));

console.log(
  JSON.stringify(
    {
      matchsTermines: matches.length,
      pronosticsVerifies: predictions.length,
      matchsTieBreakSuspects: suspectTiebreaks,
      espagneArgentine: spainArgentina,
      ecartsPoints: pointMismatches.slice(0, 100),
      nombreEcartsPoints: pointMismatches.length,
      top20: ranking,
      top20ParConcours: rankingByConcours,
    },
    null,
    2
  )
);
