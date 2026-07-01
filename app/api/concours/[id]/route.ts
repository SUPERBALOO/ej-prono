import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteByMatchIds(
  table: string,
  matchIds: string[],
  ignoreMissingTable = false
) {
  if (!matchIds.length) {
    return;
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .in("match_id", matchIds);

  if (
    error &&
    !(ignoreMissingTable && error.code === "42P01")
  ) {
    throw error;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
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

    const { data: concours, error: concoursError } =
      await supabase
        .from("concours")
        .select("id,createur")
        .eq("id", id)
        .single();

    if (concoursError || !concours) {
      return NextResponse.json(
        { error: "Concours introuvable" },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

    if (profileError) {
      throw profileError;
    }

    if (
      !profile?.is_admin &&
      concours.createur !== user.id
    ) {
      return NextResponse.json(
        { error: "Action interdite" },
        { status: 403 }
      );
    }

    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select("id")
        .eq("concours_id", id);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds =
      matches?.map((match: any) => match.id) || [];

    await deleteByMatchIds("points", matchIds);
    await deleteByMatchIds("predictions", matchIds);
    await deleteByMatchIds(
      "push_reminder_logs",
      matchIds,
      true
    );

    const { error: matchesDeleteError } =
      await supabase
        .from("matches")
        .delete()
        .eq("concours_id", id);

    if (matchesDeleteError) {
      throw matchesDeleteError;
    }

    const { error: participantsDeleteError } =
      await supabase
        .from("participants_concours")
        .delete()
        .eq("concours_id", id);

    if (participantsDeleteError) {
      throw participantsDeleteError;
    }

    const { error: concoursDeleteError } =
      await supabase
        .from("concours")
        .delete()
        .eq("id", id);

    if (concoursDeleteError) {
      throw concoursDeleteError;
    }

    return NextResponse.json({
      success: true,
      deletedMatches: matchIds.length,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
