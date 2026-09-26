import { seeOther } from "@/lib/http";
import { getPlatformSession, recordPlatformAudit, revokePlatformSession } from "@/lib/platform";

export async function POST() {
  const session = await getPlatformSession();
  await revokePlatformSession();
  if (session) await recordPlatformAudit({ action: "platform.sign_out", resourceType: "platform", outcome: "success", actorEmail: session.email }).catch(() => undefined);
  return seeOther("/platform/sign-in");
}
