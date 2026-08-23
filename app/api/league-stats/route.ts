import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeTeamName } from "@/lib/odds";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MatchRow = {
  id: string;
  api_match_id?: string | null;
  home_team: string;
  away_team: string;
  home_logo?: string | null;
  away_logo?: string | null;
  match_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

type TeamStats = {
  team: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  cleanSheets: number;
  form: Array<"W" | "D" | "L">;
};

function getFixtureKey(match: MatchRow) {
  return match.api_match_id || `${normalizeTeamName(match.home_team)}|${normalizeTeamName(match.away_team)}|${match.match_date}`;
}

export async function GET() {
  try {
    const { data: competitions, error: competitionError } = await supabase
      .from("competitions")
      .select("id,nom,api_season")
      .eq("api_league_id", 61)
      .order("api_season", { ascending: false })
      .limit(1);
    if (competitionError || !competitions?.[0]) {
      throw competitionError || new Error("Ligue 1 introuvable");
    }

    const competition = competitions[0];
    const { data: contests, error: contestsError } = await supabase
      .from("concours")
      .select("id")
      .eq("competition_id", competition.id);
    if (contestsError) throw contestsError;

    const contestIds = (contests || []).map((contest) => contest.id);
    if (!contestIds.length) {
      return NextResponse.json({ competition, standings: [], nextFixtures: [], summary: null });
    }

    const { data: matchRows, error: matchesError } = await supabase
      .from("matches")
      .select("id,api_match_id,home_team,away_team,home_logo,away_logo,match_date,status,home_score,away_score")
      .in("concours_id", contestIds)
      .order("match_date", { ascending: true });
    if (matchesError) throw matchesError;

    const uniqueMatches = new Map<string, MatchRow>();
    for (const match of (matchRows || []) as MatchRow[]) uniqueMatches.set(getFixtureKey(match), match);
    const matches = [...uniqueMatches.values()];
    const teams = new Map<string, TeamStats>();

    function getTeam(name: string, logo?: string | null) {
      const key = normalizeTeamName(name);
      const existing = teams.get(key);
      if (existing) {
        if (!existing.logo && logo) existing.logo = logo;
        return existing;
      }
      const created: TeamStats = { team: name, logo: logo || null, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, cleanSheets: 0, form: [] };
      teams.set(key, created);
      return created;
    }

    for (const match of matches) {
      getTeam(match.home_team, match.home_logo);
      getTeam(match.away_team, match.away_logo);
    }

    const finishedMatches = matches.filter((match) => match.status === "finished" && match.home_score != null && match.away_score != null);
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalGoals = 0;

    for (const match of finishedMatches) {
      const home = getTeam(match.home_team, match.home_logo);
      const away = getTeam(match.away_team, match.away_logo);
      const homeScore = match.home_score as number;
      const awayScore = match.away_score as number;
      home.played++;
      away.played++;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;
      if (awayScore === 0) home.cleanSheets++;
      if (homeScore === 0) away.cleanSheets++;
      totalGoals += homeScore + awayScore;

      if (homeScore > awayScore) {
        home.wins++; home.points += 3; home.form.push("W");
        away.losses++; away.form.push("L"); homeWins++;
      } else if (homeScore < awayScore) {
        away.wins++; away.points += 3; away.form.push("W");
        home.losses++; home.form.push("L"); awayWins++;
      } else {
        home.draws++; away.draws++; home.points++; away.points++;
        home.form.push("D"); away.form.push("D"); draws++;
      }
    }

    const standings = [...teams.values()]
      .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
      .map((team, index) => ({ ...team, rank: index + 1, goalDifference: team.goalsFor - team.goalsAgainst, form: team.form.slice(-5) }));
    const now = Date.now();
    const nextFixtures = matches.filter((match) => match.status !== "finished" && new Date(match.match_date).getTime() >= now).slice(0, 6);
    const byAttack = [...standings].sort((a, b) => b.goalsFor - a.goalsFor || a.played - b.played);
    const byDefense = [...standings].filter((team) => team.played > 0).sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.cleanSheets - a.cleanSheets);

    return NextResponse.json({
      competition,
      standings,
      nextFixtures,
      leaders: { attack: byAttack[0] || null, defense: byDefense[0] || null },
      summary: {
        matchesPlayed: finishedMatches.length,
        totalGoals,
        goalsPerMatch: finishedMatches.length ? Number((totalGoals / finishedMatches.length).toFixed(2)) : 0,
        homeWins,
        draws,
        awayWins,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
