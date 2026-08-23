export type TeamRanking = {
  rank: number;
  points: number;
};

export type TeamStrength = {
  rank: number;
  points: number;
  homeBonus: number;
};

export type CompletedClubMatch = {
  home_team: string;
  away_team: string;
  match_date: string;
  home_score: number | null;
  away_score: number | null;
  status?: string | null;
};

export function normalizeTeamName(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\./g, "")
    .replace(/[\u2019`]/g, "'")
    .replace(/\s+/g, " ");

  const mapping: Record<string, string> = {
    "south korea": "korea republic",
    iran: "ir iran",
    "united states": "usa",
    "united states of america": "usa",
    "ivory coast": "cote d'ivoire",
    turkey: "turkiye",
    "bosnia-herzegovina": "bosnia and herzegovina",
    "bosnia herzegovina": "bosnia and herzegovina",
    "dr congo": "congo dr",
    "congo democratic republic": "congo dr",
    czechia: "czech republic",
    "cape verde islands": "cape verde",
    "cabo verde": "cape verde",
  };

  return mapping[normalized] || normalized;
}

export function calculateOdds(
  homePoints: number,
  awayPoints: number
) {
  const diff = Math.abs(homePoints - awayPoints);

  const expectedHome =
    1 /
    (1 +
      Math.pow(
        10,
        (awayPoints - homePoints) / 600
      ));

  const expectedAway = 1 - expectedHome;

  let drawProbability = 0.30 - diff / 3000;

  drawProbability = Math.max(
    0.18,
    Math.min(0.30, drawProbability)
  );

  const remaining = 1 - drawProbability;

  const homeProbability = expectedHome * remaining;
  const awayProbability = expectedAway * remaining;

  return {
    homeProbability,
    drawProbability,
    awayProbability,
    coteHome: Number((1 / homeProbability).toFixed(2)),
    coteDraw: Number((1 / drawProbability).toFixed(2)),
    coteAway: Number((1 / awayProbability).toFixed(2)),
  };
}

export function buildRankingsMap(
  rankings: Array<{
    team_name: string;
    fifa_rank: number;
    fifa_points: number;
  }>
) {
  const rankingsMap = new Map<string, TeamRanking>();

  for (const team of rankings) {
    rankingsMap.set(normalizeTeamName(team.team_name), {
      rank: team.fifa_rank,
      points: team.fifa_points,
    });
  }

  return rankingsMap;
}

function getStrengthPointsFromRank(rank: number) {
  return Math.max(1150, 1850 - (rank - 1) * 35);
}

export function buildTeamStrengthMap(
  rankings: Array<{
    team_name: string;
    previous_rank?: number | null;
    rank?: number | null;
    strength_points?: number | null;
    points?: number | null;
    home_bonus_points?: number | null;
  }>
) {
  const strengthsMap = new Map<string, TeamStrength>();

  for (const team of rankings) {
    const rank = team.previous_rank ?? team.rank;

    if (!team.team_name || !rank) {
      continue;
    }

    strengthsMap.set(normalizeTeamName(team.team_name), {
      rank,
      points:
        team.strength_points ??
        team.points ??
        getStrengthPointsFromRank(rank),
      homeBonus: team.home_bonus_points ?? 60,
    });
  }

  return strengthsMap;
}

export function getMatchOddsUpdate(
  match: {
    home_team: string;
    away_team: string;
  },
  rankingsMap: Map<string, TeamRanking>
) {
  const home = rankingsMap.get(
    normalizeTeamName(match.home_team)
  );

  const away = rankingsMap.get(
    normalizeTeamName(match.away_team)
  );

  if (!home || !away) {
    return null;
  }

  const odds = calculateOdds(home.points, away.points);

  return {
    fifa_home_points: home.points,
    fifa_away_points: away.points,
    home_probability: odds.homeProbability,
    draw_probability: odds.drawProbability,
    away_probability: odds.awayProbability,
    cote_home: odds.coteHome,
    cote_draw: odds.coteDraw,
    cote_away: odds.coteAway,
    odds_updated_at: new Date().toISOString(),
  };
}

export function getClubMatchOddsUpdate(
  match: {
    home_team: string;
    away_team: string;
  },
  strengthsMap: Map<string, TeamStrength>
) {
  const home = strengthsMap.get(
    normalizeTeamName(match.home_team)
  );

  const away = strengthsMap.get(
    normalizeTeamName(match.away_team)
  );

  if (!home || !away) {
    return null;
  }

  const homePoints = home.points + home.homeBonus;
  const awayPoints = away.points;
  const odds = calculateOdds(homePoints, awayPoints);

  return {
    fifa_home_points: homePoints,
    fifa_away_points: awayPoints,
    home_probability: odds.homeProbability,
    draw_probability: odds.drawProbability,
    away_probability: odds.awayProbability,
    cote_home: odds.coteHome,
    cote_draw: odds.coteDraw,
    cote_away: odds.coteAway,
    odds_updated_at: new Date().toISOString(),
  };
}

type CurrentTeamStats = {
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  recent: Array<{
    date: number;
    points: number;
    goalDifference: number;
  }>;
};

function getCurrentTeamStats(
  matches: CompletedClubMatch[],
  beforeDate: string
) {
  const stats = new Map<string, CurrentTeamStats>();
  const cutoff = new Date(beforeDate).getTime();

  function getTeam(teamName: string) {
    const key = normalizeTeamName(teamName);
    const existing = stats.get(key);
    if (existing) return existing;

    const created: CurrentTeamStats = {
      played: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      recent: [],
    };
    stats.set(key, created);
    return created;
  }

  for (const match of matches) {
    const matchTime = new Date(match.match_date).getTime();
    if (
      !Number.isFinite(matchTime) ||
      matchTime >= cutoff ||
      match.home_score == null ||
      match.away_score == null ||
      (match.status && match.status !== "finished")
    ) {
      continue;
    }

    const home = getTeam(match.home_team);
    const away = getTeam(match.away_team);
    const homePoints =
      match.home_score > match.away_score
        ? 3
        : match.home_score === match.away_score
          ? 1
          : 0;
    const awayPoints =
      match.away_score > match.home_score
        ? 3
        : match.away_score === match.home_score
          ? 1
          : 0;

    home.played++;
    home.points += homePoints;
    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    home.recent.push({
      date: matchTime,
      points: homePoints,
      goalDifference: match.home_score - match.away_score,
    });

    away.played++;
    away.points += awayPoints;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;
    away.recent.push({
      date: matchTime,
      points: awayPoints,
      goalDifference: match.away_score - match.home_score,
    });
  }

  return stats;
}

function getFormAdjustment(stats?: CurrentTeamStats) {
  if (!stats?.recent.length) return 0;

  const recent = [...stats.recent]
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);
  const pointsPerGame =
    recent.reduce((total, result) => total + result.points, 0) /
    recent.length;
  const goalDifferencePerGame =
    recent.reduce(
      (total, result) => total + result.goalDifference,
      0
    ) / recent.length;
  const reliability = recent.length / 5;
  const pointsAdjustment =
    ((pointsPerGame - 1.5) / 1.5) * 90;
  const goalAdjustment =
    (Math.max(-2, Math.min(2, goalDifferencePerGame)) / 2) *
    30;

  return (pointsAdjustment + goalAdjustment) * reliability;
}

export function buildCurrentSeasonStrengthMap(
  previousStrengths: Map<string, TeamStrength>,
  completedMatches: CompletedClubMatch[],
  beforeDate: string
) {
  const currentStats = getCurrentTeamStats(
    completedMatches,
    beforeDate
  );
  const rankedTeams = [...currentStats.entries()].sort(
    ([nameA, a], [nameB, b]) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst -
        (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      nameA.localeCompare(nameB)
  );
  const currentRanks = new Map(
    rankedTeams.map(([teamName], index) => [teamName, index + 1])
  );
  const dynamicStrengths = new Map<string, TeamStrength>();

  for (const [teamName, previous] of previousStrengths) {
    const stats = currentStats.get(teamName);
    const currentRank = currentRanks.get(teamName);
    if (!stats || !currentRank) {
      dynamicStrengths.set(teamName, previous);
      continue;
    }

    const currentStandingWeight = Math.min(
      0.65,
      (stats.played / 8) * 0.65
    );
    const currentStrength = getStrengthPointsFromRank(currentRank);
    const blendedStrength =
      previous.points * (1 - currentStandingWeight) +
      currentStrength * currentStandingWeight +
      getFormAdjustment(stats);

    dynamicStrengths.set(teamName, {
      rank: currentRank,
      points: blendedStrength,
      homeBonus: previous.homeBonus,
    });
  }

  return dynamicStrengths;
}

export function getDynamicClubMatchOddsUpdate(
  match: {
    home_team: string;
    away_team: string;
    match_date: string;
  },
  previousStrengths: Map<string, TeamStrength>,
  completedMatches: CompletedClubMatch[]
) {
  const strengths = buildCurrentSeasonStrengthMap(
    previousStrengths,
    completedMatches,
    match.match_date
  );
  return getClubMatchOddsUpdate(match, strengths);
}

export function applyPlayerInfluence(
  baseline: {
    home_probability: number;
    draw_probability: number;
    away_probability: number;
  },
  choices: { home: number; draw: number; away: number }
) {
  const total = choices.home + choices.draw + choices.away;
  if (total < 2) return null;

  const playerWeight = Math.min(0.25, total / (total + 40));
  const homeProbability =
    baseline.home_probability * (1 - playerWeight) +
    (choices.home / total) * playerWeight;
  const drawProbability =
    baseline.draw_probability * (1 - playerWeight) +
    (choices.draw / total) * playerWeight;
  const awayProbability =
    baseline.away_probability * (1 - playerWeight) +
    (choices.away / total) * playerWeight;

  return {
    cote_home: Number((1 / homeProbability).toFixed(2)),
    cote_draw: Number((1 / drawProbability).toFixed(2)),
    cote_away: Number((1 / awayProbability).toFixed(2)),
    playerWeight,
    predictionsCount: total,
  };
}
