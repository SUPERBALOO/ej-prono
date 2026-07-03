import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculatePoints } from "@/lib/calculatePoints";
import { getMatchScoreUpdate } from "@/lib/matchScores";
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

export async function GET(req: NextRequest) {
  try {
    const apiMatchId =
      req.nextUrl.searchParams.get("apiMatchId");

    const matchId =
      req.nextUrl.searchParams.get("matchId");

    const fullSync =
      req.nextUrl.searchParams.get("full") === "1";

    const importMissing =
      req.nextUrl.searchParams.get("importMissing") ===
      "1";

    const forceImport =
      req.nextUrl.searchParams.get("forceImport") ===
      "1";

    let autoImport = {
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

    const apiIds = Array.from(
      new Set(
        matches.map((match: any) =>
          String(match.api_match_id)
        )
      )
    );

    const apiResponses = new Map<string, any>();

    for (const id of apiIds) {
      try {
        const response = await fetch(
          `https://api.football-data.org/v4/matches/${id}`,
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
              `Erreur Football-Data ${response.status}`
          );
        }

        if (!data?.id) {
          throw new Error(
            `Match API introuvable ${id}`
          );
        }

        apiResponses.set(id, data);
      } catch (err) {
        console.error(
          `Erreur match API ${id}`,
          err
        );
      }
    }

    for (const match of matches) {
      try {
        const data = apiResponses.get(
          String(match.api_match_id)
        );

        if (!data) {
          continue;
        }

        const status = getFootballDataStatus(
          data.status
        );

        const scoreUpdate =
          getMatchScoreUpdate(data.score);

        const updateData = {
          ...scoreUpdate,
          status,
          live_status: data.status ?? null,
          live_minute: data.minute ?? null,
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
