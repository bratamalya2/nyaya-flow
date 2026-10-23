/** Provider boundaries keep credentials and provider-specific payloads out of domain services. */
export type ProviderState = "ready" | "manual_only" | "not_configured";
export type CourtCaseSnapshot = { cnr: string; forum: string; listings: { startsAt: string; courtRoom?: string; itemNumber?: number }[]; sourceUrl: string; observedAt: string };
export interface CourtSourceAdapter { forum: string; state(): ProviderState; fetchCase(cnr: string): Promise<CourtCaseSnapshot>; }
export interface CorpusAdapter { state(): ProviderState; ingest(): Promise<{ imported: number; skipped: number }>; }
export interface AadhaarEsignAdapter { state(): ProviderState; createRequest(input: { reference: string; callbackUrl: string }): Promise<{ redirectUrl: string; providerReference: string }>; }
export interface StampDutyAdapter { state(): ProviderState; calculate(input: { state: string; instrument: string; considerationPaise?: number }): Promise<{ amountPaise?: number; manualConfirmationRequired: boolean; source: string }>; }

function has(...keys: string[]) { return keys.every((key) => Boolean(process.env[key])); }
export const providerStates = () => ({ razorpay: has("RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RAZORPAY_WEBHOOK_SECRET") ? "ready" : "not_configured", smtp: has("SMTP_HOST","SMTP_FROM") ? "ready" : "not_configured", courtSources: "manual_only" as ProviderState, legalCorpus: "not_configured" as ProviderState, aadhaarEsign: "not_configured" as ProviderState, estamp: "manual_only" as ProviderState });
