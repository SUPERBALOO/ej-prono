"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

export default function AjouterMatchPage() {
  const params = useParams();
  const router = useRouter();

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [phase, setPhase] = useState("GROUP_STAGE");
  const [groupe, setGroupe] = useState("GROUP_A");

  async function ajouterMatch() {
    if (!homeTeam || !awayTeam || !matchDate) {
      alert("Tous les champs obligatoires doivent être remplis");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .insert({
        concours_id: params.id,
        home_team: homeTeam,
        away_team: awayTeam,
        match_date: matchDate,
        phase,
        groupe: phase === "GROUP_STAGE" ? groupe : null,
        status: "scheduled",
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Match ajouté");

    router.push(`/concours/${params.id}`);
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-10">
        <div className="max-w-3xl mx-auto">

          <h1 className="text-5xl font-bold mb-8">
            Ajouter un match
          </h1>

          <div className="bg-[#33465D] rounded-3xl p-8 space-y-6">

            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Équipe domicile
              </label>

              <input
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                className="w-full bg-[#42546B] rounded-xl p-4 text-white border border-[#51657D]"
              />
            </div>

            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Équipe extérieure
              </label>

              <input
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                className="w-full bg-[#42546B] rounded-xl p-4 text-white border border-[#51657D]"
              />
            </div>

            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Date du match
              </label>

              <input
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full bg-[#42546B] rounded-xl p-4 text-white border border-[#51657D]"
              />
            </div>

            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Phase
              </label>

              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full bg-[#42546B] rounded-xl p-4 text-white border border-[#51657D]"
              >
                <option value="GROUP_STAGE">Phase de groupes</option>
                <option value="LAST_16">Huitièmes de finale</option>
                <option value="QUARTER_FINALS">Quarts de finale</option>
                <option value="SEMI_FINALS">Demi-finales</option>
                <option value="THIRD_PLACE">Match 3e place</option>
                <option value="FINAL">Finale</option>
              </select>
            </div>

            {phase === "GROUP_STAGE" && (
              <div>
                <label className="block mb-2 text-[#D8AA82]">
                  Groupe
                </label>

                <select
                  value={groupe}
                  onChange={(e) => setGroupe(e.target.value)}
                  className="w-full bg-[#42546B] rounded-xl p-4 text-white border border-[#51657D]"
                >
                  <option value="GROUP_A">Groupe A</option>
                  <option value="GROUP_B">Groupe B</option>
                  <option value="GROUP_C">Groupe C</option>
                  <option value="GROUP_D">Groupe D</option>
                  <option value="GROUP_E">Groupe E</option>
                  <option value="GROUP_F">Groupe F</option>
                  <option value="GROUP_G">Groupe G</option>
                  <option value="GROUP_H">Groupe H</option>
                </select>
              </div>
            )}

            <div className="flex gap-4 pt-4">

              <button
                onClick={ajouterMatch}
                className="bg-[#D8AA82] text-[#1E3047] px-6 py-3 rounded-xl font-bold"
              >
                Enregistrer
              </button>

              <button
                onClick={() => router.back()}
                className="bg-[#42546B] px-6 py-3 rounded-xl font-bold"
              >
                Annuler
              </button>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}