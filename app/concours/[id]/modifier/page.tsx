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
  const [imageUrl, setImageUrl] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

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
    setImageUrl(data.image_url || "");
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
        image_url: imageUrl || null,
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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Session invalide");
      return;
    }

    const response = await fetch(
      `/api/concours/${params.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Erreur suppression");
      return;
    }

    alert("🗑️ Concours supprimé");
    router.push("/concours");
  }

  if (chargement) {
    return (
      <div className="min-h-screen bg-[#1E3047] text-white flex">
        <Sidebar />

        <main className="flex-1 md:ml-64 flex items-center justify-center">
          Chargement...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 p-4 md:p-10 md:ml-64 pt-20">
        <div className="max-w-4xl mx-auto">

          {/* TITRE */}
          <div className="flex flex-col md:flex-row gap-4 md:justify-between md:items-center mb-8">

            <h1 className="text-3xl md:text-5xl font-bold">
              ⚙️ Modifier le concours
            </h1>

            <button
              onClick={() => router.push(`/concours/${params.id}`)}
              className="
                w-full md:w-auto
                bg-[#314357]
                text-white
                px-5
                py-3
                rounded-xl
                font-semibold
                hover:bg-[#42546B]
                transition
              "
            >
              ← Retour
            </button>

          </div>

          {/* FORMULAIRE */}
          <div className="bg-[#33465D] p-4 md:p-10 rounded-3xl shadow-lg space-y-6 md:space-y-8">

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
                  p-3 md:p-4
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
                  p-3 md:p-4
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
                  p-3 md:p-4
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
                    p-3 md:p-4
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
                    p-3 md:p-4
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
                  p-3 md:p-4
                  rounded-xl
                  bg-[#1E3047]
                  text-white
                  border
                  border-[#4A5D75]
                "
              />
            </div>

            {/* IMAGE */}
            <div>
              <label className="block font-semibold text-[#D8AA82] mb-2">
                Lien de l'image du concours
              </label>

              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
                className="
                  w-full
                  p-3 md:p-4
                  rounded-xl
                  bg-[#1E3047]
                  text-white
                  border
                  border-[#4A5D75]
                "
              />

              <p className="mt-2 text-sm text-gray-300">
                Collez ici un lien direct vers une image en ligne.
              </p>

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={nom || "Concours"}
                  className="mt-3 h-36 w-full rounded-xl object-cover"
                />
              )}
            </div>

            {/* BOUTONS */}
            <div className="flex flex-col md:flex-row gap-3 pt-4">

              <button
                onClick={enregistrer}
                className="
                  w-full md:w-auto
                  bg-[#D8AA82]
                  text-[#1E3047]
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
                  w-full md:w-auto
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
                  w-full md:w-auto
                  bg-red-500
                  text-white
                  px-8
                  py-3
                  rounded-xl
                  font-semibold
                  hover:bg-red-600
                  transition
                  md:ml-auto
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
