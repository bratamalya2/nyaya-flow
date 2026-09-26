import { NextResponse } from "next/server";
import { z } from "zod";
import { assertOpenAIAllowed, dataClassifications, ExternalAIBlockedError } from "@/lib/openai/policy";

const schema = z.object({ classification: z.enum(dataClassifications) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid classification." }, { status: 400 });
  try {
    assertOpenAIAllowed(parsed.data.classification);
    return NextResponse.json({ allowed: true, note: "This check sends no user content to OpenAI." });
  } catch (error) {
    if (error instanceof ExternalAIBlockedError) return NextResponse.json({ allowed: false, error: error.message }, { status: 403 });
    throw error;
  }
}
