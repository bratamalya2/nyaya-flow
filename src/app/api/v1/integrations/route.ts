import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { providerStates } from "@/lib/external-providers";
export const GET = apiRoute({}, async () => NextResponse.json({ data: providerStates() }));
