import { NextResponse } from "next/server";
import { calculatePoints } from "@/lib/calculatePoints";

export async function GET() {
  try {

    const processed =
      await calculatePoints();

    return NextResponse.json({
      success: true,
      processed,
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