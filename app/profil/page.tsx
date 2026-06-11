"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";

export default function ProfilPage() {
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [createdAt, setCreatedAt] = useState("");

  const [message, setMessage] = useState("");
  const [messageSecurite, setMessageSecurite] = useState("");

  const [nouveauMotDePasse, setNouveauMotDePasse] =
    useState("");

  useEffect(() => {
    chargerProfil();
  }, []);

  const chargerProfil = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/connexion");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setPseudo(data.pseudo || "");
      setEmail(data.email || "");
      setIsAdmin(data.is_admin);
      setCreatedAt(data.created_at);
    }
  };

  const enregistrerPseudo = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        pseudo,
      })
      .eq("id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Profil mis à jour avec succès. Retour au dashboard..."
    );

    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  const changerMotDePasse = async () => {
    if (nouveauMotDePasse.length < 6) {
      setMessageSecurite(
        "Le mot de passe doit contenir au moins 6 caractères."
      );
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: nouveauMotDePasse,
    });

    if (error) {
      setMessageSecurite(error.message);
    } else {
      setMessageSecurite(
        "Mot de passe modifié avec succès."
      );

      setNouveauMotDePasse("");
    }
  };

  
  return (
    
  <div className="min-h-screen bg-[#1E3047] flex">
    <Sidebar />

    <main className="flex-1 ml-64">
      <div className="min-h-screen bg-[#182738] text-white">
        <div className="max-w-4xl mx-auto p-8">

        <div className="flex justify-center mb-8">
          <Image
            src="/logo-ej-prono.png"
            alt="EJ Prono"
            width={180}
            height={180}
            priority
          />
        </div>

        <h1 className="text-5xl font-bold text-center mb-10">
          Mon Profil
        </h1>

        {/* PROFIL */}

        <div className="bg-[#2d3b4b] rounded-xl p-8 shadow-lg">

          <div className="mb-6">
            <label className="block mb-2 text-[#c9a27e]">
              Pseudo
            </label>

            <input
              type="text"
              value={pseudo}
              onChange={(e) =>
                setPseudo(e.target.value)
              }
              className="w-full p-3 rounded-lg bg-white text-black"
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-[#c9a27e]">
              Email
            </label>

            <input
              type="text"
              value={email}
              disabled
              className="w-full p-3 rounded-lg bg-gray-300 text-gray-700"
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-[#c9a27e]">
              Rôle
            </label>

            <div className="p-3 rounded-lg bg-[#223246]">
              {isAdmin
                ? "Administrateur"
                : "Joueur"}
            </div>
          </div>

          <div className="mb-8">
            <label className="block mb-2 text-[#c9a27e]">
              Inscrit depuis
            </label>

            <div className="p-3 rounded-lg bg-[#223246]">
              {createdAt
                ? new Date(
                    createdAt
                  ).toLocaleDateString("fr-FR")
                : ""}
            </div>
          </div>

          <div className="flex gap-4">

            <button
              onClick={enregistrerPseudo}
              className="px-6 py-3 rounded-lg bg-[#c9a27e] hover:bg-[#b58d69] transition"
            >
              Enregistrer
            </button>

            <button
              onClick={() =>
                router.push("/dashboard")
              }
              className="px-6 py-3 rounded-lg bg-[#223246] hover:bg-[#1a2838] transition"
            >
              Retour Dashboard
            </button>

          </div>

          {message && (
            <p className="mt-4 text-green-400">
              {message}
            </p>
          )}
        </div>

        {/* SECURITE */}

        <div className="mt-8 bg-[#2d3b4b] rounded-xl p-8 shadow-lg">

          <h2 className="text-3xl font-bold mb-6">
            Sécurité du compte
          </h2>

          <div className="mb-6">
            <label className="block mb-2 text-[#c9a27e]">
              Nouveau mot de passe
            </label>

            <input
              type="password"
              value={nouveauMotDePasse}
              onChange={(e) =>
                setNouveauMotDePasse(
                  e.target.value
                )
              }
              className="w-full p-3 rounded-lg bg-white text-black"
              placeholder="Nouveau mot de passe"
            />
          </div>

          <div className="flex flex-wrap gap-4">

            <button
              onClick={changerMotDePasse}
              className="px-6 py-3 rounded-lg bg-[#c9a27e] hover:bg-[#b58d69]"
            >
              Modifier le mot de passe
            </button>

            <button
            onClick={() => router.push("/mot-de-passe-oublie")}
            className="px-6 py-3 rounded-lg bg-[#223246] hover:bg-[#1a2838]"
            >
            Mot de passe oublié
            </button>

          </div>

          {messageSecurite && (
            <p className="mt-4 text-green-400">
              {messageSecurite}
            </p>
          )}
        </div>

        </div>
      </div>
    </main>
  </div>
);
}