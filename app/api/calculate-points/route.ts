import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculatePoints } from "@/lib/calculatePoints";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const apiMatchId =
      req.nextUrl.searchParams.get("apiMatchId");

    const matchId =
      req.nextUrl.searchParams.get("matchId");

    let query = supabase
      .from("matches")
      .select("id")
      .eq("status", "finished");

    if (apiMatchId) {
      query = query.eq("api_match_id", apiMatchId);
    } else if (matchId) {
      query = query.eq("id", matchId);
    }

    const { data: matches, error } = await query;

    if (error) {
      throw error;
    }

    let processed = 0;

    for (const match of matches || []) {
      processed += await calculatePoints(match.id);
    }

    return NextResponse.json({
      success: true,
      processed,
      matches: matches?.length || 0,
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
