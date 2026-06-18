"use client";

import { useMemo } from "react";

interface Props {
  matchs48h: any[];
  tendances: any;
  formesEquipes: any;
  predictions: any;
  savedPredictions: any;
  modifiedPredictions: any;
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
  setPredictions,
  setModifiedPredictions,
  enregistrerPronostic,
}: Props) {
  return (
    <div className="space-y-6">

      <h2 className="text-4xl font-bold">
        🔥 Aujourd'hui
      </h2>

      {matchs48h.length === 0 && (
        <div className="bg-[#42546B] rounded-2xl p-6 text-center">
          Aucun match prévu dans les prochaines 48h.
        </div>
      )}

      {matchs48h.map((match) => {

        const tendance = tendances[match.id];

        return (

          <div
            key={match.id}
            className="bg-[#42546B] rounded-2xl p-6"
          >

            {/* HEADER */}

            <div className="flex flex-col md:flex-row justify-between gap-4">

              <div>

                <div className="text-2xl font-bold">
                  {match.home_team} vs {match.away_team}
                </div>

                <div className="text-gray-300">

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
                  <span className="bg-red-600 px-3 py-2 rounded-full animate-pulse">
                    🔴 LIVE
                    {match.live_minute
                      ? ` ${match.live_minute}'`
                      : ""}
                  </span>
                )}

                {match.status === "scheduled" && (
                  <span className="bg-blue-600 px-3 py-2 rounded-full">
                    ⏳ À venir
                  </span>
                )}

                {match.status === "finished" && (
                  <span className="bg-green-600 px-3 py-2 rounded-full">
                    ✅ Terminé
                  </span>
                )}

              </div>

            </div>

            {/* SCORE LIVE */}

            {(match.status === "live" ||
              match.status === "finished") && (

              <div className="text-center mt-6">

                <div className="text-5xl font-bold text-[#D8AA82]">

                  {match.home_score ?? 0}
                  {" - "}
                  {match.away_score ?? 0}

                </div>

              </div>

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
                  value={
                    predictions[match.id]?.pred_home ?? ""
                  }
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
                  value={
                    predictions[match.id]?.pred_away ?? ""
                  }
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

                  <div className="bg-green-600 px-4 py-2 rounded-lg">
                    ✓ Enregistré
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

            </div>

            {/* COTES */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                💰 Cotes
              </h3>

              <div className="flex flex-wrap gap-3">

                <div className="bg-green-700 px-3 py-2 rounded">
                  🏠 {match.cote_home}
                </div>

                <div className="bg-gray-600 px-3 py-2 rounded">
                  🤝 {match.cote_draw}
                </div>

                <div className="bg-blue-700 px-3 py-2 rounded">
                  ✈️ {match.cote_away}
                </div>

              </div>

            </div>

            {/* TENDANCES */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                📊 Tendance des joueurs
              </h3>

              <div className="grid grid-cols-3 gap-3">

                <div className="bg-green-700 p-3 rounded text-center">
                  🏠 {tendance?.home || 0}
                </div>

                <div className="bg-gray-700 p-3 rounded text-center">
                  🤝 {tendance?.draw || 0}
                </div>

                <div className="bg-blue-700 p-3 rounded text-center">
                  ✈️ {tendance?.away || 0}
                </div>

              </div>

            </div>

            {/* SCORES LES PLUS JOUÉS */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                ⭐ Scores les plus joués
              </h3>

              {tendance?.topScores?.map(
                ([score, nb]: any) => (

                  <div key={score}>
                    {score} ({nb} joueurs)
                  </div>

                )
              )}

            </div>

            {/* DERNIERS MATCHS */}

            <div className="grid md:grid-cols-2 gap-8 mt-8">

              <div>

                <h3 className="font-bold text-lg mb-3">
                  🇫🇷 {match.home_team}
                </h3>

                {formesEquipes[
                  match.home_team
                ]?.map((m: any) => (

                  <div
                    key={m.id}
                    className="mb-2"
                  >
                    {m.home_team}
                    {" "}
                    {m.home_score}
                    -
                    {m.away_score}
                    {" "}
                    {m.away_team}
                  </div>

                ))}

              </div>

              <div>

                <h3 className="font-bold text-lg mb-3">
                  🇩🇪 {match.away_team}
                </h3>

                {formesEquipes[
                  match.away_team
                ]?.map((m: any) => (

                  <div
                    key={m.id}
                    className="mb-2"
                  >
                    {m.home_team}
                    {" "}
                    {m.home_score}
                    -
                    {m.away_score}
                    {" "}
                    {m.away_team}
                  </div>

                ))}

              </div>

            </div>

          </div>

        );
      })}
    </div>
  );
}