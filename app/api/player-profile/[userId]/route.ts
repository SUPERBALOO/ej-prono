import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue";
}

async function getAdminInfo(userId: string) {
  const [
    authUserResult,
    pushResult,
    installResult,
  ] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("enabled", true)
      .limit(1),
    supabase
      .from("app_install_events")
      .select("id")
      .eq("user_id", userId)
      .limit(1),
  ]);

  return {
    email: authUserResult.data.user?.email || null,
    pushEnabled:
      !pushResult.error && Boolean(pushResult.data?.length),
    appInstalled:
      !installResult.error && Boolean(installResult.data?.length),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const concoursId =
      req.nextUrl.searchParams.get("concoursId");
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

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

    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!viewerProfile?.is_admin) {
      const { data: viewerParticipation } =
        await supabase
          .from("participants_concours")
          .select("id")
          .eq("concours_id", concoursId)
          .eq("joueur_id", user.id)
          .maybeSingle();

      if (!viewerParticipation) {
        return NextResponse.json(
          { error: "Action interdite" },
          { status: 403 }
        );
      }
    }

    const { data: targetParticipation } =
      await supabase
        .from("participants_concours")
        .select("id")
        .eq("concours_id", concoursId)
        .eq("joueur_id", userId)
        .maybeSingle();

    if (!targetParticipation) {
      return NextResponse.json(
        { error: "Joueur introuvable dans ce concours" },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (profileError) {
      throw profileError;
    }

    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("concours_id", concoursId);

    if (matchesError) {
      throw matchesError;
    }

    const now = Date.now();
    const visibleMatches = (matches || []).filter(
      (match: any) =>
        match.status === "finished" ||
        new Date(match.match_date).getTime() <= now
    );

    const matchIds = visibleMatches.map(
      (match: any) => match.id
    );

    let recentPredictions: any[] = [];

    if (matchIds.length) {
      const { data: predictions, error } =
        await supabase
          .from("predictions")
          .select("*")
          .eq("user_id", userId)
          .in("match_id", matchIds);

      if (error) {
        throw error;
      }

      const { data: pointsRows, error: pointsError } =
        await supabase
          .from("points")
          .select("match_id,points,exact_score")
          .eq("user_id", userId)
          .in("match_id", matchIds);

      if (pointsError) {
        throw pointsError;
      }

      const matchesById = new Map(
        visibleMatches.map((match: any) => [
          match.id,
          match,
        ])
      );

      const pointsByMatchId = new Map(
        (pointsRows || []).map((row: any) => [
          row.match_id,
          row,
        ])
      );

      recentPredictions = (predictions || [])
        .map((prediction: any) => {
          const match = matchesById.get(
            prediction.match_id
          );
          const points = pointsByMatchId.get(
            prediction.match_id
          );

          return {
            id: prediction.id,
            match_id: prediction.match_id,
            pred_home: prediction.pred_home,
            pred_away: prediction.pred_away,
            locked_odds:
              prediction.locked_odds ??
              prediction.prediction_odds ??
              null,
            match_date: match?.match_date,
            home_team: match?.home_team,
            away_team: match?.away_team,
            home_score: match?.home_score,
            away_score: match?.away_score,
            status: match?.status,
            points: points?.points ?? null,
            exact_score: points?.exact_score ?? false,
          };
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.match_date || 0).getTime() -
            new Date(a.match_date || 0).getTime()
        )
        .slice(0, 5);
    }

    const adminInfo = viewerProfile?.is_admin
      ? await getAdminInfo(userId)
      : null;

    return NextResponse.json({
      profile: {
        id: profile.id,
        pseudo: profile.pseudo || "Joueur",
        avatar_url: profile.avatar_url || null,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        company: profile.company || null,
      },
      recentPredictions,
      adminInfo,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error(error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
