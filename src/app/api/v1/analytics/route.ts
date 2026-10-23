import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { getAnalyticsDashboard } from "@/lib/finance";

export const GET = apiRoute({}, async (_request, { workspace }) => NextResponse.json({ data: await getAnalyticsDashboard(workspace) }));
