"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

export default function ConcoursPage() {
  const [concours, setConcours] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [codeAcces, setCodeAcces] = useState("");

  useEffect(() => {
    chargerConcours();
    verifierAdmin();
  }, []);

  async function verifierAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profil } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
console.log("USER ID :", user.id);
console.log("PROFIL :", profil);
console.log("IS_ADMIN :", profil?.is_admin);
    setIsAdmin(profil?.is_admin || false);
  }

async function chargerConcours() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: profil } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  // ADMIN : voit tous les concours
  if (profil?.is_admin) {
    const { data } = await supabase
      .from("concours")
      .select("*")
      .order("created_at", { ascending: false });

    setConcours(data || []);
    return;
  }

  // JOUEUR : voit uniquement ses concours
  const { data } = await supabase
    .from("participants_concours")
    .select(`
      concours (
        *
      )
    `)
    .eq("joueur_id", user.id);

  const mesConcours =
    data?.map((item: any) => item.concours) || [];

  setConcours(mesConcours);
}

  async function rejoindreConcours() {
  if (!codeAcces.trim()) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    alert("Vous devez être connecté.");
    return;
  }

  // Recherche du concours
  const { data: concours, error } = await supabase
    .from("concours")
    .select("id, nom")
    .eq("code_acces", codeAcces.trim().toUpperCase())
    .single();

  if (error || !concours) {
    alert("Code concours invalide.");
    return;
  }

  // Vérifie si déjà inscrit
  const { data: dejaInscrit } = await supabase
    .from("participants_concours")
    .select("id")
    .eq("concours_id", concours.id)
    .eq("joueur_id", user.id)
    .single();

  if (dejaInscrit) {
    alert("Vous participez déjà à ce concours.");
    return;
  }

  // Ajout du participant
  const { error: insertError } = await supabase
    .from("participants_concours")
    .insert({
      concours_id: concours.id,
      joueur_id: user.id,
      points: 0,
    });

  if (insertError) {
    alert(insertError.message);
    return;
  }

  alert(`Vous avez rejoint "${concours.nom}"`);

  setCodeAcces("");

  chargerConcours();
}

 return (
  <div className="min-h-screen bg-[#1E3047] text-white flex">
    <Sidebar />

    <main className="flex-1 ml-64 p-10">
      <div className="max-w-6xl mx-auto">

        {/* En-tête */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-5xl font-bold text-white">
            🏆 Concours
          </h1>

          {isAdmin && (
            <Link
              href="/concours/creer"
              className="bg-[#D8AA82] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              ➕ Créer un concours
            </Link>
          )}
        </div>

        {/* Rejoindre */}
        <div className="bg-[#33465D] rounded-2xl p-6 mb-10 shadow-lg">
          <h2 className="text-3xl font-bold text-white mb-6">
            Rejoindre un concours
          </h2>

          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Code d'accès"
              value={codeAcces}
              onChange={(e) => setCodeAcces(e.target.value)}
              className="flex-1 p-4 rounded-lg bg-white text-black border border-gray-300"
            />

            <button
              onClick={rejoindreConcours}
              className="bg-[#D8AA82] text-white px-6 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Rejoindre
            </button>
          </div>
        </div>

        {/* Mes concours */}
        <h2 className="text-3xl font-bold text-white mb-6">
          Mes concours
        </h2>

        {concours.length === 0 ? (
          <div className="bg-[#33465D] rounded-2xl p-8 text-center">
            <p className="text-gray-300">
              Aucun concours disponible.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {concours.map((concours) => (
              <div
                key={concours.id}
                className="bg-[#33465D] rounded-2xl p-6 shadow-lg hover:scale-[1.02] transition"
              >
                <h3 className="text-2xl font-bold text-white mb-3">
                  {concours.nom}
                </h3>

               {isAdmin && (
  <p className="text-[#D8AA82] font-semibold mb-3">
    Code : {concours.code_acces}
  </p>
)}

                {concours.description && (
                  <p className="text-gray-300 mb-4">
                    {concours.description}
                  </p>
                )}

                <div className="flex justify-between items-center text-sm text-gray-400">
                  <span>
                    👥 {concours.max_joueurs || "Illimité"}
                  </span>

                  <span>
                    {new Date(
                      concours.date_debut
                    ).toLocaleDateString("fr-FR")}
                  </span>
                </div>

                <Link
                  href={`/concours/${concours.id}`}
                  className="block mt-5 text-center bg-[#D8AA82] text-white py-2 rounded-lg font-medium hover:opacity-90 transition"
                >
                  Ouvrir
                </Link>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  </div>
);
}
