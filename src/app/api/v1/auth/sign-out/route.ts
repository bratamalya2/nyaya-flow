import { getSession, revokeCurrentSession } from "@/lib/auth";
import { auditAuthEvent } from "@/lib/auth-events";
import { seeOther } from "@/lib/http";
import { isDemoMode } from "@/lib/runtime";

export async function POST() {
  if (!isDemoMode()) {
    const session = await getSession({ allowUnverified: true });
    if (session?.mfaVerified) await auditAuthEvent(session.userId, "auth.sign_out").catch(() => undefined);
    await revokeCurrentSession();
  }
  return seeOther("/sign-in");
}
