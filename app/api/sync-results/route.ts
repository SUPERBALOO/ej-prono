import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculatePoints } from "@/lib/calculatePoints";
import {
  getApiFootballScoreUpdate,
  hasScorePair,
  getMatchScoreUpdate,
} from "@/lib/matchScores";
import {
  importCompetitionMatches,
  inferImportStageFromConcoursName,
} from "@/lib/importCompetitionMatches";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UPCOMING_WINDOW_HOURS = 3;
const RECENT_WINDOW_HOURS = 6;
const FULL_RECENT_DAYS = 7;
const AUTO_IMPORT_INTERVAL_MINUTES = 15;

function hoursFromNow(hours: number) {
  return new Date(
    Date.now() + hours * 60 * 60 * 1000
  ).toISOString();
}

function getFootballDataStatus(status: string) {
  switch (status) {
    case "LIVE":
    case "IN_PLAY":
    case "PAUSED":
      return "live";

    case "FINISHED":
      return "finished";

    default:
      return "scheduled";
  }
}

function getApiFootballStatus(status?: string | null) {
  switch (status) {
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "SUSP":
    case "INT":
    case "LIVE":
      return "live";

    case "FT":
    case "AET":
    case "PEN":
      return "finished";

    default:
      return "scheduled";
  }
}

function getMatchProvider(match: any) {
  return (
    match.competition?.api_provider ||
    match.competitions?.api_provider ||
    "football-data"
  );
}

function getApiResponseKey(provider: string, apiMatchId: any) {
  return `${provider}:${String(apiMatchId)}`;
}

function getApiFootballTeamSide(data: any, teamId: number) {
  if (data.teams?.home?.id === teamId) {
    return "home";
  }

  if (data.teams?.away?.id === teamId) {
    return "away";
  }

  return null;
}

async function getApiFootballRegularScoreFromEvents(
  apiMatchId: string,
  data: any
) {
  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures/events?fixture=${apiMatchId}`,
    {
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY!,
      },
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        `Erreur API-Football events ${response.status}`
    );
  }

  const score = {
    home: 0,
    away: 0,
  };

  for (const event of payload.response || []) {
    if (
      event.type !== "Goal" ||
      event.detail === "Missed Penalty" ||
      Number(event.time?.elapsed ?? 0) > 90
    ) {
      continue;
    }

    const side = getApiFootballTeamSide(
      data,
      event.team?.id
    );

    if (!side) {
      continue;
    }

    const scoringSide =
      event.detail === "Own Goal"
        ? side === "home"
          ? "away"
          : "home"
        : side;

    score[scoringSide]++;
  }

  return score;
}

async function enrichApiFootballScoreUpdate(
  apiMatchId: string,
  data: any,
  status: "scheduled" | "live" | "finished"
) {
  const scoreUpdate = getApiFootballScoreUpdate(
    data,
    status
  );

  const elapsed = Number(
    data.fixture?.status?.elapsed ?? 0
  );

  const hasTiebreakDetails =
    hasScorePair(
      scoreUpdate.extra_time_home_score,
      scoreUpdate.extra_time_away_score
    ) ||
    hasScorePair(
      scoreUpdate.penalty_home_score,
      scoreUpdate.penalty_away_score
    );

  if (
    status !== "finished" ||
    elapsed <= 90 ||
    hasTiebreakDetails ||
    !hasScorePair(
      scoreUpdate.home_score,
      scoreUpdate.away_score
    )
  ) {
    return scoreUpdate;
  }

  const regularScore =
    await getApiFootballRegularScoreFromEvents(
      apiMatchId,
      data
    );

  const finalHome =
    data.goals?.home ??
    data.score?.fulltime?.home ??
    scoreUpdate.home_score;

  const finalAway =
    data.goals?.away ??
    data.score?.fulltime?.away ??
    scoreUpdate.away_score;

  if (
    regularScore.home === finalHome &&
    regularScore.away === finalAway
  ) {
    return scoreUpdate;
  }

  return {
    ...scoreUpdate,
    home_score: regularScore.home,
    away_score: regularScore.away,
    full_time_home_score: finalHome,
    full_time_away_score: finalAway,
    extra_time_home_score:
      finalHome !== null
        ? finalHome - regularScore.home
        : null,
    extra_time_away_score:
      finalAway !== null
        ? finalAway - regularScore.away
        : null,
    score_duration: "EXTRA_TIME",
    score_details: {
      ...scoreUpdate.score_details,
      regularTime: regularScore,
      correctedFromEvents: true,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const apiMatchId =
      req.nextUrl.searchParams.get("apiMatchId");

    const matchId =
      req.nextUrl.searchParams.get("matchId");

    const fullSync =
      req.nextUrl.searchParams.get("full") === "1";

    const importMissingParam =
      req.nextUrl.searchParams.get("importMissing");

    const importMissing =
      importMissingParam !== "0" && !apiMatchId && !matchId;

    const forceImport =
      req.nextUrl.searchParams.get("forceImport") ===
      "1";

    const autoImport = {
      enabled: importMissing,
      attempted: 0,
      imported: 0,
      skipped: 0,
      intervalMinutes: AUTO_IMPORT_INTERVAL_MINUTES,
    };

    if (
      importMissing &&
      (forceImport ||
        new Date().getUTCMinutes() %
          AUTO_IMPORT_INTERVAL_MINUTES ===
          0)
    ) {
      const { data: concoursList, error: concoursError } =
        await supabase
          .from("concours")
          .select("id,nom,competition_id,actif")
          .eq("actif", true)
          .not("competition_id", "is", null);

      if (concoursError) {
        throw concoursError;
      }

      for (const concours of concoursList || []) {
        try {
          const result =
            await importCompetitionMatches({
              supabase,
              concoursId: concours.id,
              fromStage:
                inferImportStageFromConcoursName(
                  concours.nom
                ),
            });

          autoImport.attempted++;
          autoImport.imported += result.imported || 0;
        } catch (error) {
          autoImport.skipped++;
          console.error(
            `Erreur import auto concours ${concours.id}`,
            error
          );
        }
      }
    }

    let query = supabase
      .from("matches")
      .select("*")
      .not("api_match_id", "is", null);

    if (apiMatchId) {
      query = query.eq("api_match_id", apiMatchId);
    } else if (matchId) {
      query = query.eq("id", matchId);
    } else {
      const windowStart = hoursFromNow(
        -RECENT_WINDOW_HOURS
      );
      const windowEnd = hoursFromNow(
        UPCOMING_WINDOW_HOURS
      );

      query = query.or(
        [
          "status.eq.live",
          `and(status.eq.scheduled,match_date.gte.${windowStart},match_date.lte.${windowEnd})`,
          `and(status.eq.finished,match_date.gte.${windowStart})`,
        ].join(",")
      );
    }

    const { data: activeMatches, error } =
      await query;

    if (error) {
      throw error;
    }

    const recentLimit = new Date(
      Date.now() -
        FULL_RECENT_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const {
      data: recentFinishedMatches,
      error: recentFinishedError,
    } =
      apiMatchId || matchId || !fullSync
        ? { data: [], error: null }
        : await supabase
            .from("matches")
            .select("*")
            .not("api_match_id", "is", null)
            .eq("status", "finished")
            .gte("match_date", recentLimit);

    if (recentFinishedError) {
      throw recentFinishedError;
    }

    const matches = Array.from(
      new Map(
        [
          ...(activeMatches || []),
          ...(recentFinishedMatches || []),
        ].map((match) => [match.id, match])
      ).values()
    );

    if (!matches.length) {
      return NextResponse.json({
        success: true,
        updated: 0,
        processed: 0,
        checked: 0,
        candidates: 0,
        mode: fullSync ? "full" : "live-window",
        autoImport,
        message: "Aucun match a synchroniser",
      });
    }

    let updated = 0;
    let processed = 0;

    const concoursIds = Array.from(
      new Set(
        matches
          .map((match: any) => match.concours_id)
          .filter(Boolean)
      )
    );

    const { data: concoursRows, error: concoursError } =
      concoursIds.length
        ? await supabase
            .from("concours")
            .select("id,competition_id")
            .in("id", concoursIds)
        : { data: [], error: null };

    if (concoursError) {
      throw concoursError;
    }

    const competitionIds = Array.from(
      new Set(
        (concoursRows || [])
          .map((concours: any) => concours.competition_id)
          .filter(Boolean)
      )
    );

    const { data: competitions, error: competitionsError } =
      competitionIds.length
        ? await supabase
            .from("competitions")
            .select("*")
            .in("id", competitionIds)
        : { data: [], error: null };

    if (competitionsError) {
      throw competitionsError;
    }

    const competitionById = new Map(
      (competitions || []).map((competition: any) => [
        competition.id,
        competition,
      ])
    );

    const competitionByConcours = new Map(
      (concoursRows || []).map((concours: any) => [
        concours.id,
        competitionById.get(concours.competition_id) ||
          null,
      ])
    );

    const matchesWithProvider = matches.map((match: any) => ({
      ...match,
      competition:
        competitionByConcours.get(match.concours_id) || null,
    }));

    const apiTargets = Array.from(
      new Map(
        matchesWithProvider.map((match: any) => {
          const provider = getMatchProvider(match);

          return [
            getApiResponseKey(provider, match.api_match_id),
            {
              provider,
              apiMatchId: String(match.api_match_id),
            },
          ];
        })
      ).values()
    );

    const apiResponses = new Map<string, any>();

    for (const target of apiTargets) {
      try {
        const response =
          target.provider === "api-football"
            ? await fetch(
                `https://v3.football.api-sports.io/fixtures?id=${target.apiMatchId}`,
                {
                  headers: {
                    "x-apisports-key":
                      process.env.API_FOOTBALL_KEY!,
                  },
                }
              )
            : await fetch(
                `https://api.football-data.org/v4/matches/${target.apiMatchId}`,
                {
                  headers: {
                    "X-Auth-Token":
                      process.env.FOOTBALL_DATA_API_KEY!,
                  },
                }
              );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Erreur ${target.provider} ${response.status}`
          );
        }

        const matchData =
          target.provider === "api-football"
            ? data.response?.[0]
            : data;

        if (
          (target.provider === "api-football" &&
            !matchData?.fixture?.id) ||
          (target.provider !== "api-football" &&
            !matchData?.id)
        ) {
          throw new Error(
            `Match API introuvable ${target.apiMatchId}`
          );
        }

        apiResponses.set(
          getApiResponseKey(
            target.provider,
            target.apiMatchId
          ),
          matchData
        );
      } catch (err) {
        console.error(
          `Erreur match API ${target.apiMatchId}`,
          err
        );
      }
    }

    for (const match of matchesWithProvider) {
      try {
        const provider = getMatchProvider(match);
        const data = apiResponses.get(
          getApiResponseKey(provider, match.api_match_id)
        );

        if (!data) {
          continue;
        }

        const status =
          provider === "api-football"
            ? getApiFootballStatus(
                data.fixture?.status?.short
              )
            : getFootballDataStatus(data.status);

        const scoreUpdate =
          provider === "api-football"
            ? await enrichApiFootballScoreUpdate(
                String(match.api_match_id),
                data,
                status
              )
            : getMatchScoreUpdate(data.score);

        const updateData = {
          ...scoreUpdate,
          status,
          live_status:
            provider === "api-football"
              ? data.fixture?.status?.short ?? null
              : data.status ?? null,
          live_minute:
            provider === "api-football"
              ? data.fixture?.status?.elapsed ?? null
              : data.minute ?? null,
        };

        const scoreChanged =
          match.home_score !== updateData.home_score ||
          match.away_score !== updateData.away_score;

        const { error: updateError } =
          await supabase
            .from("matches")
            .update(updateData)
            .eq("id", match.id);

        if (updateError) {
          console.error(
            `Erreur update match ${match.id}`,
            updateError
          );
          continue;
        }

        updated++;

        if (
          status === "finished" &&
          (match.status !== "finished" ||
            scoreChanged)
        ) {
          const recalculated =
            await calculatePoints(match.id);

          processed += recalculated;

          console.log(
            `Match ${match.id} termine - ${recalculated} pronostics recalcules`
          );
        }
      } catch (err) {
        console.error(
          `Erreur match ${match.api_match_id}`,
          err
        );
      }
    }

    console.log(
      `${updated} matchs synchronises`
    );

    return NextResponse.json({
      success: true,
      updated,
      processed,
      checked: apiResponses.size,
      candidates: matches.length,
      mode: fullSync ? "full" : "live-window",
      autoImport,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
