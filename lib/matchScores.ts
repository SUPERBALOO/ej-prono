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
  home_score?: number | null;
  away_score?: number | null;
  full_time_home_score?: number | null;
  full_time_away_score?: number | null;
  extra_time_home_score?: number | null;
  extra_time_away_score?: number | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  if (
    hasScorePair(
      match.home_score,
      match.away_score
    )
  ) {
    return {
      home:
        (match.home_score ?? 0) +
        (match.extra_time_home_score ?? 0),
      away:
        (match.away_score ?? 0) +
        (match.extra_time_away_score ?? 0),
    };
  }

  return null;
}

export function getStoredPenaltyScore(match: {
  home_score?: number | null;
  away_score?: number | null;
  full_time_home_score?: number | null;
  full_time_away_score?: number | null;
  extra_time_home_score?: number | null;
  extra_time_away_score?: number | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  const afterExtraTimeScore =
    getStoredAfterExtraTimeScore(match);

  if (
    afterExtraTimeScore &&
    hasScorePair(
      match.full_time_home_score,
      match.full_time_away_score
    )
  ) {
    const derivedHome =
      (match.full_time_home_score ?? 0) -
      (afterExtraTimeScore.home ?? 0);

    const derivedAway =
      (match.full_time_away_score ?? 0) -
      (afterExtraTimeScore.away ?? 0);

    if (
      derivedHome >= 0 &&
      derivedAway >= 0 &&
      (derivedHome !== 0 || derivedAway !== 0)
    ) {
      return {
        home: derivedHome,
        away: derivedAway,
      };
    }
  }

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

export function shouldShowPenaltyScore(match: {
  home_score?: number | null;
  away_score?: number | null;
  full_time_home_score?: number | null;
  full_time_away_score?: number | null;
  extra_time_home_score?: number | null;
  extra_time_away_score?: number | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  const penaltyScore = getStoredPenaltyScore(match);

  return !!(
    penaltyScore &&
    penaltyScore.home !== penaltyScore.away
  );
}

export function shouldShowAfterExtraTimeScore(match: {
  home_score?: number | null;
  away_score?: number | null;
  full_time_home_score?: number | null;
  full_time_away_score?: number | null;
  extra_time_home_score?: number | null;
  extra_time_away_score?: number | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}) {
  const afterExtraTimeScore =
    getStoredAfterExtraTimeScore(match);

  if (
    afterExtraTimeScore &&
    shouldShowPenaltyScore(match)
  ) {
    return true;
  }

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
