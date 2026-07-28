"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Sidebar from "@/components/Sidebar";
import LoadingAnimation from "@/components/LoadingAnimation";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import { supabase } from "@/lib/supabase/client";

type ConcoursSummary = {
  id: string;
  nom: string;
  date_fin?: string | null;
};

type RankingRow = {
  user_id?: string;
  pseudo: string;
  avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  points: number;
  bons_pronos: number;
  scores_exacts: number;
  rank_movement?: number;
  rank_recent_matches_count?: number;
};

type RankingBlock = {
  concours: ConcoursSummary;
  classement: RankingRow[];
  error?: string;
};

type RankingFilter =
  | "active"
  | "finished"
  | "all"
  | "selection";

const RANKING_PREFERENCES_KEY =
  "ej-prono:ranking-display-preferences";

function isConcoursActive(concours: ConcoursSummary) {
  if (!concours.date_fin) {
    return true;
  }

  const endDate = new Date(concours.date_fin);

  if (Number.isNaN(endDate.getTime())) {
    return true;
  }

  endDate.setHours(23, 59, 59, 999);

  return endDate.getTime() >= Date.now();
}

export default function ClassementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [classements, setClassements] = useState<
    RankingBlock[]
  >([]);
  const [selectedPlayer, setSelectedPlayer] =
    useState<RankingRow | null>(null);
  const [selectedConcoursId, setSelectedConcoursId] =
    useState<string | null>(null);
  const [rankingFilter, setRankingFilter] =
    useState<RankingFilter>("active");
  const [selectedRankingIds, setSelectedRankingIds] =
    useState<string[]>([]);
  const [showRankingChooser, setShowRankingChooser] =
    useState(false);

  const chargerClassements = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    // Le chargement est asynchrone et met à jour l'état après les requêtes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void chargerClassements();

    try {
      const storedPreferences = localStorage.getItem(
        RANKING_PREFERENCES_KEY
      );

      if (storedPreferences) {
        const preferences = JSON.parse(storedPreferences);

        if (
          ["active", "finished", "all", "selection"].includes(
            preferences.filter
          )
        ) {
          queueMicrotask(() => {
            setRankingFilter(preferences.filter);

            if (Array.isArray(preferences.selectedIds)) {
              setSelectedRankingIds(preferences.selectedIds);
            }
          });
        }
      }
    } catch (error) {
      console.error(
        "Préférences de classement invalides",
        error
      );
    }
  }, [chargerClassements]);

  useEffect(() => {
    localStorage.setItem(
      RANKING_PREFERENCES_KEY,
      JSON.stringify({
        filter: rankingFilter,
        selectedIds: selectedRankingIds,
      })
    );
  }, [rankingFilter, selectedRankingIds]);

  function renderAvatar(joueur: RankingRow) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#D8AA82] flex items-center justify-center text-sm font-bold text-[#1E3047]">
        {joueur.avatar_url ? (
          <img
            src={joueur.avatar_url}
            alt={joueur.pseudo}
            className="h-full w-full object-cover"
          />
        ) : (
          joueur.pseudo.slice(0, 1).toUpperCase()
        )}
      </div>
    );
  }

  function renderRankBadge(index: number) {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return null;
  }

  function renderRankTrend(joueur: RankingRow) {
    const movement = joueur.rank_movement || 0;
    const matchesCount =
      joueur.rank_recent_matches_count || 0;

    if (!matchesCount) {
      return null;
    }

    if (movement > 0) {
      return (
        <span
          className="rounded-full bg-green-600/20 px-2 py-1 text-xs font-bold text-green-300"
          title={`A gagne ${movement} place(s) sur les ${matchesCount} derniers matchs`}
        >
          ↑ +{movement}
        </span>
      );
    }

    if (movement < 0) {
      return (
        <span
          className="rounded-full bg-red-600/20 px-2 py-1 text-xs font-bold text-red-200"
          title={`A perdu ${Math.abs(movement)} place(s) sur les ${matchesCount} derniers matchs`}
        >
          ↓ {movement}
        </span>
      );
    }

    return (
      <span
        className="rounded-full bg-gray-600/30 px-2 py-1 text-xs font-bold text-gray-200"
        title={`Rang maintenu sur les ${matchesCount} derniers matchs`}
      >
        →
      </span>
    );
  }

  const activeCount = useMemo(
    () =>
      classements.filter((block) =>
        isConcoursActive(block.concours)
      ).length,
    [classements]
  );

  const finishedCount = classements.length - activeCount;

  const visibleClassements = useMemo(() => {
    if (rankingFilter === "active") {
      return classements.filter((block) =>
        isConcoursActive(block.concours)
      );
    }

    if (rankingFilter === "finished") {
      return classements.filter(
        (block) => !isConcoursActive(block.concours)
      );
    }

    if (rankingFilter === "selection") {
      return classements.filter((block) =>
        selectedRankingIds.includes(block.concours.id)
      );
    }

    return classements;
  }, [classements, rankingFilter, selectedRankingIds]);

  function toggleSelectedRanking(concoursId: string) {
    setSelectedRankingIds((currentIds) =>
      currentIds.includes(concoursId)
        ? currentIds.filter((id) => id !== concoursId)
        : [...currentIds, concoursId]
    );
    setRankingFilter("selection");
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

          {!loading && classements.length > 0 && (
            <section className="mb-6 rounded-2xl bg-[#33465D] p-4 shadow-lg md:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-bold">
                    Classements affichés
                  </h2>
                  <p className="mt-1 text-sm text-gray-300">
                    Les concours en cours sont affichés par défaut.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["active", "En cours", activeCount],
                      ["finished", "Terminés", finishedCount],
                      ["all", "Tous", classements.length],
                      [
                        "selection",
                        "Ma sélection",
                        selectedRankingIds.length,
                      ],
                    ] as const
                  ).map(([filter, label, count]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRankingFilter(filter)}
                      className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                        rankingFilter === filter
                          ? "bg-[#D8AA82] text-[#1E3047]"
                          : "bg-[#1E3047] text-white hover:bg-[#42546B]"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowRankingChooser((visible) => !visible)
                }
                className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#42546B] px-4 py-3 text-left font-semibold hover:bg-[#4b607a]"
                aria-expanded={showRankingChooser}
              >
                <span>Choisir les concours à afficher</span>
                <span aria-hidden="true">
                  {showRankingChooser ? "−" : "+"}
                </span>
              </button>

              {showRankingChooser && (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {classements.map((block) => {
                    const active = isConcoursActive(
                      block.concours
                    );

                    return (
                      <label
                        key={block.concours.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#1E3047] px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRankingIds.includes(
                            block.concours.id
                          )}
                          onChange={() =>
                            toggleSelectedRanking(
                              block.concours.id
                            )
                          }
                          className="h-5 w-5 accent-[#D8AA82]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {block.concours.nom}
                          </span>
                          <span
                            className={`text-xs ${
                              active
                                ? "text-green-300"
                                : "text-gray-400"
                            }`}
                          >
                            {active ? "En cours" : "Terminé"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {loading ? (
            <LoadingAnimation message="Chargement des classements..." />
          ) : classements.length === 0 ? (
            <div className="bg-[#33465D] rounded-3xl p-8 text-center">
              Aucun concours disponible.
            </div>
          ) : visibleClassements.length === 0 ? (
            <div className="rounded-3xl bg-[#33465D] p-8 text-center">
              Aucun classement ne correspond à ce filtre.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {visibleClassements.map((block) => (
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
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPlayer(joueur);
                                      setSelectedConcoursId(
                                        block.concours.id
                                      );
                                    }}
                                    className="flex items-center gap-3 text-left hover:text-[#D8AA82]"
                                  >
                                    {renderAvatar(joueur)}

                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span>
                                          {joueur.pseudo}
                                        </span>
                                        {renderRankBadge(index) && (
                                          <span className="text-xs text-[#D8AA82]">
                                            {renderRankBadge(index)}
                                          </span>
                                        )}
                                        {renderRankTrend(joueur)}
                                      </div>
                                    </div>
                                  </button>
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

      <PlayerProfileModal
        player={selectedPlayer}
        concoursId={selectedConcoursId}
        onClose={() => {
          setSelectedPlayer(null);
          setSelectedConcoursId(null);
        }}
      />
    </div>
  );
}
