"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase/client";

type ConcoursSummary = {
  id: string;
  nom: string;
  date_fin?: string | null;
};

type RankingRow = {
  pseudo: string;
  points: number;
  bons_pronos: number;
  scores_exacts: number;
};

type RankingBlock = {
  concours: ConcoursSummary;
  classement: RankingRow[];
  error?: string;
};

export default function ClassementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [classements, setClassements] = useState<
    RankingBlock[]
  >([]);

  useEffect(() => {
    chargerClassements();
  }, []);

  async function chargerClassements() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/connexion");
        return;
      }

      const { data: inscriptions, error } =
        await supabase
          .from("participants_concours")
          .select(
            `
              concours_id,
              concours (
                id,
                nom,
                date_fin
              )
            `
          )
          .eq("joueur_id", user.id);

      if (error) {
        throw error;
      }

      const concoursList = (inscriptions || [])
        .map((item: any) => {
          const concours = Array.isArray(item.concours)
            ? item.concours[0]
            : item.concours;

          return concours;
        })
        .filter((concours: any) => concours?.id)
        .sort((a: any, b: any) => {
          const dateA = new Date(
            a.date_fin || 0
          ).getTime();
          const dateB = new Date(
            b.date_fin || 0
          ).getTime();

          return dateB - dateA;
        });

      const rankingBlocks = await Promise.all(
        concoursList.map(async (concours: ConcoursSummary) => {
          try {
            const response = await fetch(
              `/api/ranking/${concours.id}`
            );
            const result = await response.json();

            if (!response.ok || result?.success === false) {
              return {
                concours,
                classement: [],
                error:
                  result?.error ||
                  "Classement indisponible",
              };
            }

            return {
              concours,
              classement: Array.isArray(result)
                ? result
                : [],
            };
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : "Classement indisponible";

            return {
              concours,
              classement: [],
              error: message,
            };
          }
        })
      );

      setClassements(rankingBlocks);
    } catch (error) {
      console.error(error);
      alert("Erreur lors du chargement des classements");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 md:p-10 md:ml-64">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <h1 className="text-4xl md:text-5xl font-bold">
              Classements
            </h1>

            <Link
              href="/concours"
              className="bg-[#D8AA82] text-white px-5 py-3 rounded-xl font-semibold text-center hover:opacity-90"
            >
              Mes concours
            </Link>
          </div>

          {loading ? (
            <div className="bg-[#33465D] rounded-3xl p-8 text-center">
              Chargement des classements...
            </div>
          ) : classements.length === 0 ? (
            <div className="bg-[#33465D] rounded-3xl p-8 text-center">
              Aucun concours disponible.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {classements.map((block) => (
                <section
                  key={block.concours.id}
                  className="bg-[#33465D] rounded-2xl p-5 md:p-6 shadow-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {block.concours.nom}
                      </h2>

                      {block.concours.date_fin && (
                        <p className="text-sm text-gray-300 mt-1">
                          Fin le{" "}
                          {new Date(
                            block.concours.date_fin
                          ).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/concours/${block.concours.id}?tab=classement`}
                      className="bg-[#D8AA82] text-white px-4 py-3 rounded-lg font-bold text-center whitespace-nowrap hover:opacity-90"
                    >
                      Ouvrir
                    </Link>
                  </div>

                  {block.error ? (
                    <p className="text-red-200">
                      {block.error}
                    </p>
                  ) : block.classement.length === 0 ? (
                    <p className="text-gray-300">
                      Aucun classement pour le moment.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px]">
                        <thead>
                          <tr className="border-b border-gray-500 text-sm text-gray-300">
                            <th className="text-left p-3">
                              #
                            </th>
                            <th className="text-left p-3">
                              Joueur
                            </th>
                            <th className="text-center p-3">
                              Points
                            </th>
                            <th className="text-center p-3">
                              Bons pronos
                            </th>
                            <th className="text-center p-3">
                              Scores exacts
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {block.classement.map(
                            (joueur, index) => (
                              <tr
                                key={`${block.concours.id}-${joueur.pseudo}-${index}`}
                                className="border-b border-gray-700 last:border-b-0"
                              >
                                <td className="p-3 font-bold text-[#D8AA82]">
                                  {index + 1}
                                </td>

                                <td className="p-3 font-semibold">
                                  {joueur.pseudo}
                                </td>

                                <td className="text-center p-3 font-bold">
                                  {joueur.points}
                                </td>

                                <td className="text-center p-3">
                                  {joueur.bons_pronos}
                                </td>

                                <td className="text-center p-3">
                                  {joueur.scores_exacts}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
