"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import AujourdHuiTab from "./components/AujourdHuiTab";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import {
  getStoredAfterExtraTimeScore,
  getStoredPenaltyScore,
  shouldShowAfterExtraTimeScore,
  shouldShowPenaltyScore,
} from "@/lib/matchScores";

export default function ConcoursDetailPage() {

  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const concoursId = params.id as string;
  const [concours, setConcours] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [classement, setClassement] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createurPseudo, setCreateurPseudo] = useState("");

  const [onglet, setOnglet] = useState(
  searchParams.get("tab") || "aujourdhui"
  );
  const [copieOk, setCopieOk] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>({});
  const [savedPredictions, setSavedPredictions] = useState<any>({});
  const [modifiedPredictions, setModifiedPredictions] = useState<any>({});
  const [userPointsByMatch, setUserPointsByMatch] = useState<any>({});
  const [userPronosCount, setUserPronosCount] = useState(0);
  const [totalMatchesCount, setTotalMatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchs48h, setMatchs48h] = useState<any[]>([]);
  const [tendances, setTendances] = useState<any>({});
  const [formesEquipes, setFormesEquipes] = useState<any>({});
  const [
    notificationPermission,
    setNotificationPermission,
  ] = useState<NotificationPermission>("default");
  
  


 

  
useEffect(() => {
  chargerConcours();
}, []);

const reminderWindowHours = 6;
const upcomingReminderMatches = matches.filter(
  (match: any) => {
    const now = Date.now();
    const matchTime = new Date(
      match.match_date
    ).getTime();

    return (
      match.status !== "finished" &&
      matchTime > now &&
      matchTime <=
        now +
          reminderWindowHours *
            60 *
            60 *
            1000 &&
      !savedPredictions[match.id]
    );
  }
);

useEffect(() => {
  if ("Notification" in window) {
    setNotificationPermission(
      Notification.permission
    );
  }
}, []);

useEffect(() => {

  const interval = setInterval(() => {

    if (onglet === "matchs") {
      chargerConcours(false);
    }

  }, 60000);

  return () => clearInterval(interval);

}, [onglet]);


async function chargerConcours(showLoader = true) {
  if (showLoader) {
    setLoading(true);
  }
  console.time("chargerConcours");

  try {

    // ton code

  

  fetch(`/api/ranking/${concoursId}`)
    .then((response) => response.json())
    .then((rankingData) =>
      setClassement(rankingData)
    )
    .catch(console.error);
  
  const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) return;
const { data: profil } = await supabase
  .from("profiles")
  .select("is_admin")
  .eq("id", user.id)
  .single();

const isAdminUser = profil?.is_admin || false;

const {
  data: { session },
} = await supabase.auth.getSession();

const pointsMap: any = {};
let userPronos: any[] = [];

if (session?.access_token) {
  try {
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

    userPronos =
      predictionsResult.predictions || [];

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
  } catch (error) {
    console.error(error);
  }
}

setUserPointsByMatch(pointsMap);

  // Chargement des matchs
  let { data: matchsData } = await supabase
    .from("matches")
    .select("*")
    .eq("concours_id", concoursId)
    .order("match_date", { ascending: true });

  const concoursMatchIds = new Set(
    (matchsData || []).map((match: any) => match.id)
  );

  const concoursPronos = userPronos.filter(
    (p: any) => concoursMatchIds.has(p.match_id)
  );

  const savedMap: any = {};
  const predictionsMap: any = {};

  concoursPronos.forEach((p: any) => {
    savedMap[p.match_id] = true;

    predictionsMap[p.match_id] = {
      pred_home: p.pred_home,
      pred_away: p.pred_away,
      locked_odds:
        p.locked_odds ??
        p.prediction_odds,
    };
  });

  setSavedPredictions(savedMap);
  setPredictions(predictionsMap);
  setUserPronosCount(concoursPronos.length);

  const hasMissingOdds =
    (matchsData || []).some(
      (match: any) =>
        match.cote_home == null ||
        match.cote_draw == null ||
        match.cote_away == null
    );

  if (hasMissingOdds) {
    actualiserCotesManquantes();
  }

  setMatches(matchsData || []);
  const now = new Date();

const limitePasse = new Date(
  now.getTime() - 24 * 60 * 60 * 1000
);

const limiteFuture = new Date(
  now.getTime() + 48 * 60 * 60 * 1000
);

const prochainsMatchs =
  (matchsData || []).filter((m: any) => {

    const dateMatch =
      new Date(m.match_date);

    return (
      dateMatch >= limitePasse &&
      dateMatch <= limiteFuture
    );

  });

setMatchs48h(prochainsMatchs);

chargerDetailsAujourdhui(prochainsMatchs);
  setTotalMatchesCount(matchsData?.length || 0);


if (!isAdminUser) {
  const { data: inscription } = await supabase
    .from("participants_concours")
    .select("id")
    .eq("concours_id", concoursId)
    .eq("joueur_id", user.id)
    .maybeSingle();

  if (!inscription) {
    alert("Vous n'avez pas accès à ce concours.");
    router.push("/concours");
    return;
  }
}

  // Chargement concours
  const { data: concoursData } = await supabase
    .from("concours")
    .select("*")
    .eq("id", concoursId)
    .single();

  if (concoursData) {
    setConcours(concoursData);
  }

  // Participants
  const { data: participantsData } = await supabase
    .from("participants_concours")
    .select(`
      id,
      joueur_id,
      points,
      created_at,
      profiles:joueur_id (
        pseudo,
        avatar_url,
        first_name,
        last_name,
        company
      )
    `)
    .eq("concours_id", concoursId);

  setParticipants(
    (participantsData || []).sort(
      (a: any, b: any) => b.points - a.points
    )
  );

  // Créateur
  if (concoursData?.createur) {

    const { data: createurData } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", concoursData.createur)
      .single();

    setCreateurPseudo(
      createurData?.pseudo || ""
    );
  }

  setIsAdmin(isAdminUser);
  
  } finally {
    if (showLoader) {
      setLoading(false);
    }
    console.timeEnd("chargerConcours");

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
    alert("Vous devez être connecté");
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

  setMatches((prev: any[]) =>
    prev.map((match: any) => {
      const updatedMatch = updatedById.get(match.id);

      return updatedMatch
        ? {
            ...match,
            ...updatedMatch,
          }
        : match;
    })
  );

  setMatchs48h((prev: any[]) =>
    prev.map((match: any) => {
      const updatedMatch = updatedById.get(match.id);

      return updatedMatch
        ? {
            ...match,
            ...updatedMatch,
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

  if (!savedPredictions[matchId]) {
    setUserPronosCount((count) => count + 1);
  }
  //alert("Pronostic enregistré");



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


}

async function quitterConcours(id: string) {
  if (!confirm("Quitter ce concours ?")) return;

  const { error } = await supabase
    .from("participants_concours")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  chargerConcours();
}

async function chargerTendances(matchId: string) {

  const { data: match } = await supabase
    .from("matches")
    .select("id,api_match_id")
    .eq("id", matchId)
    .single();

  let matchIds = [matchId];

  if (match?.api_match_id) {
    const { data: linkedMatches } = await supabase
      .from("matches")
      .select("id")
      .eq("api_match_id", match.api_match_id);

    matchIds =
      linkedMatches?.map((linkedMatch: any) => linkedMatch.id) ||
      [matchId];
  }

  const { data } = await supabase
    .from("predictions")
    .select("*")
    .in("match_id", matchIds);

  const predictionsByUser = new Map<string, any>();

  (data || []).forEach((prediction: any) => {
    if (!predictionsByUser.has(prediction.user_id)) {
      predictionsByUser.set(
        prediction.user_id,
        prediction
      );
    }
  });

  let home = 0;
  let draw = 0;
  let away = 0;

  const scores: Record<string, number> = {};

  Array.from(predictionsByUser.values()).forEach((p: any) => {

    if (p.pred_home > p.pred_away) home++;
    else if (p.pred_home < p.pred_away) away++;
    else draw++;

    const score =
      `${p.pred_home}-${p.pred_away}`;

    scores[score] =
      (scores[score] || 0) + 1;

  });

  const total =
    home + draw + away;

  return {
    home,
    draw,
    away,

    homePct:
      total > 0
        ? Math.round((home / total) * 100)
        : 0,

    drawPct:
      total > 0
        ? Math.round((draw / total) * 100)
        : 0,

    awayPct:
      total > 0
        ? Math.round((away / total) * 100)
        : 0,

    topScores: Object.entries(scores)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5),
  };
}

function getMatchsAutourAujourdhui(
  matchsData: any[]
) {
  const now = new Date();

  const limitePasse = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  );

  const limiteFuture = new Date(
    now.getTime() + 48 * 60 * 60 * 1000
  );

  return matchsData.filter((m: any) => {
    const dateMatch =
      new Date(m.match_date);

    return (
      dateMatch >= limitePasse &&
      dateMatch <= limiteFuture
    );
  });
}

async function chargerDetailsAujourdhui(
  prochainsMatchs: any[]
) {
  if (!prochainsMatchs.length) {
    setTendances({});
    setFormesEquipes({});
    return;
  }

  const apiMatchIds = Array.from(
    new Set(
      prochainsMatchs
        .map((match: any) => match.api_match_id)
        .filter(Boolean)
    )
  );

  const { data: linkedMatches } =
    apiMatchIds.length > 0
      ? await supabase
          .from("matches")
          .select("id,api_match_id")
          .in("api_match_id", apiMatchIds)
      : { data: [] };

  const linkedMatchesByApi = new Map<string, string[]>();

  (linkedMatches || []).forEach((linkedMatch: any) => {
    const apiMatchId = linkedMatch.api_match_id;

    if (!apiMatchId) return;

    const ids =
      linkedMatchesByApi.get(apiMatchId) || [];

    ids.push(linkedMatch.id);
    linkedMatchesByApi.set(apiMatchId, ids);
  });

  const displayMatchByLinkedMatch =
    new Map<string, string>();

  prochainsMatchs.forEach((match: any) => {
    const linkedIds =
      match.api_match_id
        ? linkedMatchesByApi.get(match.api_match_id)
        : null;

    const ids = linkedIds?.length
      ? linkedIds
      : [match.id];

    ids.forEach((linkedId: string) => {
      displayMatchByLinkedMatch.set(linkedId, match.id);
    });
  });

  const matchIds = Array.from(
    new Set(displayMatchByLinkedMatch.keys())
  );

  const equipes = Array.from(
    new Set(
      prochainsMatchs.flatMap((match: any) => [
        match.home_team,
        match.away_team,
      ])
    )
  );

  const tendancesPromise = supabase
    .from("predictions")
    .select("*")
    .in("match_id", matchIds);

  const formesPromise = Promise.all(
    equipes.map(async (equipe: any) => [
      equipe,
      await chargerFormeEquipe(equipe),
    ])
  );

  const [{ data: pronos }, formesEntries] =
    await Promise.all([
      tendancesPromise,
      formesPromise,
    ]);

  const tendancesMap: any = {};
  const countedUsersByMatch = new Set<string>();

  for (const match of prochainsMatchs) {
    tendancesMap[match.id] = {
      home: 0,
      draw: 0,
      away: 0,
      homePct: 0,
      drawPct: 0,
      awayPct: 0,
      topScores: [],
    };
  }

  const scoresParMatch: any = {};

  (pronos || []).forEach((p: any) => {
    const displayMatchId =
      displayMatchByLinkedMatch.get(p.match_id) ||
      p.match_id;

    const tendance =
      tendancesMap[displayMatchId];

    if (!tendance) return;

    const countedKey =
      `${displayMatchId}:${p.user_id}`;

    if (countedUsersByMatch.has(countedKey)) {
      return;
    }

    countedUsersByMatch.add(countedKey);

    if (p.pred_home > p.pred_away) tendance.home++;
    else if (p.pred_home < p.pred_away) tendance.away++;
    else tendance.draw++;

    const score =
      `${p.pred_home}-${p.pred_away}`;

    scoresParMatch[displayMatchId] =
      scoresParMatch[displayMatchId] || {};

    scoresParMatch[displayMatchId][score] =
      (scoresParMatch[displayMatchId][score] || 0) + 1;
  });

  Object.entries(tendancesMap).forEach(
    ([matchId, tendance]: any) => {
      const total =
        tendance.home +
        tendance.draw +
        tendance.away;

      tendance.homePct =
        total > 0
          ? Math.round((tendance.home / total) * 100)
          : 0;

      tendance.drawPct =
        total > 0
          ? Math.round((tendance.draw / total) * 100)
          : 0;

      tendance.awayPct =
        total > 0
          ? Math.round((tendance.away / total) * 100)
          : 0;

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

async function actualiserCotesManquantes() {
  try {
    await fetch("/api/update-fifa-rankings");

    const { data: refreshedMatches } =
      await supabase
        .from("matches")
        .select("*")
        .eq("concours_id", concoursId)
        .order("match_date", {
          ascending: true,
        });

    if (!refreshedMatches) return;

    setMatches(refreshedMatches);

    const prochainsMatchs =
      getMatchsAutourAujourdhui(refreshedMatches);

    setMatchs48h(prochainsMatchs);
  } catch (error) {
    console.error(error);
  }
}

async function activerNotificationsRappel() {
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    alert(
      "Votre navigateur ne supporte pas les notifications push."
    );
    return;
  }

  const permission =
    await Notification.requestPermission();

  setNotificationPermission(permission);

  if (permission !== "granted") {
    alert(
      "Les notifications ne sont pas autorisÃ©es sur cet appareil."
    );
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    alert("Vous devez Ãªtre connectÃ©");
    return;
  }

  const keyResponse = await fetch(
    "/api/push/public-key"
  );

  const { publicKey } =
    await keyResponse.json();

  if (!publicKey) {
    alert(
      "Les notifications push ne sont pas encore configurÃ©es."
    );
    return;
  }

  await navigator.serviceWorker.register("/sw.js");

  const registration =
    await navigator.serviceWorker.ready;

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(publicKey),
      });
  }

  const response = await fetch(
    "/api/push/subscribe",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    }
  );

  if (!response.ok) {
    const result = await response.json();

    alert(
      result.error ||
        "Impossible d'activer les notifications."
    );
    return;
  }

  alert("Notifications de rappel activÃ©es.");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray =
    new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}

async function chargerFormeEquipe(
  equipe: string
) {

  const { data } = await supabase
    .from("matches")
    .select("*")
    .or(
      `home_team.eq.${equipe},away_team.eq.${equipe}`
    )
    .eq("status", "finished")
    .order("match_date", {
      ascending: false,
    })
    .limit(5);

  return data || [];
}

function renderScoreDetails(match: any) {
  const extraTimeScore =
    getStoredAfterExtraTimeScore(match);

  const penaltyScore =
    getStoredPenaltyScore(match);

  return (
    <div className="mt-2 space-y-1 text-center text-xs text-gray-300">
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

function renderPlayerAvatar(joueur: any) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#D8AA82] flex items-center justify-center text-sm font-bold text-[#1E3047]">
      {joueur.avatar_url ? (
        <img
          src={joueur.avatar_url}
          alt={joueur.pseudo || "Joueur"}
          className="h-full w-full object-cover"
        />
      ) : (
        (joueur.pseudo || "?").slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function getParticipantPlayer(participant: any) {
  const profile = Array.isArray(participant.profiles)
    ? participant.profiles[0]
    : participant.profiles;
  const pseudo = profile?.pseudo || "Joueur";

  return {
    user_id: participant.joueur_id,
    pseudo,
    avatar_url: profile?.avatar_url || null,
    first_name: profile?.first_name || null,
    last_name: profile?.last_name || null,
    company: profile?.company || null,
  };
}

function renderProgressIcon(index: number) {
  if (index === 0) return "🏆";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "↗";
}

function renderRankBadge(index: number) {
  if (index === 0) return renderProgressIcon(0);
  if (index === 1) return renderProgressIcon(1);
  if (index === 2) return renderProgressIcon(2);
  return null;
}

function renderRankTrend(joueur: any) {
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

function getDefaultImportStage(concoursName?: string) {
  const normalized = (concoursName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normalized.includes("1/8") ||
    normalized.includes("huitieme") ||
    normalized.includes("huitiemes") ||
    normalized.includes("last 16")
  ) {
    return "LAST_16";
  }

  return null;
}

  async function copierCode() {
    if (!concours?.code_acces) return;

    await navigator.clipboard.writeText(concours.code_acces);

    setCopieOk(true);

    setTimeout(() => {
      setCopieOk(false);
    }, 2000);
  }

async function importerMatchs(fromStage?: string) {
  try {
    const effectiveFromStage =
      fromStage ||
      getDefaultImportStage(concours?.nom);

    const importLabel =
      effectiveFromStage === "LAST_16"
        ? "les matchs depuis les huitiemes"
        : "toute la competition";

    if (
      !confirm(
        `Importer ${importLabel} dans ce concours ?`
      )
    ) {
      return;
    }

    const response = await fetch("/api/import-matches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        concoursId,
        fromStage: effectiveFromStage,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Erreur");
      return;
    }

    alert(
      `${result.imported} matchs importés\n${result.ignored} ignorés`
    );

    await chargerConcours();

  } catch (error) {
    console.error(error);
    alert("Erreur lors de l'import");
  }
}

if (loading) {
  return (
    <div className="min-h-screen bg-[#1E3047] flex flex-col items-center justify-center text-white">

      {/* Logo */}
      <img
        src="/logo-ej-prono.png"
        alt="EJ Prono"
        className="w-48 mb-8"
      />

      {/* Ballon */}
      <div className="ballon text-6xl">
        ⚽
      </div>

      {/* Texte */}
      <p className="mt-6 text-2xl font-semibold text-[#D8AA82]">
        Chargement du concours...
      </p>

      {/* Points animés */}
      <div className="flex gap-2 mt-4">
        <div className="w-3 h-3 bg-[#D8AA82] rounded-full animate-bounce"></div>
        <div
          className="w-3 h-3 bg-[#D8AA82] rounded-full animate-bounce"
          style={{ animationDelay: "0.15s" }}
        ></div>
        <div
          className="w-3 h-3 bg-[#D8AA82] rounded-full animate-bounce"
          style={{ animationDelay: "0.3s" }}
        ></div>
      </div>

    </div>
  );
}


  const matchsParGroupe = matches.reduce(
  (acc: any, match: any) => {
   const groupe = match.groupe || "PHASES_FINALES";

    if (!acc[groupe]) {
      acc[groupe] = [];
    }

    acc[groupe].push(match);

    return acc;
  },
  {}
);

const phaseLabels: Record<string, string> = {
  GROUP_STAGE: "Phase de groupes",
  LAST_16: "Huitièmes de finale",
  QUARTER_FINALS: "Quarts de finale",
  SEMI_FINALS: "Demi-finales",
  THIRD_PLACE: "Match pour la 3e place",
  FINAL: "Finale",
};

const hasFinalPhaseMatch = matches.some(
  (match: any) =>
    match.phase &&
    match.phase !== "GROUP_STAGE"
);

  return (
    <div className="min-h-screen bg-[#1E3047] text-white flex">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 md:p-10 md:ml-64">
        <div className="max-w-6xl w-full mx-auto">

          {/* HEADER */}
          <div className="bg-[#33465D] rounded-3xl p-8 mb-8 shadow-lg overflow-hidden">

            {concours.image_url && (
              <img
                src={concours.image_url}
                alt={concours.nom}
                className="-mx-8 -mt-8 mb-8 h-48 w-[calc(100%+4rem)] object-cover"
              />
            )}

            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <h1 className="text-3xl md:text-6xl font-bold mb-3 break-words">
                  {concours.nom}
                </h1>

                {concours.description && (
                  <p className="text-gray-300 text-lg max-w-3xl">
                    {concours.description}
                  </p>
                )}
              </div>

              {isAdmin && (

  <Link
    href={`/concours/${params.id}/modifier`}
className="
  w-full
  md:w-auto
  text-center
  bg-red-500
  text-white
  px-6
  py-3
  rounded-xl
  font-semibold
  hover:bg-red-600
  transition
"
  >
    Modifier
  </Link>
)}

            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">

              {/* CODE ACCES */}
              <div>
                <p className="text-[#D8AA82] font-semibold mb-2">
                  Code d'accès
                </p>

                <div className="flex items-center gap-3">

                  <button
                    onClick={copierCode}
                    className="
                      bg-[#1E3047]
                      border
                      border-[#42546B]
                      px-5
                      py-3
                      rounded-xl
                      font-mono
                      text-base md:text-xl
                      tracking-[0.15em] md:tracking-[0.25em]
                      hover:border-[#D8AA82]
                      transition
                    "
                  >
                    {concours.code_acces}
                    <span className="ml-3">📋</span>
                  </button>

                  {copieOk && (
                    <span className="text-green-400 font-medium animate-pulse">
                      ✅ Copié !
                    </span>
                  )}

                </div>
              </div>

              {/* PARTICIPANTS */}
              <div>
                <p className="text-[#D8AA82] font-semibold mb-2">
                  Participants
                </p>

                <p className="text-3xl font-bold">
                  {participants.length}
                  {concours.max_joueurs
                    ? ` / ${concours.max_joueurs}`
                    : ""}
                </p>
              </div>

              {/* DATE DEBUT */}
              <div>
                <p className="text-[#D8AA82] font-semibold mb-2">
                  Début
                </p>

                <p className="text-2xl font-semibold">
                  {new Date(
                    concours.date_debut
                  ).toLocaleDateString("fr-FR")}
                </p>
              </div>

              {/* DATE FIN */}
              <div>
                <p className="text-[#D8AA82] font-semibold mb-2">
                  Fin
                </p>

                <p className="text-2xl font-semibold">
                  {new Date(
                    concours.date_fin
                  ).toLocaleDateString("fr-FR")}
                </p>
              </div>

              {/* CREATEUR */}
              <div>
                <p className="text-[#D8AA82] font-semibold mb-2">
                  Créateur
                </p>

                <p className="text-2xl font-semibold">
                  👑 {createurPseudo}
                </p>
              </div>

            </div>
          </div>

          {upcomingReminderMatches.length > 0 && (
            <div className="bg-[#D8AA82] text-[#1E3047] rounded-xl p-4 mb-8 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="font-bold text-lg">
                    Rappel pronostics
                  </p>

                  <p className="font-medium">
                    Il vous reste {upcomingReminderMatches.length} match
                    {upcomingReminderMatches.length > 1 ? "s" : ""} a pronostiquer dans les {reminderWindowHours} prochaines heures.
                  </p>

                  <p className="text-sm mt-1">
                    Prochain match : {upcomingReminderMatches[0].home_team} vs {upcomingReminderMatches[0].away_team}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setOnglet("pronostics")}
                    className="bg-[#1E3047] text-white px-4 py-3 rounded-lg font-bold"
                  >
                    Faire mes pronos
                  </button>

                  {typeof window !== "undefined" &&
                    "Notification" in window &&
                    notificationPermission === "default" && (
                      <button
                        onClick={activerNotificationsRappel}
                        className="bg-white text-[#1E3047] px-4 py-3 rounded-lg font-bold"
                      >
                        Activer les rappels
                      </button>
                    )}

                  {notificationPermission === "granted" && (
                    <div className="bg-white/70 text-[#1E3047] px-4 py-3 rounded-lg font-bold text-center">
                      Notifications activees
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATISTIQUES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

            <div className="bg-[#33465D] p-6 rounded-2xl shadow">
              <p className="text-gray-400">
                Participants
              </p>

              <p className="text-4xl font-bold mt-2">
                {participants.length}
              </p>
            </div>

            <div className="bg-[#33465D] p-6 rounded-2xl shadow">
              <p className="text-gray-400">
                Matchs
              </p>

              <p className="text-4xl font-bold mt-2">
              {matches.length}
              </p>
            </div>

            <div className="bg-[#33465D] p-6 rounded-2xl shadow">
              <p className="text-gray-400">
                Pronostics
              </p>

              <p className="text-4xl font-bold mt-2">
                 {userPronosCount} / {totalMatchesCount}
              </p>
            </div>

          </div>

          {/* ONGLETS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">

            <button
              onClick={() => setOnglet("classement")}
              className={`p-3 md:p-5 rounded-xl font-semibold text-sm md:text-lg transition ${
                onglet === "classement"
                  ? "bg-[#D8AA82]"
                  : "bg-[#33465D] hover:bg-[#42546B]"
              }`}
            >
              🏆 Classement
            </button>

            <button
              onClick={() => setOnglet("pronostics")}
              className={`p-3 md:p-5 rounded-xl font-semibold text-sm md:text-lg transition ${
                onglet === "pronostics"
                  ? "bg-[#D8AA82]"
                  : "bg-[#33465D] hover:bg-[#42546B]"
              }`}
            >
              🌍 Pronostics
            </button>

            <button
            onClick={() =>
            setOnglet("aujourdhui")
            }
            className={`p-3 md:p-5 rounded-xl font-semibold text-sm md:text-lg transition ${
            onglet === "aujourdhui"
            ? "bg-[#D8AA82]"
            : "bg-[#33465D] hover:bg-[#42546B]"
            }`}
            >
            🔥 Aujourd'hui
            </button>

            <button
              onClick={() => setOnglet("matchs")}
              className={`p-3 md:p-5 rounded-xl font-semibold text-sm md:text-lg transition ${
                onglet === "matchs"
                  ? "bg-[#D8AA82]"
                  : "bg-[#33465D] hover:bg-[#42546B]"
              }`}
            >
              📅 Matchs
            </button>

            <button
              onClick={() => setOnglet("participants")}
              className={`p-3 md:p-5 rounded-xl font-semibold text-sm md:text-lg transition ${
                onglet === "participants"
                  ? "bg-[#D8AA82]"
                  : "bg-[#33465D] hover:bg-[#42546B]"
              }`}
            >
              👥 Participants
            </button>

          </div>

          {/* CONTENU */}
          <div className="bg-[#33465D] rounded-3xl p-8 shadow-lg">

{onglet === "aujourdhui" && (

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

)}


            {onglet === "classement" && (
              

<div className="bg-[#33465D] rounded-2xl p-6">

  <h2 className="text-3xl font-bold mb-6">
    🏆 Classement
  </h2>

  <div className="overflow-x-auto">
  <table className="w-full min-w-[600px]">

    <thead>
      <tr className="border-b border-gray-500">

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

      {classement.map((joueur, index) => (

        <tr
          key={index}
          className="border-b border-gray-700"
        >

          <td className="p-3">
            <button
              type="button"
              onClick={() => setSelectedPlayer(joueur)}
              className="flex items-center gap-3 text-left hover:text-[#D8AA82]"
            >
              {renderPlayerAvatar(joueur)}

              <div className="flex items-center gap-2 font-semibold">
                {renderRankBadge(index) && (
                  <span>{renderRankBadge(index)}</span>
                )}
                <span>{joueur.pseudo}</span>
                {renderRankTrend(joueur)}
              </div>
            </button>
          </td>

          <td className="text-center p-3">
            {joueur.points}
          </td>

          <td className="text-center p-3">
            {joueur.bons_pronos}
          </td>

          <td className="text-center p-3">
            {joueur.scores_exacts}
          </td>

        </tr>

      ))}

    </tbody>

  </table>
</div>
</div>
)}

          {onglet === "pronostics" && (
  <>
    <h2 className="text-2xl md:text-4xl font-bold mb-6">
      🌍 Pronostics
    </h2>

    {hasFinalPhaseMatch && (
      <div className="bg-[#D8AA82] text-[#1E3047] rounded-xl p-4 font-semibold mb-6">
        Info phases finales : les pronostics sont comptabilises sur le score a la fin du temps reglementaire (90 min), hors prolongation et tirs au but.
      </div>
    )}

    <div className="space-y-4">

      {matches.map((match) => (

        <div
          key={match.id}
          className="bg-[#42546B] rounded-2xl p-5"
        >

          <div className="flex flex-col lg:flex-row gap-4 lg:justify-between lg:items-center">

            <div>
              <div className="font-bold text-lg md:text-xl break-words">
                {match.home_team} vs {match.away_team}
              </div>

              <div className="text-gray-400 text-sm">
<div className="text-sm text-gray-300">
  📅 {new Date(match.match_date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}
</div>

<div className="text-sm text-gray-300">
  🕘 {new Date(match.match_date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}
</div>
              </div>
            </div>
            


<div className="flex flex-wrap items-center gap-2">

  <div className="bg-green-700 px-3 py-2 rounded flex items-center gap-2">
    {match.home_logo && (
      <img
        src={match.home_logo}
        alt={match.home_team}
        className="w-6 h-6 object-contain"
      />
    )}
    <span className="font-bold">
      {match.cote_home ?? "--"}
    </span>
  </div>

  <div className="bg-gray-600 px-3 py-2 rounded flex items-center gap-2">
    <span>🤝</span>
    <span className="font-bold">
      {match.cote_draw ?? "--"}
    </span>
  </div>

  <div className="bg-blue-700 px-3 py-2 rounded flex items-center gap-2">
    {match.away_logo && (
      <img
        src={match.away_logo}
        alt={match.away_team}
        className="w-6 h-6 object-contain"
      />
    )}
    <span className="font-bold">
      {match.cote_away ?? "--"}
    </span>
  </div>

</div>


            <div className="flex flex-wrap items-center gap-3">

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
                className="
                  w-16
                  text-center
                  bg-[#1E3047]
                  rounded-lg
                  p-2
                "
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
                className="
                  w-16
                  text-center
                  bg-[#1E3047]
                  rounded-lg
                  p-2
                "
              />


{savedPredictions[match.id] && !modifiedPredictions[match.id] ? (
  <div className="flex flex-wrap items-center gap-2">
    <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-center">
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
    onClick={() => enregistrerPronostic(match.id)}
    className="
      bg-[#D8AA82]
      text-[#1E3047]
      px-4
      py-2
      rounded-lg
      font-bold
    "
  >
    Enregistrer
  </button>
)}


            </div>

            {match.status === "finished" &&
              userPointsByMatch?.[match.id] && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-[#1E3047] px-3 py-2 text-sm font-bold text-[#D8AA82]">
                <span>Points remportes</span>
                <span className="text-white">
                  +{userPointsByMatch[match.id].points}
                </span>
                {userPointsByMatch[match.id].exact_score && (
                  <span className="rounded bg-green-600 px-2 py-1 text-xs text-white">
                    Score exact
                  </span>
                )}
              </div>
            )}

          </div>



        </div>

      ))}

    </div>
  </>
)}

{onglet === "matchs" && (
  <div className="bg-[#33465D] rounded-3xl p-8">

    <div className="flex flex-col md:flex-row gap-4 md:justify-between md:items-center mb-8">
      <h2 className="text-2xl md:text-5xl font-bold">
        📅 Matchs
      </h2>

{isAdmin && (
  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">

    <button
      onClick={() =>
        router.push(`/concours/${params.id}/matchs/ajouter`)
      }
      className="w-full md:w-auto bg-[#D8AA82] text-white px-5 py-3 rounded-xl font-semibold hover:opacity-90"
    >
      ➕ Ajouter un match
    </button>

    <button
      onClick={() =>
        importerMatchs(
          getDefaultImportStage(concours?.nom) || undefined
        )
      }
      className="w-full md:w-auto bg-green-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-700"
    >
      {getDefaultImportStage(concours?.nom)
        ? "Importer phases finales"
        : "🌍 Importer compétition"}
    </button>

    <button
      onClick={() => importerMatchs("LAST_16")}
      className="w-full md:w-auto bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700"
    >
      Importer depuis les 1/8
    </button>

  </div>
)}


</div>

<div className="space-y-5">
  {Object.entries(matchsParGroupe)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupe, matchs]: any) => (

      <div key={groupe}>

        <div
  className="
    inline-block
    bg-[#D8AA82]
    text-[#1E3047]
    font-bold
    px-4
    py-2
    rounded-xl
    mb-4
  "
>
        {groupe.startsWith("GROUP_")
        ? groupe.replace("GROUP_", "Groupe ")
        : "🏆 Phases finales"}
        </div>

        <div className="space-y-4">

          {matchs.map((match: any) => (

            <div
              key={match.id}
              className="bg-[#425773] rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:justify-between md:items-center"
            >
              <div>
<div className="flex flex-col md:flex-row items-start md:items-center gap-3">

  <div className="flex items-center gap-2 bg-[#33465D] px-3 py-2 rounded-xl">
    {match.home_logo && (
      <img
        src={match.home_logo}
        alt={match.home_team}
        className="w-8 h-8 object-contain"
      />
    )}

    <span>{match.home_team}</span>
  </div>

  <span className="text-gray-400 font-semibold">
    vs
  </span>

  <div className="flex items-center gap-2 bg-[#33465D] px-3 py-2 rounded-xl">
    {match.away_logo && (
      <img
        src={match.away_logo}
        alt={match.away_team}
        className="w-8 h-8 object-contain"
      />
    )}

    <span>{match.away_team}</span>
  </div>

</div>

                <div className="text-gray-300 text-sm mt-1">
                  {new Date(match.match_date).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  })}

                </div>
                  {match.phase && (
                  <div className="text-[#D8AA82] text-sm mt-1">
                   {phaseLabels[match.phase] || match.phase}
                  </div>
                  )}

              </div>

<div className="text-center">

  {match.status === "live" && (
    <>
      <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse mb-2">
        🔴 LIVE {match.live_minute ? `${match.live_minute}'` : ""}
      </div>

      <div className="text-4xl font-bold text-red-400">
        {match.home_score ?? 0} - {match.away_score ?? 0}
      </div>

      {renderScoreDetails(match)}

      {match.live_status && (
        <div className="text-xs text-gray-300 mt-1">
          {match.live_status}
        </div>
      )}
    </>
  )}

  {match.status === "finished" && (
    <>
      <div className="bg-green-700 text-white px-3 py-1 rounded-full text-sm font-bold mb-2">
        ✅ Terminé
      </div>

      <div className="text-4xl font-bold text-[#D8AA82]">
        {match.home_score} - {match.away_score}
      </div>

      {renderScoreDetails(match)}
    </>
  )}

  {match.status === "scheduled" && (
    <>
      <div className="bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-bold mb-2">
        ⏳ À venir
      </div>

      <div className="text-gray-300">
        Match non commencé
      </div>
    </>
  )}

</div>

            </div>

          ))}

        </div>

      </div>

  ))}
</div>

  </div>
)}

{onglet === "participants" && (
  <>
    <h2 className="text-2xl md:text-4xl font-bold mb-6">
      👥 Participants
    </h2>

    {participants.length === 0 ? (
      <p className="text-gray-300">
        Aucun participant.
      </p>
    ) : (
      <div className="space-y-4">

        {participants.map((participant) => (

          <div
            key={participant.id}
            className="bg-[#42546B] rounded-xl p-4 flex flex-col md:flex-row gap-4 md:justify-between md:items-center"
          >

            <button
              type="button"
              onClick={() =>
                setSelectedPlayer(
                  getParticipantPlayer(participant)
                )
              }
              className="flex items-center gap-3 text-left hover:text-[#D8AA82]"
            >
  {renderPlayerAvatar(getParticipantPlayer(participant))}

  <div>
    <div className="flex items-center gap-2">
      <span className="font-semibold text-white">
        {getParticipantPlayer(participant).pseudo}
      </span>
        
      {participant.joueur_id === concours.createur && (
        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-semibold">
          👑 Créateur
        </span>
      )}
    </div>

    <p className="text-sm text-gray-400">
      Inscrit le{" "}
      {new Date(participant.created_at).toLocaleDateString("fr-FR")}
    </p>
  </div>
</button>

            <div className="text-right">
              <p className="text-[#D8AA82] font-bold text-xl">
                {participant.points}
              </p>

              <p className="text-sm text-gray-400">
                points
              </p>
            </div>

          </div>

        ))}

      </div>
    )}
  </>
)}

          </div>

        </div>
      </main>

      <PlayerProfileModal
        player={selectedPlayer}
        concoursId={concoursId}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
