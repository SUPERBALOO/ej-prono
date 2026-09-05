import { NextRequest, NextResponse } from "next/server";
import { sendLeMansNewsNotifications } from "@/lib/sendNewsNotifications";

export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !==
      `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const result = await sendLeMansNewsNotifications(
      new URL(req.url).origin
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue";

    console.error("Controle des actualites impossible", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
