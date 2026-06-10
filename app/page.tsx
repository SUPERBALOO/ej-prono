import Image from "next/image";
import Link from "next/link";

export default function Home() {
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
            A vos pronostiques ...
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
              <p className="text-4xl font-bold text-[#C19A7A]">0</p>
              <p className="text-white">Participants</p>
            </div>

            <div className="bg-[#1F2933] rounded-xl p-6">
              <p className="text-4xl font-bold text-[#C19A7A]">0</p>
              <p className="text-white">Concours actifs</p>
            </div>

            <div className="bg-[#1F2933] rounded-xl p-6">
              <p className="text-4xl font-bold text-[#C19A7A]">0</p>
              <p className="text-white">Pronostics</p>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}