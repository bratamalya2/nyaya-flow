import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  let database = demoMode ? "demo" : "unavailable";
  if (!demoMode) {
    try { await query("select 1"); database = "ok"; } catch { database = "unavailable"; }
  }
  return NextResponse.json({ status: database === "unavailable" ? "degraded" : "ok", service: "nyayaflow-web", database, demoMode, timestamp: new Date().toISOString() }, { status: database === "unavailable" ? 503 : 200 });
}
