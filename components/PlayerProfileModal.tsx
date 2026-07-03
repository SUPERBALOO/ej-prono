"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type PlayerSummary = {
  user_id?: string;
  pseudo: string;
  avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
};

type RecentPrediction = {
  id: string;
  pred_home: number;
  pred_away: number;
  locked_odds?: number | null;
  match_date?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  status?: string | null;
  points?: number | null;
  exact_score?: boolean | null;
};

type PlayerProfileResponse = {
  profile: PlayerSummary & {
    id: string;
  };
  recentPredictions: RecentPrediction[];
  adminInfo?: {
    email?: string | null;
    appInstalled: boolean;
    pushEnabled: boolean;
  } | null;
};

export default function PlayerProfileModal({
  player,
  concoursId,
  onClose,
}: {
  player: PlayerSummary | null;
  concoursId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] =
    useState<PlayerProfileResponse | null>(null);

  useEffect(() => {
    if (!player?.user_id || !concoursId) {
      return;
    }

    loadDetails(player.user_id, concoursId);
  }, [player?.user_id, concoursId]);

  async function loadDetails(
    userId: string,
    currentConcoursId: string
  ) {
    setLoading(true);
    setError("");
    setDetails(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Session invalide.");
        return;
      }

      const response = await fetch(
        `/api/player-profile/${userId}?concoursId=${currentConcoursId}`,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Fiche indisponible.");
        return;
      }

      setDetails(result);
    } catch (error) {
      console.error(error);
      setError("Fiche indisponible.");
    } finally {
      setLoading(false);
    }
  }

  if (!player) {
    return null;
  }

  const profile = details?.profile || player;
  const fullName = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-3 pt-6 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#33465D] p-5 text-white shadow-2xl md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-4 rounded-t-2xl bg-[#33465D] p-5 md:-mx-6 md:-mt-6 md:p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#D8AA82] flex items-center justify-center text-2xl font-bold text-[#1E3047]">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.pseudo}
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.pseudo.slice(0, 1).toUpperCase()
              )}
            </div>

            <div>
              <h3 className="text-2xl font-bold">
                {profile.pseudo}
              </h3>

              {fullName && (
                <p className="text-[#D8AA82]">
                  {fullName}
                </p>
              )}

              {profile.company && (
                <p className="text-sm text-gray-300">
                  {profile.company}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-[#1E3047] p-3 text-white shadow-lg hover:opacity-90"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {loading && (
          <p className="rounded-xl bg-[#1E3047] p-4 text-center">
            Chargement de la fiche...
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-500/20 p-4 text-red-100">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {details?.adminInfo && (
              <div className="rounded-xl bg-[#1E3047] p-4">
                <h4 className="mb-3 font-bold text-[#D8AA82]">
                  Infos admin
                </h4>

                <div className="grid gap-2 text-sm text-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <span>Mail</span>
                    <span className="text-right font-semibold text-white">
                      {details.adminInfo.email || "Non renseigne"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Nom</span>
                    <span className="text-right font-semibold text-white">
                      {profile.last_name || "Non renseigne"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Prenom</span>
                    <span className="text-right font-semibold text-white">
                      {profile.first_name || "Non renseigne"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Entreprise</span>
                    <span className="text-right font-semibold text-white">
                      {profile.company || "Non renseigne"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Application installee</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        details.adminInfo.appInstalled
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-100"
                      }`}
                    >
                      {details.adminInfo.appInstalled ? "Oui" : "Non"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Notifications validees</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        details.adminInfo.pushEnabled
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-100"
                      }`}
                    >
                      {details.adminInfo.pushEnabled ? "Oui" : "Non"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
            <h4 className="mb-3 font-bold text-[#D8AA82]">
              Derniers pronostics visibles
            </h4>

            {details?.recentPredictions?.length ? (
              <div className="space-y-3">
                {details.recentPredictions.map((prediction) => (
                  <div
                    key={prediction.id}
                    className="rounded-xl bg-[#1E3047] p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          {prediction.home_team} vs{" "}
                          {prediction.away_team}
                        </p>

                        {prediction.match_date && (
                          <p className="text-xs text-gray-400">
                            {new Date(
                              prediction.match_date
                            ).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-[#D8AA82]">
                          Prono {prediction.pred_home} -{" "}
                          {prediction.pred_away}
                        </p>

                        {prediction.status === "finished" && (
                          <p className="text-xs text-gray-300">
                            Score {prediction.home_score} -{" "}
                            {prediction.away_score}
                          </p>
                        )}

                        {prediction.locked_odds && (
                          <p className="text-xs text-gray-400">
                            Cote {prediction.locked_odds}
                          </p>
                        )}

                        {prediction.points !== null &&
                          prediction.points !== undefined && (
                          <div className="mt-2 flex justify-end gap-2">
                            <span className="rounded-lg bg-[#D8AA82] px-2 py-1 text-xs font-bold text-[#1E3047]">
                              +{prediction.points} pt
                              {prediction.points > 1 ? "s" : ""}
                            </span>

                            {prediction.exact_score && (
                              <span className="rounded-lg bg-green-600 px-2 py-1 text-xs font-bold text-white">
                                Score exact
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-[#1E3047] p-4 text-gray-300">
                Aucun pronostic visible pour le moment.
              </p>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
