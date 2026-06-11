
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

    alert("Match ajouté avec succès");

    router.push(`/concours/${params.id}`);
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 p-4 md:p-10 md:ml-64 pt-20">
        <div className="max-w-3xl mx-auto">

          <h1 className="text-3xl md:text-5xl font-bold mb-6 md:mb-8">
            ➕ Ajouter un match
          </h1>

          <div className="bg-[#33465D] rounded-3xl p-4 md:p-8 space-y-5">

            {/* Equipe domicile */}
            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Équipe domicile
              </label>

              <input
                type="text"
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                placeholder="Ex : France"
                className="
                  w-full
                  bg-[#42546B]
                  rounded-xl
                  p-3 md:p-4
                  border
                  border-[#51657D]
                  text-white
                "
              />
            </div>

            {/* Equipe extérieure */}
            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Équipe extérieure
              </label>

              <input
                type="text"
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                placeholder="Ex : Allemagne"
                className="
                  w-full
                  bg-[#42546B]
                  rounded-xl
                  p-3 md:p-4
                  border
                  border-[#51657D]
                  text-white
                "
              />
            </div>

            {/* Date */}
            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Date du match
              </label>

              <input
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="
                  w-full
                  bg-[#42546B]
                  rounded-xl
                  p-3 md:p-4
                  border
                  border-[#51657D]
                  text-white
                "
              />
            </div>

            {/* Phase */}
            <div>
              <label className="block mb-2 text-[#D8AA82]">
                Phase
              </label>

              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="
                  w-full
                  bg-[#42546B]
                  rounded-xl
                  p-3 md:p-4
                  border
                  border-[#51657D]
                  text-white
                "
              >
                <option value="GROUP_STAGE">
                  Phase de groupes
                </option>

                <option value="LAST_16">
                  Huitièmes de finale
                </option>

                <option value="QUARTER_FINALS">
                  Quarts de finale
                </option>

                <option value="SEMI_FINALS">
                  Demi-finales
                </option>

                <option value="THIRD_PLACE">
                  Match pour la 3ème place
                </option>

                <option value="FINAL">
                  Finale
                </option>
              </select>
            </div>

            {/* Groupe */}
            {phase === "GROUP_STAGE" && (
              <div>
                <label className="block mb-2 text-[#D8AA82]">
                  Groupe
                </label>

                <select
                  value={groupe}
                  onChange={(e) => setGroupe(e.target.value)}
                  className="
                    w-full
                    bg-[#42546B]
                    rounded-xl
                    p-3 md:p-4
                    border
                    border-[#51657D]
                    text-white
                  "
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

            {/* Boutons */}
            <div className="flex flex-col md:flex-row gap-3 pt-4">

              <button
                onClick={ajouterMatch}
                className="
                  w-full md:w-auto
                  bg-[#D8AA82]
                  text-[#1E3047]
                  px-6
                  py-3
                  rounded-xl
                  font-bold
                  hover:opacity-90
                  transition
                "
              >
                💾 Enregistrer
              </button>

              <button
                onClick={() => router.back()}
                className="
                  w-full md:w-auto
                  bg-[#42546B]
                  px-6
                  py-3
                  rounded-xl
                  font-bold
                  hover:bg-[#51657D]
                  transition
                "
              >
                ❌ Annuler
              </button>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}