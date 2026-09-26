import { afterEach, describe, expect, it } from "vitest";
import { assertOpenAIAllowed, ExternalAIBlockedError } from "@/lib/openai/policy";

const previousEnabled = process.env.OPENAI_ENABLED;
const previousAllowed = process.env.OPENAI_ALLOWED_CLASSIFICATIONS;
afterEach(() => {
  process.env.OPENAI_ENABLED = previousEnabled;
  process.env.OPENAI_ALLOWED_CLASSIFICATIONS = previousAllowed;
});

describe("OpenAI policy boundary", () => {
  it("blocks all classifications when the integration is disabled", () => {
    process.env.OPENAI_ENABLED = "false";
    expect(() => assertOpenAIAllowed("public")).toThrow(ExternalAIBlockedError);
  });

  it("always blocks privileged and internal matter content", () => {
    process.env.OPENAI_ENABLED = "true";
    process.env.OPENAI_ALLOWED_CLASSIFICATIONS = "public,synthetic,redacted,internal,privileged";
    expect(() => assertOpenAIAllowed("privileged")).toThrow(ExternalAIBlockedError);
    expect(() => assertOpenAIAllowed("internal")).toThrow(ExternalAIBlockedError);
    expect(() => assertOpenAIAllowed("synthetic")).not.toThrow();
  });
});
