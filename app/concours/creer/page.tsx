"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

export default function CreerConcoursPage() {
  const router = useRouter();

  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [maxJoueurs, setMaxJoueurs] = useState(100);
  const [imageUrl, setImageUrl] = useState("");

  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    verifierAdmin();
  }, []);

  async function verifierAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/connexion");
      return;
    }

    const { data: profil } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profil?.is_admin) {
      router.push("/dashboard");
    }
  }

  async function creerConcours(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setChargement(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Utilisateur non connecté.");
      }

      const codeAcces = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const { error } = await supabase.from("concours").insert({
        nom,
        description,
        code_acces: codeAcces,
        createur: user.id,
        date_debut: dateDebut,
        date_fin: dateFin,
        actif: true,
        max_joueurs: maxJoueurs,
        image_url: imageUrl || null,
      });

      if (error) {
        throw error;
      }

      router.push("/concours");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
  <div className="min-h-screen bg-[#1E3047] text-white flex">
    <Sidebar />

    <main className="flex-1 ml-64 p-10">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-center mb-6">
          <Image
            src="/logo-ej-prono.png"
            alt="EJ Prono"
            width={220}
            height={120}
            priority
          />
        </div>

        <h1 className="text-center text-5xl font-bold text-white mb-10">
          Création d'un concours
        </h1>

        <form onSubmit={creerConcours} className="space-y-6">

          <div>
            <label className="block text-[#D8AA82] font-medium mb-2">
              Nom du concours
            </label>

            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              className="w-full p-4 rounded-lg bg-white text-black border border-gray-300"
            />
          </div>

          <div>
            <label className="block text-[#D8AA82] font-medium mb-2">
              Description
            </label>

            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-4 rounded-lg bg-white text-black border border-gray-300"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">

            <div>
              <label className="block text-[#D8AA82] font-medium mb-2">
                Date de début
              </label>

              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                required
                className="w-full p-4 rounded-lg bg-white text-black border border-gray-300"
              />
            </div>

            <div>
              <label className="block text-[#D8AA82] font-medium mb-2">
                Date de fin
              </label>

              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                required
                className="w-full p-4 rounded-lg bg-white text-black border border-gray-300"
              />
            </div>

          </div>

          <div>
            <label className="block text-[#D8AA82] font-medium mb-2">
              Nombre maximum de joueurs
            </label>

            <input
              type="number"
              min="2"
              value={maxJoueurs}
              onChange={(e) => setMaxJoueurs(Number(e.target.value))}
              className="w-full p-4 rounded-lg bg-white text-black border border-gray-300"
            />
          </div>

          <div>
            <label className="block text-[#D8AA82] font-medium mb-2">
              URL image du concours (optionnel)
            </label>

            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full p-4 rounded-lg bg-white text-black border border-gray-300"
            />
          </div>

          {message && (
            <div className="text-center text-red-400 font-semibold">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full bg-[#D8AA82] hover:bg-[#C89A73] text-white font-bold py-4 rounded-lg transition"
          >
            {chargement ? "Création..." : "Créer le concours"}
          </button>

        </form>
      </div>
    </main>
  </div>
);
}
