"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

export default function ModifierConcoursPage() {
  const params = useParams();
  const router = useRouter();

  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [maxJoueurs, setMaxJoueurs] = useState(100);
  const [chargement, setChargement] = useState(true);
  const [competitionId, setCompetitionId] = useState("");
  const [competitions, setCompetitions] = useState<any[]>([]);

  useEffect(() => {
    chargerConcours();
      chargerCompetitions();
  }, []);


  async function chargerCompetitions() {
  const { data } = await supabase
    .from("competitions")
    .select("*")
    .eq("actif", true)
    .order("nom");

  setCompetitions(data || []);
}
  async function chargerConcours() {
    
    const { data } = await supabase
      .from("concours")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!data) return;

    setNom(data.nom || "");
    setDescription(data.description || "");
    setDateDebut(data.date_debut?.substring(0, 10));
    setDateFin(data.date_fin?.substring(0, 10));
    setMaxJoueurs(data.max_joueurs || 100);
    setCompetitionId(data.competition_id || "");
    setChargement(false);
  }

  async function enregistrer() {
    const { error } = await supabase
      .from("concours")
      .update({
        nom,
        description,
        date_debut: dateDebut,
        date_fin: dateFin,
        max_joueurs: maxJoueurs,
        competition_id: competitionId,
      })
      .eq("id", params.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("✅ Concours mis à jour");
    router.push(`/concours/${params.id}`);
  }

  async function supprimerConcours() {
    const confirmation = confirm(
      "Êtes-vous sûr de vouloir supprimer ce concours ?"
    );

    if (!confirmation) return;

    const { error } = await supabase
      .from("concours")
      .delete()
      .eq("id", params.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("🗑️ Concours supprimé");
    router.push("/concours");
  }

  if (chargement) {
    return (
      <div className="min-h-screen bg-[#1E3047] text-white flex">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          Chargement...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-10 pt-16">
        <div className="max-w-4xl mx-auto">

          {/* TITRE */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-5xl font-bold">
              ⚙️ Modifier le concours
            </h1>

            <button
              onClick={() => router.push(`/concours/${params.id}`)}
              className="bg-[#314357] text-white px-5 py-3 rounded-xl font-semibold hover:bg-[#42546B] transition"
            >
              ← Retour
            </button>
          </div>

          {/* FORMULAIRE */}
          <div className="bg-[#33465D] p-10 rounded-3xl shadow-lg space-y-8">

            {/* NOM */}
            <div>
              <label className="block font-semibold text-[#D8AA82] mb-2">
                Nom du concours
              </label>

              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="
                  w-full
                  p-4
                  rounded-xl
                  bg-[#1E3047]
                  text-white
                  border
                  border-[#4A5D75]
                  focus:border-[#D8AA82]
                  focus:outline-none
                "
              />
            </div>
            {/* COMPETITION */}
            <div>
             <label className="block font-semibold text-[#D8AA82] mb-2">
             Compétition officielle
                </label>

                <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                className="
                 w-full
                 p-4
                 rounded-xl
                 bg-[#1E3047]
                text-white
                border
                border-[#4A5D75]
                focus:border-[#D8AA82]
                focus:outline-none
                "
            >
                <option value="">
            Sélectionner une compétition
                </option>

            {competitions.map((competition) => (
            <option
                key={competition.id}
                value={competition.id}
            >
                {competition.nom}
            </option>
            ))}
            </select>
            </div>
            {/* DESCRIPTION */}
            <div>
              <label className="block font-semibold text-[#D8AA82] mb-2">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="
                  w-full
                  p-4
                  rounded-xl
                  bg-[#1E3047]
                  text-white
                  border
                  border-[#4A5D75]
                  focus:border-[#D8AA82]
                  focus:outline-none
                "
              />
            </div>

            {/* DATES */}
            <div className="grid md:grid-cols-2 gap-6">

              <div>
                <label className="block font-semibold text-[#D8AA82] mb-2">
                  Date de début
                </label>

                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="
                    w-full
                    p-4
                    rounded-xl
                    bg-[#1E3047]
                    text-white
                    border
                    border-[#4A5D75]
                  "
                />
              </div>

              <div>
                <label className="block font-semibold text-[#D8AA82] mb-2">
                  Date de fin
                </label>

                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="
                    w-full
                    p-4
                    rounded-xl
                    bg-[#1E3047]
                    text-white
                    border
                    border-[#4A5D75]
                  "
                />
              </div>

            </div>

            {/* MAX JOUEURS */}
            <div>
              <label className="block font-semibold text-[#D8AA82] mb-2">
                Nombre maximum de joueurs
              </label>

              <input
                type="number"
                value={maxJoueurs}
                onChange={(e) =>
                  setMaxJoueurs(Number(e.target.value))
                }
                className="
                  w-full
                  p-4
                  rounded-xl
                  bg-[#1E3047]
                  text-white
                  border
                  border-[#4A5D75]
                "
              />
            </div>

            {/* BOUTONS */}
            <div className="flex flex-wrap gap-4 pt-4">

              <button
                onClick={enregistrer}
                className="
                  bg-[#D8AA82]
                  text-white
                  px-8
                  py-3
                  rounded-xl
                  font-semibold
                  hover:opacity-90
                  transition
                "
              >
                💾 Enregistrer
              </button>

              <button
                onClick={() => router.back()}
                className="
                  bg-[#314357]
                  text-white
                  px-8
                  py-3
                  rounded-xl
                  font-semibold
                  hover:bg-[#42546B]
                  transition
                "
              >
                Annuler
              </button>

              <button
                onClick={supprimerConcours}
                className="
                  bg-red-500
                  text-white
                  px-8
                  py-3
                  rounded-xl
                  font-semibold
                  hover:bg-red-600
                  transition
                  ml-auto
                "
              >
                🗑️ Supprimer
              </button>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}