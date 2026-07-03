import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function assertAdmin(req: NextRequest) {
  const token = req.headers
    .get("authorization")
    ?.replace("Bearer ", "");

  if (!token) {
    return { error: "Non autorise", status: 401 };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: "Session invalide", status: 401 };
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

  if (!profile?.is_admin) {
    return {
      error: "Action reservee aux administrateurs",
      status: 403,
    };
  }

  return { user };
}

async function safeCount(
  table: string,
  filter?: (query: any) => any
) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (filter) {
    query = filter(query);
  }

  const { count, error } = await query;

  if (error) {
    return { count: null, error: error.message };
  }

  return { count: count || 0, error: null };
}

async function safeDistinctUserCount(
  table: string,
  filter?: (query: any) => any
) {
  let query = supabase.from(table).select("user_id");

  if (filter) {
    query = filter(query);
  }

  const { data, error } = await query;

  if (error) {
    return { count: null, error: error.message };
  }

  return {
    count: new Set(
      (data || [])
        .map((row) => row.user_id)
        .filter(Boolean)
    ).size,
    error: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await assertAdmin(req);

    if ("error" in admin) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const [users, pushEnabled, installations] =
      await Promise.all([
        safeCount("profiles"),
        safeDistinctUserCount("push_subscriptions", (query) =>
          query.eq("enabled", true)
        ),
        safeDistinctUserCount("app_install_events"),
      ]);

    return NextResponse.json({
      usersCount: users.count,
      pushEnabledCount: pushEnabled.count,
      installationsCount: installations.count,
      warnings: [
        users.error
          ? `profiles: ${users.error}`
          : null,
        pushEnabled.error
          ? `push_subscriptions: ${pushEnabled.error}`
          : null,
        installations.error
          ? `app_install_events: ${installations.error}`
          : null,
      ].filter(Boolean),
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
