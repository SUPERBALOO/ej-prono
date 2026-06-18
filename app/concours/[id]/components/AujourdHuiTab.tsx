"use client";

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
    <div className="space-y-6">

      <h2 className="text-3xl md:text-4xl font-bold">
        🔥 Aujourd'hui
      </h2>

      {matchs48h.length === 0 && (
        <div className="bg-[#42546B] rounded-2xl p-6 text-center">
          Aucun match prévu entre -24h et +48h.
        </div>
      )}

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
            className="bg-[#42546B] rounded-2xl p-4 md:p-5"
          >

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

              <div className="text-center mt-5">

                <div className="text-4xl md:text-5xl font-bold text-[#D8AA82]">
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

            {/* TENDANCE */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                📊 Tendance des joueurs
              </h3>

              <div className="space-y-2">

                <div className="bg-[#33465D] p-2 rounded-lg">
                  🏠 Victoire domicile : {homePct}%
                </div>

                <div className="bg-[#33465D] p-2 rounded-lg">
                  🤝 Match nul : {drawPct}%
                </div>

                <div className="bg-[#33465D] p-2 rounded-lg">
                  ✈️ Victoire extérieur : {awayPct}%
                </div>

              </div>

            </div>

            {/* SCORES LES PLUS JOUES */}

            <div className="mt-6">

              <h3 className="font-bold mb-3">
                ⭐ Scores les plus joués
              </h3>

              <div className="flex flex-wrap gap-2">

                {tendance?.topScores?.length > 0 ? (

                  tendance.topScores.map(
                    ([score, nb]: any) => (

                      <div
                        key={score}
                        className="bg-[#33465D] px-3 py-2 rounded-lg"
                      >
                        ⭐ {score} ({nb})
                      </div>

                    )
                  )

                ) : (

                  <div className="text-gray-400">
                    Aucun pronostic enregistré
                  </div>

                )}

              </div>

            </div>

            {/* FORME DES EQUIPES */}

            <div className="grid md:grid-cols-2 gap-6 mt-8">

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
  );
}