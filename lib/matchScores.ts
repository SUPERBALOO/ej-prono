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

function subtractScores(
  value: number | null | undefined,
  ...valuesToSubtract: Array<number | null | undefined>
) {
  if (value === null || value === undefined) {
    return null;
  }

  return valuesToSubtract.reduce<number>(
    (currentValue, valueToSubtract) =>
      currentValue - (valueToSubtract ?? 0),
    value
  );
}

function getMainScoreValue(
  score: MatchScore | null | undefined,
  side: ScoreSide
) {
  const regularTime =
    getScoreValue(score, "regularTime", side);

  if (regularTime !== null) {
    return regularTime;
  }

  const fullTime =
    getScoreValue(score, "fullTime", side);

  const extraTime =
    getScoreValue(score, "extraTime", side);

  const penalties =
    getScoreValue(score, "penalties", side);

  if (score?.duration === "PENALTY_SHOOTOUT") {
    return subtractScores(
      fullTime,
      penalties,
      extraTime
    );
  }

  if (score?.duration === "EXTRA_TIME") {
    return subtractScores(fullTime, extraTime);
  }

  return fullTime;
}

export function getStoredAfterExtraTimeScore(match: {
  full_time_home_score?: number | null;
  full_time_away_score?: number | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  if (
    !hasScorePair(
      match.full_time_home_score,
      match.full_time_away_score
    )
  ) {
    return null;
  }

  if (
    hasScorePair(
      match.penalty_home_score,
      match.penalty_away_score
    )
  ) {
    return {
      home: subtractScores(
        match.full_time_home_score,
        match.penalty_home_score
      ),
      away: subtractScores(
        match.full_time_away_score,
        match.penalty_away_score
      ),
    };
  }

  return {
    home: match.full_time_home_score,
    away: match.full_time_away_score,
  };
}

export function getStoredPenaltyScore(match: {
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  if (
    !hasScorePair(
      match.penalty_home_score,
      match.penalty_away_score
    )
  ) {
    return null;
  }

  return {
    home: match.penalty_home_score,
    away: match.penalty_away_score,
  };
}

export function shouldShowAfterExtraTimeScore(match: {
  home_score?: number | null;
  away_score?: number | null;
  full_time_home_score?: number | null;
  full_time_away_score?: number | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  const afterExtraTimeScore =
    getStoredAfterExtraTimeScore(match);

  return !!(
    afterExtraTimeScore &&
    scorePairDiffers(
      afterExtraTimeScore.home,
      afterExtraTimeScore.away,
      match.home_score,
      match.away_score
    )
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
