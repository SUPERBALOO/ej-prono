export type TeamRanking = {
  rank: number;
  points: number;
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
