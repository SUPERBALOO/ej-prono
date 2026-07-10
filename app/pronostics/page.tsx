"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LoadingAnimation from "@/components/LoadingAnimation";
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

function getFixtureKey(match: any) {
  const home = String(match.home_team || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const away = String(match.away_team || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const matchTime = new Date(match.match_date).getTime();
  const matchDate = Number.isNaN(matchTime)
    ? ""
    : new Date(matchTime).toISOString().slice(0, 10);

  return `${home}|${away}|${matchDate}`;
}

function grouperMatchsMultiConcours(matchsData: any[]) {
  const groupes = new Map<string, any>();

  matchsData.forEach((match: any) => {
    const key = match.api_match_id
      ? `api:${match.api_match_id}`
      : `fixture:${getFixtureKey(match)}`;

    const existing = groupes.get(key);

    if (!existing) {
      groupes.set(key, {
        ...match,
        linked_match_ids: [match.id],
        linked_concours_noms: match.concours_nom
          ? [match.concours_nom]
          : [],
      });
      return;
    }

    existing.linked_match_ids = Array.from(
      new Set([
        ...(existing.linked_match_ids || [existing.id]),
        match.id,
      ])
    );

    existing.linked_concours_noms = Array.from(
      new Set([
        ...(existing.linked_concours_noms || []),
        ...(match.concours_nom ? [match.concours_nom] : []),
      ])
    );

    existing.concours_nom =
      existing.linked_concours_noms.join(" + ");
  });

  return Array.from(groupes.values()).map((match: any) => ({
    ...match,
    concours_nom:
      match.linked_concours_noms?.length > 1
        ? `Compte pour ${match.linked_concours_noms.length} concours : ${match.linked_concours_noms.join(" + ")}`
        : match.concours_nom,
  }));
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

    const matchIds = Array.from(
      new Set(
        prochainsMatchs.flatMap((match: any) =>
          match.linked_match_ids?.length
            ? match.linked_match_ids
            : [match.id]
        )
      )
    );

    const displayMatchByLinkedMatch = new Map<string, string>();

    prochainsMatchs.forEach((match: any) => {
      const linkedIds =
        match.linked_match_ids?.length
          ? match.linked_match_ids
          : [match.id];

      linkedIds.forEach((linkedId: string) => {
        displayMatchByLinkedMatch.set(linkedId, match.id);
      });
    });

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

    const userIds = Array.from(
      new Set(
        (pronos || [])
          .map((prediction: any) => prediction.user_id)
          .filter(Boolean)
      )
    );

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id,pseudo")
          .in("id", userIds)
      : { data: [] };

    const pseudoByUser = new Map(
      (profiles || []).map((profile: any) => [
        profile.id,
        profile.pseudo || "Joueur",
      ])
    );

    const tendancesMap: any = {};
    const scoresParMatch: any = {};
    const scorePlayersParMatch: any = {};
    const countedUsersByMatch = new Set<string>();

    for (const match of prochainsMatchs) {
      tendancesMap[match.id] = {
        home: 0,
        draw: 0,
        away: 0,
        topScores: [],
        scorePlayers: {},
      };
    }

    (pronos || []).forEach((prediction: any) => {
      const displayMatchId =
        displayMatchByLinkedMatch.get(
          prediction.match_id
        ) || prediction.match_id;

      const tendance = tendancesMap[displayMatchId];

      if (!tendance) return;

      const countedKey =
        `${displayMatchId}:${prediction.user_id}`;

      if (countedUsersByMatch.has(countedKey)) {
        return;
      }

      countedUsersByMatch.add(countedKey);

      if (prediction.pred_home > prediction.pred_away) tendance.home++;
      else if (prediction.pred_home < prediction.pred_away) tendance.away++;
      else tendance.draw++;

      const score =
        `${prediction.pred_home}-${prediction.pred_away}`;

      scoresParMatch[displayMatchId] =
        scoresParMatch[displayMatchId] || {};

      scoresParMatch[displayMatchId][score] =
        (scoresParMatch[displayMatchId][score] || 0) + 1;

      scorePlayersParMatch[displayMatchId] =
        scorePlayersParMatch[displayMatchId] || {};

      scorePlayersParMatch[displayMatchId][score] =
        scorePlayersParMatch[displayMatchId][score] || [];

      scorePlayersParMatch[displayMatchId][score].push(
        pseudoByUser.get(prediction.user_id) || "Joueur"
      );
    });

    Object.entries(tendancesMap).forEach(
      ([matchId, tendance]: any) => {
        tendance.scorePlayers =
          scorePlayersParMatch[matchId] || {};

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

      const prochainsMatchsBruts =
        getMatchsAutourAujourdhui(
          (allMatches || []).map((match: any) => ({
            ...match,
            concours_nom:
              concoursNames.get(match.concours_id) || "",
          }))
        );

      const prochainsMatchs =
        grouperMatchsMultiConcours(prochainsMatchsBruts);

      setMatchs48h(prochainsMatchs);

      const displayMatchByLinkedMatch = new Map<
        string,
        string
      >();

      prochainsMatchs.forEach((match: any) => {
        const linkedIds =
          match.linked_match_ids?.length
            ? match.linked_match_ids
            : [match.id];

        linkedIds.forEach((linkedId: string) => {
          displayMatchByLinkedMatch.set(linkedId, match.id);
        });
      });

      const savedMap: any = {};
      const predictionsMap: any = {};
      const pointsMap: any = {};

      if (session?.access_token) {
        for (const concoursId of concoursIds) {
          const predictionsResponse = await fetch(
            `/api/predictions?concoursId=${concoursId}`,
            {
              cache: "no-store",
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
              const displayMatchId =
                displayMatchByLinkedMatch.get(
                  prediction.match_id
                );

              savedMap[prediction.match_id] = true;
              predictionsMap[prediction.match_id] = {
                pred_home: prediction.pred_home,
                pred_away: prediction.pred_away,
                locked_odds:
                  prediction.locked_odds ??
                  prediction.prediction_odds,
              };

              if (displayMatchId) {
                savedMap[displayMatchId] = true;
                predictionsMap[displayMatchId] = {
                  pred_home: prediction.pred_home,
                  pred_away: prediction.pred_away,
                  locked_odds:
                    prediction.locked_odds ??
                    prediction.prediction_odds,
                };
              }
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
            const displayMatchId =
              displayMatchByLinkedMatch.get(row.match_id);

            pointsMap[row.match_id] = {
              points: row.points,
              exact_score: row.exact_score,
            };

            if (displayMatchId) {
              pointsMap[displayMatchId] = {
                points:
                  (pointsMap[displayMatchId]?.points || 0) +
                  (row.points || 0),
                exact_score:
                  pointsMap[displayMatchId]?.exact_score ||
                  row.exact_score,
              };
            }
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

    const displayMatchByLinkedMatch = new Map<string, string>();

    matchs48h.forEach((match: any) => {
      const linkedIds =
        match.linked_match_ids?.length
          ? match.linked_match_ids
          : [match.id];

      linkedIds.forEach((linkedId: string) => {
        displayMatchByLinkedMatch.set(linkedId, match.id);
      });
    });

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

            const displayMatchId =
              displayMatchByLinkedMatch.get(
                prediction.match_id
              );

            if (displayMatchId) {
              next[displayMatchId] = {
                ...next[displayMatchId],
                pred_home: prediction.pred_home,
                pred_away: prediction.pred_away,
                locked_odds:
                  prediction.locked_odds ??
                  prediction.prediction_odds,
              };
            }
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

          const displayMatchId =
            displayMatchByLinkedMatch.get(
              prediction.match_id
            );

          if (displayMatchId) {
            next[displayMatchId] = true;
          }
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

          const displayMatchId =
            displayMatchByLinkedMatch.get(
              prediction.match_id
            );

          if (displayMatchId) {
            next[displayMatchId] = false;
          }
        }
      );

      return next;
    });

    await chargerDetailsAujourdhui(matchs48h);
  }

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 md:p-10 md:ml-64">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <LoadingAnimation message="Chargement des pronostics..." />
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
