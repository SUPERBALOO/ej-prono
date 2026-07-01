import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        .select("id")
        .eq("concours_id", concoursId);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds =
      matches?.map((match) => match.id) || [];

    if (!matchIds.length) {
      return NextResponse.json({
        points: [],
      });
    }

    const { data: points, error: pointsError } =
      await supabase
        .from("points")
        .select("match_id,points,exact_score")
        .eq("user_id", user.id)
        .in("match_id", matchIds);

    if (pointsError) {
      throw pointsError;
    }

    return NextResponse.json({
      points: points || [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
