"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoadingAnimation from "@/components/LoadingAnimation";
import { supabase } from "@/lib/supabase/client";

type Standing = {
  rank: number; team: string; logo: string | null; played: number;
  wins: number; draws: number; losses: number; goalsFor: number;
  goalsAgainst: number; goalDifference: number; points: number;
  cleanSheets: number; form: Array<"W" | "D" | "L">;
};

type LeagueData = {
  competition: { nom: string; api_season: number };
  standings: Standing[];
  nextFixtures: Array<{ id: string; home_team: string; away_team: string; home_logo: string | null; away_logo: string | null; match_date: string }>;
  leaders: { attack: Standing | null; defense: Standing | null };
  summary: { matchesPlayed: number; totalGoals: number; goalsPerMatch: number; homeWins: number; draws: number; awayWins: number } | null;
};

const formColors = { W: "bg-emerald-500", D: "bg-amber-500", L: "bg-rose-500" };

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <Image src={src} alt={name} width={32} height={32} className="h-8 w-8 object-contain" unoptimized />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D8AA82] text-sm font-bold">{name.charAt(0)}</span>
  );
}

export default function LigueOnePage() {
  const router = useRouter();
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLeague() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/connexion"); return; }
      try {
        const response = await fetch("/api/league-stats", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la Ligue 1");
      }
    }
    void loadLeague();
  }, [router]);

  if (!data && !error) return <LoadingAnimation message="Chargement de la Ligue 1..." fullScreen />;

  return (
    <div className="min-h-screen bg-[#1E3047] text-white">
      <Sidebar />
      <main className="p-4 pt-20 md:ml-64 md:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="font-semibold uppercase tracking-[0.2em] text-[#D8AA82]">Saison {data?.competition.api_season} / {(data?.competition.api_season || 0) + 1}</p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">⚽ Infos Ligue 1</h1>
            <p className="mt-3 text-gray-300">Classement et statistiques calculés à partir des résultats synchronisés.</p>
          </div>

          {error ? <div className="rounded-2xl bg-rose-950/50 p-6 text-rose-200">{error}</div> : data && (
            <>
              <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[["Matchs joués", data.summary?.matchesPlayed ?? 0], ["Buts", data.summary?.totalGoals ?? 0], ["Buts / match", data.summary?.goalsPerMatch ?? 0], ["Matchs nuls", data.summary?.draws ?? 0]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-[#33465D] p-5 shadow-lg"><p className="text-sm text-gray-300">{label}</p><p className="mt-2 text-3xl font-bold text-[#D8AA82]">{value}</p></div>
                ))}
              </section>

              <section className="mb-8 grid gap-4 md:grid-cols-2">
                {[["🔥 Meilleure attaque", data.leaders.attack, `${data.leaders.attack?.goalsFor ?? 0} buts`], ["🛡️ Meilleure défense", data.leaders.defense, `${data.leaders.defense?.goalsAgainst ?? 0} encaissé(s)`]].map(([label, team, stat]) => {
                  const leader = team as Standing | null;
                  return <div key={label as string} className="rounded-2xl bg-[#33465D] p-5"><p className="text-sm text-gray-300">{label as string}</p>{leader && <div className="mt-3 flex items-center gap-3 text-lg font-bold"><TeamLogo src={leader.logo} name={leader.team} /><span>{leader.team}</span><span className="ml-auto text-[#D8AA82]">{stat as string}</span></div>}</div>;
                })}
              </section>

              <section className="mb-8 overflow-hidden rounded-3xl bg-[#33465D] shadow-xl">
                <div className="flex flex-col gap-2 border-b border-[#42536A] p-5 md:flex-row md:items-center md:justify-between md:p-7"><h2 className="text-2xl font-bold">🏆 Classement</h2><span className="text-sm text-gray-300">Forme : 5 derniers matchs</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left">
                    <thead className="bg-[#293B51] text-sm text-gray-300"><tr><th className="px-4 py-3 text-center">#</th><th className="px-4 py-3">Équipe</th>{["J", "G", "N", "P", "BP", "BC", "+/-", "Pts"].map((title) => <th key={title} className="px-3 py-3 text-center">{title}</th>)}<th className="px-4 py-3">Forme</th></tr></thead>
                    <tbody>{data.standings.map((team) => (
                      <tr key={team.team} className={`border-t border-[#42536A] ${team.team.includes("Le Mans") ? "bg-[#D8AA82]/15" : ""}`}>
                        <td className="px-4 py-4 text-center font-bold text-[#D8AA82]">{team.rank}</td>
                        <td className="px-4 py-4"><div className="flex items-center gap-3 font-semibold"><TeamLogo src={team.logo} name={team.team} />{team.team}</div></td>
                        {[team.played, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst].map((value, index) => <td key={index} className="px-3 py-4 text-center">{value}</td>)}
                        <td className="px-3 py-4 text-center">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td><td className="px-4 py-4 text-center text-lg font-bold">{team.points}</td>
                        <td className="px-4 py-4"><div className="flex gap-1">{team.form.length ? team.form.map((result, index) => <span key={index} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${formColors[result]}`}>{result}</span>) : <span className="text-gray-400">—</span>}</div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-3xl bg-[#33465D] p-5 shadow-xl md:p-7">
                <h2 className="mb-5 text-2xl font-bold">📅 Prochains matchs</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.nextFixtures.map((fixture) => (
                  <div key={fixture.id} className="rounded-2xl bg-[#293B51] p-4"><p className="mb-4 text-sm text-[#D8AA82]">{new Date(fixture.match_date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p><div className="flex items-center gap-2 font-semibold"><TeamLogo src={fixture.home_logo} name={fixture.home_team} /><span className="flex-1">{fixture.home_team}</span></div><div className="my-2 text-center text-xs text-gray-400">VS</div><div className="flex items-center gap-2 font-semibold"><TeamLogo src={fixture.away_logo} name={fixture.away_team} /><span className="flex-1">{fixture.away_team}</span></div></div>
                ))}</div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
