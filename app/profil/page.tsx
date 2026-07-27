"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import PushReminderButton from "@/components/PushReminderButton";

const GROUP_COMPANIES = [
  "Sadrin Rapin",
  "Le Batimans",
  "DLB Couverture",
  "Préfa Béton 72",
  "Bâti Propreté",
  "Divaré",
  "EPSI Electricité",
  "LBM ENERGIES",
  "BJC",
  "HANNY",
  "Groupe EJ",
];

const OTHER_COMPANY_VALUE = "__OTHER__";
const AVATAR_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET ||
  "avatars";
const AVATAR_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getAvatarStoragePath(
  publicUrl: string,
  bucket: string,
  userId: string
) {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const path = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length)
    );

    return path.startsWith(`${userId}/`) ? path : null;
  } catch {
    return null;
  }
}

export default function ProfilPage() {
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyChoice, setCompanyChoice] = useState("");
  const [customCompany, setCustomCompany] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [createdAt, setCreatedAt] = useState("");

  const [message, setMessage] = useState("");
  const [messageSecurite, setMessageSecurite] = useState("");
  const [avatarUploading, setAvatarUploading] =
    useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [nouveauMotDePasse, setNouveauMotDePasse] =
    useState("");

  const chargerProfil = useCallback(async () => {
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

      if (
        data.company &&
        GROUP_COMPANIES.includes(data.company)
      ) {
        setCompanyChoice(data.company);
        setCustomCompany("");
      } else if (data.company) {
        setCompanyChoice(OTHER_COMPANY_VALUE);
        setCustomCompany(data.company);
      } else {
        setCompanyChoice("");
        setCustomCompany("");
      }

      setAvatarUrl(data.avatar_url || "");
      setEmail(data.email || "");
      setIsAdmin(data.is_admin);
      setCreatedAt(data.created_at);
    }
  }, [router]);

  const enregistrerPseudo = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const company =
      companyChoice === OTHER_COMPANY_VALUE
        ? customCompany.trim()
        : companyChoice;

    if (
      !pseudo.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !company
    ) {
      setMessage("Pseudo, prenom, nom et entreprise sont obligatoires.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        pseudo: pseudo.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company,
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

  const uploaderAvatar = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const extension = AVATAR_MIME_TYPES[file.type];

    if (!extension) {
      setMessage(
        "Format non pris en charge. Utilisez une image JPG, PNG ou WebP."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("La photo doit faire moins de 5 Mo.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/connexion");
      return;
    }

    setAvatarUploading(true);
    setMessage("");

    let uploadedPath: string | null = null;

    try {
      const previousAvatarPath = getAvatarStoragePath(
        avatarUrl,
        AVATAR_BUCKET,
        user.id
      );
      const filePath =
        `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

      if (uploadError) {
        setMessage(
          `Envoi impossible. Vérifiez le bucket Supabase « ${AVATAR_BUCKET} » et ses droits.`
        );
        return;
      }

      uploadedPath = filePath;

      const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);

      if (profileError) {
        await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([filePath]);
        uploadedPath = null;
        setMessage(
          "La photo a été envoyée, mais le profil n'a pas pu être mis à jour."
        );
        return;
      }

      setAvatarUrl(data.publicUrl);

      if (previousAvatarPath && previousAvatarPath !== filePath) {
        const { error: removeError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([previousAvatarPath]);

        if (removeError) {
          console.error(removeError);
        }
      }

      uploadedPath = null;
      setMessage("Photo de profil mise à jour.");
    } catch (error) {
      console.error(error);

      if (uploadedPath) {
        await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([uploadedPath]);
      }

      setMessage("Erreur pendant l’envoi de la photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    // Le chargement est asynchrone et les mises à jour ont lieu après Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void chargerProfil();
  }, [chargerProfil]);

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
                  required
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
                    required
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
                    required
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

                <select
                  value={companyChoice}
                  onChange={(e) => {
                    setCompanyChoice(e.target.value);

                    if (
                      e.target.value !== OTHER_COMPANY_VALUE
                    ) {
                      setCustomCompany("");
                    }
                  }}
                  required
                  className="
                    w-full
                    p-3
                    rounded-lg
                    bg-white
                    text-black
                  "
                >
                  <option value="">
                    Selectionner une entreprise
                  </option>

                  {GROUP_COMPANIES.map((companyName) => (
                    <option
                      key={companyName}
                      value={companyName}
                    >
                      {companyName}
                    </option>
                  ))}

                  <option value={OTHER_COMPANY_VALUE}>
                    Autre
                  </option>
                </select>

                {companyChoice === OTHER_COMPANY_VALUE && (
                  <input
                    type="text"
                    value={customCompany}
                    onChange={(e) =>
                      setCustomCompany(e.target.value)
                    }
                    required
                    className="
                      mt-3
                      w-full
                      p-3
                      rounded-lg
                      bg-white
                      text-black
                    "
                    placeholder="Nom de l'entreprise"
                  />
                )}
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-[#c9a27e]">
                  Photo de profil
                </label>

                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                  <div className="w-20 h-20 rounded-full bg-[#223246] overflow-hidden flex items-center justify-center text-2xl font-bold text-[#c9a27e]">
                    {avatarUrl ? (
                      // Supabase fournit ici une URL publique dynamique.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={pseudo || "Avatar"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (pseudo || "?").slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        photoInputRef.current?.click()
                      }
                      disabled={avatarUploading}
                      className="
                        px-5
                        py-3
                        rounded-lg
                        bg-[#223246]
                        hover:bg-[#1a2838]
                        disabled:opacity-60
                        transition
                      "
                    >
                      Choisir une photo
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        cameraInputRef.current?.click()
                      }
                      disabled={avatarUploading}
                      className="
                        px-5
                        py-3
                        rounded-lg
                        bg-[#c9a27e]
                        hover:bg-[#b58d69]
                        disabled:opacity-60
                        transition
                      "
                    >
                      {avatarUploading
                        ? "Envoi..."
                        : "Prendre une photo"}
                    </button>
                  </div>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploaderAvatar}
                    className="hidden"
                  />

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={uploaderAvatar}
                    className="hidden"
                  />
                </div>

                <p className="mt-2 text-sm text-gray-400">
                  Sur téléphone, le bouton photo permet d&apos;ouvrir
                  directement l&apos;appareil photo si le navigateur le
                  propose.
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
                  disabled={avatarUploading}
                  className="
                    w-full md:w-auto
                    px-6
                    py-3
                    rounded-lg
                    bg-[#c9a27e]
                    hover:bg-[#b58d69]
                    disabled:opacity-60
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
                Sur iPhone, ajoutez EJ Prono à l&apos;écran d&apos;accueil avant d&apos;activer les rappels.
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
