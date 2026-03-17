import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight health check for Railway */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
