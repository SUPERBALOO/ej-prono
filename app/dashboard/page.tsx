"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../../lib/supabase/client";
import AdminPushPanel from "@/components/AdminPushPanel";
import InstallAppButton from "@/components/InstallAppButton";

export default function DashboardPage() {
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    chargerProfil();

    // Synchronisation automatique des résultats
    fetch("/api/sync-results").catch((err) =>
      console.error("Erreur sync-results :", err)
    );
  }, []);

  async function chargerProfil() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/connexion");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setPseudo(data.pseudo);
      setIsAdmin(data.is_admin);
    }
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.push("/connexion");
  }

  return (
    <main className="min-h-screen bg-[#1E3047] text-white flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#314357] flex flex-col">
        <div className="p-6 text-center border-b border-[#42546B]">
          <Image
            src="/logo-ej-prono.png"
            alt="EJ Prono"
            width={140}
            height={80}
            className="mx-auto"
          />

          <h2 className="text-3xl font-bold text-[#C7A27F] mt-4">
            EJ Prono
          </h2>
        </div>

        <nav className="flex flex-col gap-2 p-4">
          <Link
            href="/dashboard"
            className="p-3 rounded hover:bg-[#42546B]"
          >
            📊 Dashboard
          </Link>

          <Link
            href="/concours"
            className="p-3 rounded hover:bg-[#42546B]"
          >
            🏆 Concours
          </Link>

          <Link 
          href="/concours"
            className="p-3 rounded hover:bg-[#42546B]"
          >
            📝 Pronostics
          </Link>

          <Link 
          href="/concours"
            className="p-3 rounded hover:bg-[#42546B]"
          >
            🥇 Classement
          </Link>

          <Link
            href="/profil"
            className="p-3 rounded hover:bg-[#42546B]"
          >
            👤 Mon Profil
          </Link>
        </nav>

        <div className="p-4">
          <InstallAppButton />
        </div>
      </aside>

      {/* CONTENU */}
      <section className="flex-1">
        <header className="bg-[#314357] px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#C7A27F]">
              Dashboard
            </h1>
          </div>

          <button
            onClick={deconnexion}
            className="bg-[#C7A27F] text-white px-5 py-2 rounded-lg hover:opacity-90"
          >
            Déconnexion
          </button>
        </header>

        <div className="p-8">
          <h2 className="text-5xl font-bold mb-3">
            Bonjour {pseudo} 👋
          </h2>

          <p className="text-[#C7A27F] mb-8">
            Bienvenue sur EJ Prono
          </p>

          {isAdmin && (
            <div className="bg-[#314357] p-6 rounded-xl mb-8">
              <h3 className="text-2xl font-bold mb-4">
                Administration
              </h3>

              <Link
                href="/concours/creer"
                className="inline-block bg-[#C7A27F] px-5 py-3 rounded-lg font-semibold"
              >
                ➕ Créer un concours
              </Link>

              <AdminPushPanel />
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#314357] p-6 rounded-xl">
              <h3 className="text-2xl font-bold mb-3">
                🏆 Mes concours
              </h3>

              <p className="text-gray-300 mb-4">
                Consultez vos concours actifs.
              </p>

              <Link
                href="/concours"
                className="text-[#C7A27F]"
              >
                Voir les concours →
              </Link>
            </div>

            <div className="bg-[#314357] p-6 rounded-xl">
              <h3 className="text-2xl font-bold mb-3">
                📝 Mes pronostics
              </h3>

              <p className="text-gray-300 mb-4">
                Gérez vos pronostics.
              </p>

              <Link
                href="/pronostics"
                className="text-[#C7A27F]"
              >
                Voir mes pronostics →
              </Link>
            </div>

            <div className="bg-[#314357] p-6 rounded-xl">
              <h3 className="text-2xl font-bold mb-3">
                🥇 Classement
              </h3>

              <p className="text-gray-300 mb-4">
                Consultez votre position.
              </p>

              <Link
                href="/classement"
                className="text-[#C7A27F]"
              >
                Voir le classement →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
