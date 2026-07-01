"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase/client";
import AujourdHuiTab from "@/app/concours/[id]/components/AujourdHuiTab";

function getMatchsAutourAujourdhui(matchsData: any[]) {
  const now = new Date();
  const limitePasse = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  );
  const limiteFuture = new Date(
    now.getTime() + 48 * 60 * 60 * 1000
  );

  return matchsData.filter((match: any) => {
    const dateMatch = new Date(match.match_date);

    return (
      dateMatch >= limitePasse &&
      dateMatch <= limiteFuture
    );
  });
}

export default function PronosticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [matchs48h, setMatchs48h] = useState<any[]>([]);
  const [tendances, setTendances] = useState<any>({});
  const [formesEquipes, setFormesEquipes] = useState<any>({});
  const [predictions, setPredictions] = useState<any>({});
  const [savedPredictions, setSavedPredictions] = useState<any>({});
  const [
    modifiedPredictions,
    setModifiedPredictions,
  ] = useState<any>({});
  const [userPointsByMatch, setUserPointsByMatch] =
    useState<any>({});

  useEffect(() => {
    chargerPronostics();
  }, []);

  async function chargerTendances(matchId: string) {
    const { data } = await supabase
      .from("predictions")
      .select("*")
      .eq("match_id", matchId);

    let home = 0;
    let draw = 0;
    let away = 0;
    const scores: Record<string, number> = {};

    (data || []).forEach((prediction: any) => {
      if (prediction.pred_home > prediction.pred_away) home++;
      else if (prediction.pred_home < prediction.pred_away) away++;
      else draw++;

      const score =
        `${prediction.pred_home}-${prediction.pred_away}`;

      scores[score] = (scores[score] || 0) + 1;
    });

    return {
      home,
      draw,
      away,
      topScores: Object.entries(scores)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5),
    };
  }

  async function chargerFormeEquipe(equipe: string) {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .or(
        `home_team.eq.${equipe},away_team.eq.${equipe}`
      )
      .eq("status", "finished")
      .order("match_date", { ascending: false })
      .limit(5);

    return data || [];
  }

  async function chargerDetailsAujourdhui(
    prochainsMatchs: any[]
  ) {
    if (!prochainsMatchs.length) {
      setTendances({});
      setFormesEquipes({});
      return;
    }

    const matchIds = prochainsMatchs.map(
      (match: any) => match.id
    );

    const equipes = Array.from(
      new Set(
        prochainsMatchs.flatMap((match: any) => [
          match.home_team,
          match.away_team,
        ])
      )
    );

    const [{ data: pronos }, formesEntries] =
      await Promise.all([
        supabase
          .from("predictions")
          .select("*")
          .in("match_id", matchIds),
        Promise.all(
          equipes.map(async (equipe: any) => [
            equipe,
            await chargerFormeEquipe(equipe),
          ])
        ),
      ]);

    const tendancesMap: any = {};
    const scoresParMatch: any = {};

    for (const matchId of matchIds) {
      tendancesMap[matchId] = {
        home: 0,
        draw: 0,
        away: 0,
        topScores: [],
      };
    }

    (pronos || []).forEach((prediction: any) => {
      const tendance =
        tendancesMap[prediction.match_id];

      if (!tendance) return;

      if (prediction.pred_home > prediction.pred_away) tendance.home++;
      else if (prediction.pred_home < prediction.pred_away) tendance.away++;
      else tendance.draw++;

      const score =
        `${prediction.pred_home}-${prediction.pred_away}`;

      scoresParMatch[prediction.match_id] =
        scoresParMatch[prediction.match_id] || {};

      scoresParMatch[prediction.match_id][score] =
        (scoresParMatch[prediction.match_id][score] || 0) + 1;
    });

    Object.entries(tendancesMap).forEach(
      ([matchId, tendance]: any) => {
        tendance.topScores =
          Object.entries(scoresParMatch[matchId] || {})
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5);
      }
    );

    setTendances(tendancesMap);
    setFormesEquipes(
      Object.fromEntries(formesEntries)
    );
  }

  async function chargerPronostics() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/connexion");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: inscriptions, error } =
        await supabase
          .from("participants_concours")
          .select(`
            concours_id,
            concours (
              id,
              nom
            )
          `)
          .eq("joueur_id", user.id);

      if (error) throw error;

      const concoursList = (inscriptions || [])
        .map((item: any) => {
          const concours = Array.isArray(item.concours)
            ? item.concours[0]
            : item.concours;

          return concours;
        })
        .filter((concours: any) => concours?.id);

      const concoursIds = concoursList.map(
        (concours: any) => concours.id
      );

      if (!concoursIds.length) {
        setMatchs48h([]);
        return;
      }

      const concoursNames = new Map(
        concoursList.map((concours: any) => [
          concours.id,
          concours.nom,
        ])
      );

      const { data: allMatches, error: matchesError } =
        await supabase
          .from("matches")
          .select("*")
          .in("concours_id", concoursIds)
          .order("match_date", { ascending: true });

      if (matchesError) throw matchesError;

      const prochainsMatchs =
        getMatchsAutourAujourdhui(
          (allMatches || []).map((match: any) => ({
            ...match,
            concours_nom:
              concoursNames.get(match.concours_id) || "",
          }))
        );

      setMatchs48h(prochainsMatchs);

      const savedMap: any = {};
      const predictionsMap: any = {};
      const pointsMap: any = {};

      if (session?.access_token) {
        for (const concoursId of concoursIds) {
          const predictionsResponse = await fetch(
            `/api/predictions?concoursId=${concoursId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

          const predictionsResult =
            await predictionsResponse.json();

          (predictionsResult.predictions || []).forEach(
            (prediction: any) => {
              savedMap[prediction.match_id] = true;
              predictionsMap[prediction.match_id] = {
                pred_home: prediction.pred_home,
                pred_away: prediction.pred_away,
                locked_odds:
                  prediction.locked_odds ??
                  prediction.prediction_odds,
              };
            }
          );

          const pointsResponse = await fetch(
            `/api/points/me?concoursId=${concoursId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

          const pointsResult =
            await pointsResponse.json();

          (pointsResult.points || []).forEach((row: any) => {
            pointsMap[row.match_id] = {
              points: row.points,
              exact_score: row.exact_score,
            };
          });
        }
      }

      setSavedPredictions(savedMap);
      setPredictions(predictionsMap);
      setUserPointsByMatch(pointsMap);

      await chargerDetailsAujourdhui(prochainsMatchs);
    } catch (error) {
      console.error(error);
      alert("Erreur lors du chargement des pronostics");
    } finally {
      setLoading(false);
    }
  }

  async function enregistrerPronostic(matchId: string) {
    const pronostic = predictions[matchId];

    if (
      pronostic?.pred_home === undefined ||
      pronostic?.pred_away === undefined
    ) {
      alert("Veuillez saisir un score");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Vous devez etre connecte");
      return;
    }

    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        match_id: matchId,
        pred_home: Number(pronostic.pred_home),
        pred_away: Number(pronostic.pred_away),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Erreur");
      return;
    }

    const updatedMatches = result.updatedMatches || [];

    if (updatedMatches.length) {
      const updatedById = new Map(
        updatedMatches.map((match: any) => [
          match.id,
          match,
        ])
      );

      setMatchs48h((prev: any[]) =>
        prev.map((match: any) => {
          const updatedMatch = updatedById.get(match.id);

          return updatedMatch
            ? {
                ...match,
                ...updatedMatch,
                concours_nom: match.concours_nom,
              }
            : match;
        })
      );
    }

    const savedResultPredictions =
      result.savedPredictions || [];

    if (savedResultPredictions.length) {
      setPredictions((prev: any) => {
        const next = { ...prev };

        savedResultPredictions.forEach(
          (prediction: any) => {
            next[prediction.match_id] = {
              ...next[prediction.match_id],
              pred_home: prediction.pred_home,
              pred_away: prediction.pred_away,
              locked_odds:
                prediction.locked_odds ??
                prediction.prediction_odds,
            };
          }
        );

        return next;
      });
    }

    setSavedPredictions((prev: any) => {
      const next = {
        ...prev,
        [matchId]: true,
      };

      savedResultPredictions.forEach(
        (prediction: any) => {
          next[prediction.match_id] = true;
        }
      );

      return next;
    });

    setModifiedPredictions((prev: any) => {
      const next = {
        ...prev,
        [matchId]: false,
      };

      savedResultPredictions.forEach(
        (prediction: any) => {
          next[prediction.match_id] = false;
        }
      );

      return next;
    });

    const tendanceMatchIds = updatedMatches.length
      ? updatedMatches.map((match: any) => match.id)
      : [matchId];

    for (const tendanceMatchId of tendanceMatchIds) {
      const nouvelleTendance =
        await chargerTendances(tendanceMatchId);

      setTendances((prev: any) => ({
        ...prev,
        [tendanceMatchId]: nouvelleTendance,
      }));
    }
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 md:p-10 md:ml-64">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="bg-[#33465D] rounded-3xl p-8 text-center">
              Chargement des pronostics...
            </div>
          ) : (
            <div className="bg-[#33465D] rounded-3xl p-4 md:p-8">
              <AujourdHuiTab
                matchs48h={matchs48h}
                tendances={tendances}
                formesEquipes={formesEquipes}
                predictions={predictions}
                savedPredictions={savedPredictions}
                modifiedPredictions={modifiedPredictions}
                userPointsByMatch={userPointsByMatch}
                setPredictions={setPredictions}
                setModifiedPredictions={setModifiedPredictions}
                enregistrerPronostic={enregistrerPronostic}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
