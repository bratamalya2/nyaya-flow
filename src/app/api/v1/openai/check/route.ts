import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { assertOpenAIAllowed, dataClassifications, ExternalAIBlockedError } from "@/lib/openai/policy";

const schema = z.object({ classification: z.enum(dataClassifications) });

export const POST = apiRoute({ demo: async () => NextResponse.json({ allowed: false, error: "External AI is disabled in demo mode." }, { status: 403 }) }, async (request) => {
  const { classification } = await readJson(request, schema);
  try {
    assertOpenAIAllowed(classification);
    return NextResponse.json({ allowed: true, note: "This check sends no user content to OpenAI." });
  } catch (error) {
    if (error instanceof ExternalAIBlockedError) return NextResponse.json({ allowed: false, error: error.message }, { status: 403 });
    throw error;
  }
});
