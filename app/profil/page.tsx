"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import PushReminderButton from "@/components/PushReminderButton";

export default function ProfilPage() {
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
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
      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setCompany(data.company || "");
      setAvatarUrl(data.avatar_url || "");
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
        first_name: firstName || null,
        last_name: lastName || null,
        company: company || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    if (error) {
      const missingProfileColumn =
        error.code === "PGRST204" ||
        error.code === "42703" ||
        ["avatar_url", "first_name", "last_name", "company"].some(
          (field) =>
            error.message.toLowerCase().includes(field)
        );

      if (!missingProfileColumn) {
        setMessage(error.message);
        return;
      }

      const { error: fallbackError } = await supabase
        .from("profiles")
        .update({
          pseudo,
        })
        .eq("id", user.id);

      if (fallbackError) {
        setMessage(fallbackError.message);
        return;
      }
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

      <main className="flex-1 md:ml-64 pt-20">
        <div className="min-h-screen bg-[#182738] text-white">
          <div className="max-w-4xl mx-auto p-4 md:p-8">

            {/* Logo */}
            <div className="flex justify-center mb-6 md:mb-8">
              <Image
                src="/logo-ej-prono.png"
                alt="EJ Prono"
                width={180}
                height={180}
                priority
                className="w-32 md:w-44 h-auto"
              />
            </div>

            {/* Titre */}
            <h1 className="text-3xl md:text-5xl font-bold text-center mb-8 md:mb-10">
              Mon Profil
            </h1>

            {/* PROFIL */}
            <div className="bg-[#2d3b4b] rounded-xl p-5 md:p-8 shadow-lg">

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
                  className="
                    w-full
                    p-3
                    rounded-lg
                    bg-white
                    text-black
                  "
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 text-[#c9a27e]">
                    Prenom
                  </label>

                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) =>
                      setFirstName(e.target.value)
                    }
                    className="
                      w-full
                      p-3
                      rounded-lg
                      bg-white
                      text-black
                    "
                  />
                </div>

                <div>
                  <label className="block mb-2 text-[#c9a27e]">
                    Nom
                  </label>

                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) =>
                      setLastName(e.target.value)
                    }
                    className="
                      w-full
                      p-3
                      rounded-lg
                      bg-white
                      text-black
                    "
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-[#c9a27e]">
                  Entreprise
                </label>

                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="
                    w-full
                    p-3
                    rounded-lg
                    bg-white
                    text-black
                  "
                />
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-[#c9a27e]">
                  Lien de l'image avatar / photo
                </label>

                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                  <div className="w-20 h-20 rounded-full bg-[#223246] overflow-hidden flex items-center justify-center text-2xl font-bold text-[#c9a27e]">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={pseudo || "Avatar"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (pseudo || "?").slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) =>
                      setAvatarUrl(e.target.value)
                    }
                    className="
                      w-full
                      p-3
                      rounded-lg
                      bg-white
                      text-black
                    "
                    placeholder="https://exemple.com/photo.jpg"
                  />
                </div>

                <p className="mt-2 text-sm text-gray-400">
                  Collez ici un lien direct vers une image en ligne.
                  Ce n'est pas encore un envoi de fichier depuis le
                  telephone.
                </p>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-[#c9a27e]">
                  Email
                </label>

                <input
                  type="text"
                  value={email}
                  disabled
                  className="
                    w-full
                    p-3
                    rounded-lg
                    bg-gray-300
                    text-gray-700
                  "
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

              <div className="flex flex-col md:flex-row gap-3">

                <button
                  onClick={enregistrerPseudo}
                  className="
                    w-full md:w-auto
                    px-6
                    py-3
                    rounded-lg
                    bg-[#c9a27e]
                    hover:bg-[#b58d69]
                    transition
                  "
                >
                  Enregistrer
                </button>

                <button
                  onClick={() =>
                    router.push("/dashboard")
                  }
                  className="
                    w-full md:w-auto
                    px-6
                    py-3
                    rounded-lg
                    bg-[#223246]
                    hover:bg-[#1a2838]
                    transition
                  "
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

            {/* RAPPELS */}
            <div className="mt-6 md:mt-8 bg-[#2d3b4b] rounded-xl p-5 md:p-8 shadow-lg">

              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Rappels pronostics
              </h2>

              <p className="text-gray-300 mb-5">
                Recevez une notification sur ce telephone quand il reste des pronostics a faire avant un match.
              </p>

              <PushReminderButton />

              <p className="text-sm text-gray-400 mt-4">
                Sur iPhone, ajoutez EJ Prono a l'ecran d'accueil avant d'activer les rappels.
              </p>

            </div>

            {/* SECURITE */}
            <div className="mt-6 md:mt-8 bg-[#2d3b4b] rounded-xl p-5 md:p-8 shadow-lg">

              <h2 className="text-2xl md:text-3xl font-bold mb-6">
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
                  className="
                    w-full
                    p-3
                    rounded-lg
                    bg-white
                    text-black
                  "
                  placeholder="Nouveau mot de passe"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-3">

                <button
                  onClick={changerMotDePasse}
                  className="
                    w-full md:w-auto
                    px-6
                    py-3
                    rounded-lg
                    bg-[#c9a27e]
                    hover:bg-[#b58d69]
                    transition
                  "
                >
                  Modifier le mot de passe
                </button>

                <button
                  onClick={() =>
                    router.push("/mot-de-passe-oublie")
                  }
                  className="
                    w-full md:w-auto
                    px-6
                    py-3
                    rounded-lg
                    bg-[#223246]
                    hover:bg-[#1a2838]
                    transition
                  "
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
