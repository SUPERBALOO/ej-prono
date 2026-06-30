type ScoreSide = "home" | "away";

type MatchScore = {
  fullTime?: Record<string, number | null>;
  regularTime?: Record<string, number | null>;
  extraTime?: Record<string, number | null>;
  penalties?: Record<string, number | null>;
  duration?: string | null;
};

function getScoreValue(
  score: MatchScore | null | undefined,
  period:
    | "fullTime"
    | "regularTime"
    | "extraTime"
    | "penalties",
  side: ScoreSide
) {
  return (
    score?.[period]?.[side] ??
    score?.[period]?.[
      side === "home" ? "homeTeam" : "awayTeam"
    ] ??
    null
  );
}

function getMainScoreValue(
  score: MatchScore | null | undefined,
  side: ScoreSide
) {
  return (
    getScoreValue(score, "regularTime", side) ??
    getScoreValue(score, "fullTime", side)
  );
}

export function getMatchScoreUpdate(
  score: MatchScore | null | undefined
) {
  return {
    home_score: getMainScoreValue(score, "home"),
    away_score: getMainScoreValue(score, "away"),
    full_time_home_score: getScoreValue(
      score,
      "fullTime",
      "home"
    ),
    full_time_away_score: getScoreValue(
      score,
      "fullTime",
      "away"
    ),
    extra_time_home_score: getScoreValue(
      score,
      "extraTime",
      "home"
    ),
    extra_time_away_score: getScoreValue(
      score,
      "extraTime",
      "away"
    ),
    penalty_home_score: getScoreValue(
      score,
      "penalties",
      "home"
    ),
    penalty_away_score: getScoreValue(
      score,
      "penalties",
      "away"
    ),
    score_duration: score?.duration ?? null,
    score_details: score ?? null,
  };
}

export function hasScorePair(
  home: number | null | undefined,
  away: number | null | undefined
) {
  return home !== null &&
    home !== undefined &&
    away !== null &&
    away !== undefined;
}

export function scorePairDiffers(
  homeA: number | null | undefined,
  awayA: number | null | undefined,
  homeB: number | null | undefined,
  awayB: number | null | undefined
) {
  return homeA !== homeB || awayA !== awayB;
}
