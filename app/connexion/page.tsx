"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";

export default function Connexion() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifierSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
      }
    };

    verifierSession();
  }, [router]);

  const connexion = async () => {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motdepasse,
    });

    if (error) {
      setMessage("Email ou mot de passe incorrect.");
    } else {
      router.push("/dashboard");
    }
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

        <h1 className="text-4xl font-bold text-white mb-8">
          Connexion
        </h1>

        <div className="space-y-4">
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded border border-[#C19A7A] text-black"
          />

          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={motdepasse}
            onChange={(e) => setMotdepasse(e.target.value)}
            className="w-full p-3 rounded border border-[#C19A7A] text-black"
          />

          <button
            onClick={connexion}
            className="w-full bg-[#C19A7A] hover:bg-[#A98366] text-white font-semibold py-3 rounded transition"
          >
            Se connecter
          </button>

          {message && (
            <p className="text-red-400">
              {message}
            </p>
          )}

          <div className="pt-4">
            <p className="text-gray-300">
              Pas encore inscrit ?
            </p>

            <button
              onClick={() => router.push("/inscription")}
              className="text-[#C19A7A] hover:underline"
            >
              Créer un compte
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}