import OpenAI from "openai";
import { assertOpenAIAllowed, type DataClassification } from "@/lib/openai/policy";

export async function generatePolicyGatedText(input: string, classification: DataClassification) {
  assertOpenAIAllowed(classification);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) throw new Error("OpenAI is enabled but its server configuration is incomplete.");
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({ model, input, store: false });
  return { text: response.output_text, requestId: response._request_id };
}
