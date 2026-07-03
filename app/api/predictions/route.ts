import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculatePoints } from "@/lib/calculatePoints";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getPredictionOdds(match: any, predHome: number, predAway: number) {
  if (predHome > predAway) {
    return match.cote_home;
  }

  if (predHome < predAway) {
    return match.cote_away;
  }

  return match.cote_draw;
}

async function getUserConcoursIds(userId: string) {
  const { data, error } = await supabase
    .from("participants_concours")
    .select("concours_id")
    .eq("joueur_id", userId);

  if (error) {
    throw error;
  }

  return (data || []).map(
    (item: any) => item.concours_id
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    const concoursId =
      req.nextUrl.searchParams.get("concoursId");

    if (!concoursId) {
      return NextResponse.json(
        { error: "concoursId manquant" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Session invalide" },
        { status: 401 }
      );
    }

    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("concours_id", concoursId);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds =
      matches?.map((match: any) => match.id) || [];

    if (!matchIds.length) {
      return NextResponse.json({
        predictions: [],
        synced: 0,
      });
    }

    const { data: directPredictions, error: directError } =
      await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .in("match_id", matchIds);

    if (directError) {
      throw directError;
    }

    const predictionsByMatch = new Map(
      (directPredictions || []).map((prediction: any) => [
        prediction.match_id,
        prediction,
      ])
    );

    const missingMatches = (matches || []).filter(
      (match: any) =>
        match.api_match_id &&
        !predictionsByMatch.has(match.id)
    );

    let synced = 0;

    if (missingMatches.length) {
      const userConcoursIds =
        await getUserConcoursIds(user.id);

      if (!userConcoursIds.includes(concoursId)) {
        userConcoursIds.push(concoursId);
      }

      const apiMatchIds = Array.from(
        new Set(
          missingMatches.map(
            (match: any) => match.api_match_id
          )
        )
      );

      const { data: linkedMatches, error: linkedError } =
        await supabase
          .from("matches")
          .select("id,api_match_id,concours_id")
          .in("concours_id", userConcoursIds)
          .in("api_match_id", apiMatchIds);

      if (linkedError) {
        throw linkedError;
      }

      const linkedMatchIds =
        linkedMatches?.map((match: any) => match.id) || [];

      if (linkedMatchIds.length) {
        const { data: linkedPredictions, error: linkedPredictionsError } =
          await supabase
            .from("predictions")
            .select("*")
            .eq("user_id", user.id)
            .in("match_id", linkedMatchIds);

        if (linkedPredictionsError) {
          throw linkedPredictionsError;
        }

        const apiByLinkedMatch = new Map(
          (linkedMatches || []).map((match: any) => [
            match.id,
            match.api_match_id,
          ])
        );

        const predictionByApi = new Map();

        (linkedPredictions || []).forEach((prediction: any) => {
          const apiMatchId = apiByLinkedMatch.get(
            prediction.match_id
          );

          if (
            apiMatchId &&
            !predictionByApi.has(apiMatchId)
          ) {
            predictionByApi.set(apiMatchId, prediction);
          }
        });

        for (const match of missingMatches) {
          const sourcePrediction = predictionByApi.get(
            match.api_match_id
          );

          if (!sourcePrediction) {
            continue;
          }

          const predictionOdds =
            sourcePrediction.locked_odds ??
            sourcePrediction.prediction_odds ??
            getPredictionOdds(
              match,
              sourcePrediction.pred_home,
              sourcePrediction.pred_away
            );

          const predictionToInsert = {
            user_id: user.id,
            match_id: match.id,
            pred_home: sourcePrediction.pred_home,
            pred_away: sourcePrediction.pred_away,
            prediction_odds: predictionOdds,
            locked_odds: predictionOdds,
          };

          const { data: syncedPrediction, error: syncError } =
            await supabase
              .from("predictions")
              .upsert(predictionToInsert, {
                onConflict: "user_id,match_id",
              })
              .select("*")
              .single();

          if (syncError) {
            throw syncError;
          }

          predictionsByMatch.set(
            match.id,
            syncedPrediction || predictionToInsert
          );
          synced++;

          if (match.status === "finished") {
            await calculatePoints(match.id);
          }
        }
      }
    }

    return NextResponse.json({
      predictions: Array.from(
        predictionsByMatch.values()
      ),
      synced,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      user_id,
      match_id,
      pred_home,
      pred_away,
    } = await req.json();

    const { data: match, error: matchError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("id", match_id)
        .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: "Match introuvable" },
        { status: 404 }
      );
    }

    const userConcoursIds =
      await getUserConcoursIds(user_id);

    if (!userConcoursIds.includes(match.concours_id)) {
      userConcoursIds.push(match.concours_id);
    }

    let matchesToSave = [match];

    if (match.api_match_id) {
      const { data: linkedMatches, error: linkedMatchesError } =
        await supabase
          .from("matches")
          .select("*")
          .eq("api_match_id", match.api_match_id)
          .in("concours_id", userConcoursIds);

      if (linkedMatchesError) {
        throw linkedMatchesError;
      }

      matchesToSave = linkedMatches?.length
        ? linkedMatches
        : [match];
    }

    const origin = req.nextUrl.origin;

    await fetch(
      `${origin}/api/recalculate-odds`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: match.id,
        }),
      }
    );

    const { data: refreshedMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match.id)
      .single();

    const commonPredictionOdds = getPredictionOdds(
      refreshedMatch || match,
      pred_home,
      pred_away
    );

    const predictionsToSave = matchesToSave.map(
      (matchToSave: any) => {
        return {
          user_id,
          match_id: matchToSave.id,
          pred_home,
          pred_away,
          prediction_odds: commonPredictionOdds,
          locked_odds: commonPredictionOdds,
        };
      }
    );

    const { error } = await supabase
      .from("predictions")
      .upsert(
        predictionsToSave,
        {
          onConflict: "user_id,match_id",
        }
      );
    if (error) {
      throw error;
    }

    await fetch(
      `${origin}/api/recalculate-odds`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: match.id,
        }),
      }
    );

    const updatedMatchIds = matchesToSave.map(
      (matchToSave: any) => matchToSave.id
    );

    const { data: updatedMatches } = await supabase
      .from("matches")
      .select("*")
      .in("id", updatedMatchIds);

    return NextResponse.json({
      success: true,
      saved: predictionsToSave.length,
      savedPredictions: predictionsToSave,
      updatedMatches: updatedMatches || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
