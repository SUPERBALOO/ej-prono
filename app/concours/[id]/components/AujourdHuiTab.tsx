"use client";

import { useState } from "react";
import {
  getStoredAfterExtraTimeScore,
  getStoredPenaltyScore,
  shouldShowAfterExtraTimeScore,
  shouldShowPenaltyScore,
} from "@/lib/matchScores";

interface Props {
  matchs48h: any[];
  tendances: any;
  formesEquipes: any;
  predictions: any;
  savedPredictions: any;
  modifiedPredictions: any;
  userPointsByMatch: any;
  setPredictions: any;
  setModifiedPredictions: any;
  enregistrerPronostic: (matchId: string) => void;
}

export default function AujourdHuiTab({
  matchs48h,
  tendances,
  formesEquipes,
  predictions,
  savedPredictions,
  modifiedPredictions,
  userPointsByMatch,
  setPredictions,
  setModifiedPredictions,
  enregistrerPronostic,
}: Props) {
  const [scoreDetails, setScoreDetails] =
    useState<null | {
      score: string;
      players: Array<
        | string
        | {
            player: string;
            odds?: number | string | null;
          }
      >;
      matchLabel: string;
    }>(null);
  const [trendDetails, setTrendDetails] =
    useState<null | {
      label: string;
      players: Array<{
        player: string;
        score: string;
        odds?: number | string | null;
      }>;
      matchLabel: string;
    }>(null);

  function renderScoreDetails(match: any) {
    const extraTimeScore =
      getStoredAfterExtraTimeScore(match);

    const penaltyScore =
      getStoredPenaltyScore(match);

    return (
      <div className="mt-2 space-y-1 text-center text-xs md:text-sm text-gray-300">
        {extraTimeScore &&
          shouldShowAfterExtraTimeScore(match) && (
          <div>
            Apres prolongation :{" "}
            <span className="font-semibold text-[#D8AA82]">
              {extraTimeScore.home} - {extraTimeScore.away}
            </span>
          </div>
        )}

        {penaltyScore &&
          shouldShowPenaltyScore(match) && (
          <div>
            Tirs au but :{" "}
            <span className="font-semibold text-[#D8AA82]">
              {penaltyScore.home} - {penaltyScore.away}
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderUserPoints(match: any) {
    const result =
      userPointsByMatch?.[match.id];

    if (
      match.status !== "finished" ||
      !result
    ) {
      return null;
    }

    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1E3047] px-3 py-2 text-sm font-bold text-[#D8AA82]">
        <span>Points remportes</span>
        <span className="text-white">
          +{result.points}
        </span>
        {result.exact_score && (
          <span className="rounded bg-green-600 px-2 py-1 text-xs text-white">
            Score exact
          </span>
        )}
      </div>
    );
  }

  function renderOddsRow(match: any) {
    const oddsPillClass =
      "grid h-10 min-w-0 grid-cols-[24px_1fr] items-center justify-center gap-2 rounded px-3 text-center font-bold";

    return (
      <div className="grid w-full max-w-[300px] grid-cols-3 gap-2">
        <div className={`${oddsPillClass} bg-green-700`}>
          {match.home_logo ? (
            <img
              src={match.home_logo}
              alt={match.home_team}
              className="h-6 w-6 object-contain"
            />
          ) : (
            <span className="text-center">🏠</span>
          )}
          <span className="tabular-nums">
            {match.cote_home ?? "--"}
          </span>
        </div>

        <div className={`${oddsPillClass} bg-gray-600`}>
          <span className="text-center">🤝</span>
          <span className="tabular-nums">
            {match.cote_draw ?? "--"}
          </span>
        </div>

        <div className={`${oddsPillClass} bg-blue-700`}>
          {match.away_logo ? (
            <img
              src={match.away_logo}
              alt={match.away_team}
              className="h-6 w-6 object-contain"
            />
          ) : (
            <span className="text-center">✈️</span>
          )}
          <span className="tabular-nums">
            {match.cote_away ?? "--"}
          </span>
        </div>
      </div>
    );
  }

  const hasFinalPhaseMatch = matchs48h.some(
    (match) =>
      match.phase &&
      match.phase !== "GROUP_STAGE"
  );

  function getResultIcon(match: any, equipe: string) {
    const isHome = match.home_team === equipe;

    const butsPour = isHome
      ? match.home_score
      : match.away_score;

    const butsContre = isHome
      ? match.away_score
      : match.home_score;

    if (butsPour > butsContre) return "🟢";
    if (butsPour < butsContre) return "🔴";

    return "🟡";
  }

  return (
    <div className="space-y-4">

      <h2 className="text-3xl md:text-3xl font-bold">
        🔥 Aujourd'hui
      </h2>

      {hasFinalPhaseMatch && (
        <div className="bg-[#D8AA82] text-[#1E3047] rounded-xl p-4 font-semibold">
          Info phases finales : les pronostics sont comptabilises sur le score a la fin du temps reglementaire (90 min), hors prolongation et tirs au but.
        </div>
      )}

      {matchs48h.length === 0 && (
        <div className="bg-[#42546B] rounded-2xl p-6 text-center">
          Aucun match prévu entre -24h et +48h.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

  {matchs48h.map((match) => {

        const tendance = tendances?.[match.id];

        const totalVotes =
          (tendance?.home || 0) +
          (tendance?.draw || 0) +
          (tendance?.away || 0);

        const homePct = totalVotes
          ? Math.round((tendance.home / totalVotes) * 100)
          : 0;

        const drawPct = totalVotes
          ? Math.round((tendance.draw / totalVotes) * 100)
          : 0;

        const awayPct = totalVotes
          ? Math.round((tendance.away / totalVotes) * 100)
          : 0;

        return (

          <div
            key={match.id}
            className="bg-[#42546B] rounded-2xl p-3"
          >
            {match.linked_concours_noms?.length > 1 ? (
              <div className="mb-3 rounded-xl bg-[#1E3047] px-3 py-2 text-sm">
                <div className="font-bold text-[#D8AA82]">
                  Compte pour{" "}
                  {match.linked_concours_noms.length} concours
                </div>
                <div className="mt-1 text-xs text-gray-200">
                  {match.linked_concours_noms.join(" + ")}
                </div>
              </div>
            ) : (
              match.concours_nom && (
                <div className="mb-3 inline-flex rounded-full bg-[#1E3047] px-3 py-1 text-sm font-semibold text-[#D8AA82]">
                  {match.concours_nom}
                </div>
              )
            )}

            {/* HEADER */}

            <div className="flex flex-col md:flex-row justify-between gap-4">

              <div>

                <div className="flex items-center justify-between flex-wrap gap-4">

                  <div className="flex items-center gap-2">
                    {match.home_logo && (
                      <img
                        src={match.home_logo}
                        alt={match.home_team}
                        className="w-8 h-8 object-contain"
                      />
                    )}

                    <span className="font-bold text-lg md:text-2xl">
                      {match.home_team}
                    </span>
                  </div>

                  <span className="text-gray-400 font-bold">
                    VS
                  </span>

                  <div className="flex items-center gap-2">
                    {match.away_logo && (
                      <img
                        src={match.away_logo}
                        alt={match.away_team}
                        className="w-8 h-8 object-contain"
                      />
                    )}

                    <span className="font-bold text-lg md:text-2xl">
                      {match.away_team}
                    </span>
                  </div>

                </div>

                <div className="text-gray-300 mt-2">

                  {new Date(
                    match.match_date
                  ).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}

                </div>

              </div>

              <div>

                {match.status === "live" && (
                  <div className="bg-red-600 px-3 py-2 rounded-full animate-pulse">
                    🔴 LIVE
                    {match.live_minute
                      ? ` ${match.live_minute}'`
                      : ""}
                  </div>
                )}

                {match.status === "scheduled" && (
                  <div className="bg-blue-600 px-3 py-2 rounded-full">
                    ⏳ À venir
                  </div>
                )}

                {match.status === "finished" && (
                  <div className="bg-green-600 px-3 py-2 rounded-full">
                    ✅ Terminé
                  </div>
                )}

              </div>

            </div>
            

 {/* SCORE */}

{(match.status === "live" ||
  match.status === "finished") && (

  <>
  <div className="mt-5 flex items-center justify-center gap-6">

    <div className="text-center">
      <div className="font-semibold">
        {match.home_team}
      </div>
    </div>

    <div className="text-4xl md:text-5xl font-bold text-[#D8AA82]">
      {match.home_score ?? 0}
      {" - "}
      {match.away_score ?? 0}
    </div>

    <div className="text-center">
      <div className="font-semibold">
        {match.away_team}
      </div>
    </div>

  </div>

  {renderScoreDetails(match)}
  </>

)}
            {/* PRONOSTIC */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                📝 Votre pronostic
              </h3>

              <div className="flex flex-wrap gap-3 items-center">

                <input
                  type="number"
                  min="0"
                  value={predictions[match.id]?.pred_home ?? ""}
                  onChange={(e) => {
                    setPredictions({
                      ...predictions,
                      [match.id]: {
                        ...predictions[match.id],
                        pred_home: e.target.value,
                      },
                    });

                    setModifiedPredictions({
                      ...modifiedPredictions,
                      [match.id]: true,
                    });
                  }}
                  className="w-16 bg-[#1E3047] rounded-lg p-2 text-center"
                />

                <span>-</span>

                <input
                  type="number"
                  min="0"
                  value={predictions[match.id]?.pred_away ?? ""}
                  onChange={(e) => {
                    setPredictions({
                      ...predictions,
                      [match.id]: {
                        ...predictions[match.id],
                        pred_away: e.target.value,
                      },
                    });

                    setModifiedPredictions({
                      ...modifiedPredictions,
                      [match.id]: true,
                    });
                  }}
                  className="w-16 bg-[#1E3047] rounded-lg p-2 text-center"
                />

                {savedPredictions[match.id] &&
                !modifiedPredictions[match.id] ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-green-600 px-4 py-2 rounded-lg">
                      ✓ Enregistré
                    </div>

                    {predictions[match.id]?.locked_odds && (
                      <div className="bg-[#1E3047] px-3 py-2 rounded-lg text-sm font-bold text-[#D8AA82]">
                        Cote {predictions[match.id].locked_odds}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      enregistrerPronostic(match.id)
                    }
                    className="bg-[#D8AA82] text-[#1E3047] px-4 py-2 rounded-lg font-bold"
                  >
                    Enregistrer
                  </button>
                )}

              </div>

              {renderUserPoints(match)}

            </div>

            {/* COTES */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                💰 Cotes
              </h3>

              {renderOddsRow(match)}

            </div>

           {/* TENDANCE */}

<div className="mt-5">

  <h3 className="font-bold mb-3">
    📊 Tendance des joueurs
  </h3>

  <div className="space-y-3">

    <button
      type="button"
      onClick={() =>
        setTrendDetails({
          label: "Victoire domicile",
          players: tendance?.trendPlayers?.home || [],
          matchLabel:
            `${match.home_team} vs ${match.away_team}`,
        })
      }
      className="block w-full rounded-lg p-1 text-left transition hover:bg-[#33465D] focus:outline-none focus:ring-2 focus:ring-[#D8AA82]"
    >
      <div className="flex justify-between text-sm mb-1">
        <span>🏠 Victoire domicile</span>
        <span>{homePct}%</span>
      </div>

      <div className="h-3 bg-[#33465D] rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500"
          style={{ width: `${homePct}%` }}
        />
      </div>
    </button>

    <button
      type="button"
      onClick={() =>
        setTrendDetails({
          label: "Match nul",
          players: tendance?.trendPlayers?.draw || [],
          matchLabel:
            `${match.home_team} vs ${match.away_team}`,
        })
      }
      className="block w-full rounded-lg p-1 text-left transition hover:bg-[#33465D] focus:outline-none focus:ring-2 focus:ring-[#D8AA82]"
    >
      <div className="flex justify-between text-sm mb-1">
        <span>🤝 Match nul</span>
        <span>{drawPct}%</span>
      </div>

      <div className="h-3 bg-[#33465D] rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-500"
          style={{ width: `${drawPct}%` }}
        />
      </div>
    </button>

    <button
      type="button"
      onClick={() =>
        setTrendDetails({
          label: "Victoire exterieur",
          players: tendance?.trendPlayers?.away || [],
          matchLabel:
            `${match.home_team} vs ${match.away_team}`,
        })
      }
      className="block w-full rounded-lg p-1 text-left transition hover:bg-[#33465D] focus:outline-none focus:ring-2 focus:ring-[#D8AA82]"
    >
      <div className="flex justify-between text-sm mb-1">
        <span>✈️ Victoire extérieur</span>
        <span>{awayPct}%</span>
      </div>

      <div className="h-3 bg-[#33465D] rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500"
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </button>

  </div>

</div>
 {/* SCORES LES PLUS JOUES */}

<div className="mt-5">

  <h3 className="font-bold mb-3">
    ⭐ Scores les plus joués
  </h3>

  <div className="flex flex-wrap gap-2">

    {tendance?.topScores?.length > 0 ? (

      tendance.topScores.map(
        ([score, nb]: any, index: number) => {

          let icon = "⭐";
          let bg = "bg-[#33465D]";

          if (index === 0) {
            icon = "🏆";
            bg = "bg-yellow-600";
          } else if (index === 1) {
            icon = "🥈";
            bg = "bg-slate-500";
          } else if (index === 2) {
            icon = "🥉";
            bg = "bg-amber-700";
          }

          return (

            <button
              type="button"
              key={score}
              onClick={() =>
                setScoreDetails({
                  score,
                  players:
                    tendance.scorePlayers?.[score] || [],
                  matchLabel:
                    `${match.home_team} vs ${match.away_team}`,
                })
              }
              className={`${bg} px-3 py-2 rounded-lg font-medium transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#D8AA82]`}
            >
              {icon} {score} ×{nb}
            </button>

          );

        }
      )

    ) : (

      <div className="text-gray-400">
        Aucun pronostic enregistré
      </div>

    )}

  </div>

</div>

            {/* FORME DES EQUIPES */}

            <div className="grid md:grid-cols-2 gap-3 mt-5">

              {[match.home_team, match.away_team].map(
                (equipe) => (

                  <div key={equipe}>

                    <h3 className="font-bold text-lg mb-3">
                      📈 {equipe}
                    </h3>

                    <div className="space-y-2">

                      {(formesEquipes[equipe] || []).map(
                        (m: any) => (

                          <div
                            key={m.id}
                            className="bg-[#33465D] rounded-lg p-2 text-sm"
                          >

                            <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center">

                              <span>
                                {getResultIcon(m, equipe)}
                              </span>

                              <span className="truncate">
                                {m.home_team}
                              </span>

                              <span className="font-bold text-[#D8AA82]">
                                {m.home_score}-{m.away_score}
                              </span>

                              <span className="truncate text-right">
                                {m.away_team}
                              </span>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  </div>

                )
              )}

            </div>

          </div>

        );
       })}
    </div>

    {scoreDetails && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setScoreDetails(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-[#42546B] p-5 text-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#D8AA82]">
                {scoreDetails.matchLabel}
              </div>
              <h3 className="mt-1 text-xl font-bold">
                Score {scoreDetails.score}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setScoreDetails(null)}
              className="rounded-lg bg-[#1E3047] px-3 py-2 text-lg font-bold hover:brightness-110"
              aria-label="Fermer"
            >
              x
            </button>
          </div>

          {scoreDetails.players.length > 0 ? (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {scoreDetails.players.map((playerDetail, index) => {
                const player =
                  typeof playerDetail === "string"
                    ? playerDetail
                    : playerDetail.player;

                const odds =
                  typeof playerDetail === "string"
                    ? null
                    : playerDetail.odds;

                return (
                  <div
                    key={`${player}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#1E3047] px-4 py-3"
                  >
                    <span className="font-semibold">
                      {player}
                    </span>

                    {odds && (
                      <span className="rounded bg-[#D8AA82] px-3 py-1 text-sm font-bold text-[#1E3047]">
                        Cote {odds}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-[#1E3047] px-4 py-3 text-gray-300">
              Aucun joueur trouve pour ce score.
            </div>
          )}
        </div>
      </div>
    )}

    {trendDetails && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setTrendDetails(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-[#42546B] p-5 text-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#D8AA82]">
                {trendDetails.matchLabel}
              </div>
              <h3 className="mt-1 text-xl font-bold">
                {trendDetails.label}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setTrendDetails(null)}
              className="rounded-lg bg-[#1E3047] px-3 py-2 text-lg font-bold hover:brightness-110"
              aria-label="Fermer"
            >
              x
            </button>
          </div>

          {trendDetails.players.length > 0 ? (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {trendDetails.players.map((item, index) => (
                <div
                  key={`${item.player}-${item.score}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#1E3047] px-4 py-3"
                >
                  <span className="font-semibold">
                    {item.player}
                  </span>

                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="rounded bg-[#33465D] px-3 py-1 text-sm font-bold text-white">
                      {item.score}
                    </span>

                    {item.odds && (
                      <span className="rounded bg-[#D8AA82] px-3 py-1 text-sm font-bold text-[#1E3047]">
                        Cote {item.odds}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-[#1E3047] px-4 py-3 text-gray-300">
              Aucun joueur trouve pour cette tendance.
            </div>
          )}
        </div>
      </div>
    )}

  </div>

  );
}
