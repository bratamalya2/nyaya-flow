import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isDemoMode } from "@/lib/runtime";

export async function GET() {
  let database = isDemoMode() ? "demo" : "unavailable";
  if (!isDemoMode()) {
    try { await query("select 1"); database = "ok"; } catch { database = "unavailable"; }
  }
  const healthy = database !== "unavailable";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", service: "nyayaflow-web", database, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}
