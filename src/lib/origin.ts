const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Cookie-authenticated mutations must come from this application's own pages. Browsers send an
// Origin header on every non-GET fetch and form post, so a missing or foreign Origin is rejected.
export function isSameOriginMutation(method: string, origin: string | null, host: string | null, appBaseUrl?: string) {
  if (SAFE_METHODS.has(method)) return true;
  if (!origin) return false;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  if (host && originUrl.host === host) return true;
  if (!appBaseUrl) return false;
  try {
    return originUrl.origin === new URL(appBaseUrl).origin;
  } catch {
    return false;
  }
}
