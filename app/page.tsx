"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const [participants, setParticipants] = useState(0);
  const [concours, setConcours] = useState(0);
  const [pronostics, setPronostics] = useState(0);

  useEffect(() => {
    chargerStats();
  }, []);

  async function chargerStats() {
    try {
      const {
        count: nbParticipants,
        error: errParticipants,
      } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const {
        count: nbConcours,
        error: errConcours,
      } = await supabase
        .from("concours")
        .select("*", { count: "exact", head: true });

      const {
        count: nbPronostics,
        error: errPronostics,
      } = await supabase
        .from("predictions")
        .select("*", { count: "exact", head: true });

      console.log("Participants :", nbParticipants, errParticipants);
      console.log("Concours :", nbConcours, errConcours);
      console.log("Pronostics :", nbPronostics, errPronostics);

      setParticipants(nbParticipants || 0);
      setConcours(nbConcours || 0);
      setPronostics(nbPronostics || 0);
    } catch (error) {
      console.error("Erreur chargement statistiques :", error);
    }
  }

  return (
    <main className="min-h-screen bg-[#1F2933] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-ej-prono.png"
            alt="EJ Prono"
            width={350}
            height={180}
            priority
          />
        </div>

        {/* Carte principale */}
        <div className="bg-[#2F3A44] rounded-2xl shadow-2xl p-10 text-center">

          <h1 className="text-5xl font-bold text-white mb-4">
            EJ Prono
          </h1>

          <p className="text-[#C19A7A] text-xl mb-2">
            Pronostiquez • Compétitionnez • Gagnez
          </p>

          <p className="text-gray-300 mb-10">
            À vos pronostics...
          </p>

          {/* Boutons */}
          <div className="flex flex-col md:flex-row justify-center gap-4 mb-10">

            <Link
              href="/connexion"
              className="bg-[#C19A7A] hover:bg-[#b48764] text-white px-8 py-3 rounded-lg font-semibold transition"
            >
              Se connecter
            </Link>

            <Link
              href="/inscription"
              className="border-2 border-[#C19A7A] text-[#C19A7A] hover:bg-[#C19A7A] hover:text-white px-8 py-3 rounded-lg font-semibold transition"
            >
              Créer un compte
            </Link>

          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="bg-[#1F2933] rounded-xl p-6">
              <p className="text-4xl font-bold text-[#C19A7A]">
                {participants}
              </p>
              <p className="text-white">
                Participants
              </p>
            </div>

            <div className="bg-[#1F2933] rounded-xl p-6">
              <p className="text-4xl font-bold text-[#C19A7A]">
                {concours}
              </p>
              <p className="text-white">
                Concours actifs
              </p>
            </div>

            <div className="bg-[#1F2933] rounded-xl p-6">
              <p className="text-4xl font-bold text-[#C19A7A]">
                {pronostics}
              </p>
              <p className="text-white">
                Pronostics
              </p>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}