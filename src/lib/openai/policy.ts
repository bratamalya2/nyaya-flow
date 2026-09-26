export const dataClassifications = ["public", "synthetic", "redacted", "internal", "privileged"] as const;
export type DataClassification = (typeof dataClassifications)[number];

export class ExternalAIBlockedError extends Error {
  constructor(classification: DataClassification) {
    super(`External AI processing is blocked for ${classification} data.`);
    this.name = "ExternalAIBlockedError";
  }
}

export function allowedOpenAIClassifications() {
  const configured = process.env.OPENAI_ALLOWED_CLASSIFICATIONS ?? "public,synthetic,redacted";
  return new Set(configured.split(",").map((item) => item.trim()).filter(Boolean));
}

export function assertOpenAIAllowed(classification: DataClassification) {
  if (process.env.OPENAI_ENABLED !== "true" || !allowedOpenAIClassifications().has(classification)) {
    throw new ExternalAIBlockedError(classification);
  }
  if (classification === "internal" || classification === "privileged") {
    throw new ExternalAIBlockedError(classification);
  }
}
