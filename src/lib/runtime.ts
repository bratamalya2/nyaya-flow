// DEMO_MODE is a server-only runtime flag. It must never be a NEXT_PUBLIC_ variable: those are
// inlined at build time into server code too, which would freeze an authentication bypass into
// a production build. Server components that branch on it must be request-time rendered.
export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

export function assertSafeRuntime() {
  if (process.env.NODE_ENV === "production" && isDemoMode()) {
    throw new Error("DEMO_MODE=true is not permitted when NODE_ENV=production. Demo mode bypasses authentication.");
  }
}

export const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000101";
