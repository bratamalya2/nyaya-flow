import { NextResponse } from "next/server";
import { publicRoute, readJson } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { createPlatformSession, platformConfig, recordPlatformAudit, verifyPlatformCredentials } from "@/lib/platform";
import { clearFailures, lockedUntil, platformRules, recordFailure } from "@/lib/throttle";
import { platformSignInInput } from "@/lib/validation";

// Lives under /api/v1/auth/ so the Nginx auth rate limit applies as well.
export const POST = publicRoute(async (request) => {
  const config = platformConfig();
  if (!config) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const input = await readJson(request, platformSignInInput);
  const rules = platformRules(await clientIp());
  if (await lockedUntil(rules)) return NextResponse.json({ error: "Too many attempts. Try again in 30 minutes." }, { status: 429 });
  if (!(await verifyPlatformCredentials(config, input))) {
    await recordFailure(rules);
    await recordPlatformAudit({ action: "platform.sign_in", resourceType: "platform", outcome: "denied" });
    return NextResponse.json({ error: "Invalid sign-in details." }, { status: 401 });
  }
  await clearFailures(rules);
  await createPlatformSession(config);
  await recordPlatformAudit({ action: "platform.sign_in", resourceType: "platform", outcome: "success", actorEmail: config.email });
  return NextResponse.json({ authenticated: true });
});
