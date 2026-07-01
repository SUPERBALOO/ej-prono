"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";

export default function Inscription() {
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [message, setMessage] = useState("");

  const inscrire = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: motdepasse,
      options: {
        data: {
          pseudo,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Compte cree ! Connexion en cours...");

    if (data.session) {
      router.push("/dashboard");
      return;
    }

    router.push("/connexion");
  };

  return (
    <main className="min-h-screen bg-[#1E2A38] flex items-center justify-center">
      <div className="bg-[#2F3A44] p-10 rounded-2xl shadow-xl w-full max-w-md text-center">
        <Image
          src="/logo-ej-prono.png"
          alt="EJ Prono"
          width={180}
          height={180}
          className="mx-auto mb-6"
        />

        <h1 className="text-4xl font-bold text-white mb-8">Inscription</h1>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full p-3 rounded border border-[#C19A7A] text-black"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded border border-[#C19A7A] text-black"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={motdepasse}
            onChange={(e) => setMotdepasse(e.target.value)}
            className="w-full p-3 rounded border border-[#C19A7A] text-black"
          />

          <button
            onClick={inscrire}
            className="w-full bg-[#C19A7A] hover:bg-[#A98366] text-white font-semibold py-3 rounded transition"
          >
            Creer un compte
          </button>

          {message && (
            <div className="mt-4">
              <p className="text-white">{message}</p>

              {message.includes("Compte cree") && (
                <button
                  onClick={() => router.push("/connexion")}
                  className="mt-4 bg-[#C19A7A] hover:bg-[#A98366] text-white px-6 py-2 rounded"
                >
                  Aller a la connexion
                </button>
              )}
            </div>
          )}

          <div className="pt-4">
            <p className="text-gray-300">Deja inscrit ?</p>

            <button
              onClick={() => router.push("/connexion")}
              className="text-[#C19A7A] hover:underline"
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
