import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { InviteAccept } from "@/components/invite-accept";
import { getSession, hashToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { roleLabel } from "@/lib/permissions";
import { isDemoMode } from "@/lib/runtime";
import type { AppRole } from "@/lib/types";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let body: React.ReactNode;
  if (isDemoMode()) {
    body = <p className="lede">Invitations are disabled in demo mode.</p>;
  } else {
    const invitation = token.length >= 20 && token.length <= 100
      ? (await query<{ organization_name: string; email: string; role: AppRole; expires_at: Date }>("select organization_name, email, role, expires_at from invitation_lookup($1)", [hashToken(token)])).rows[0]
      : undefined;
    if (!invitation) {
      body = <p className="lede">This invitation link is invalid, has expired, or was already used. Ask the person who invited you for a new link.</p>;
    } else {
      const existing = (await query("select 1 from app_users where email = $1", [invitation.email])).rowCount;
      const session = await getSession();
      const intro = <p className="lede">Join <strong>{invitation.organization_name}</strong> as {roleLabel(invitation.role).toLowerCase()}.</p>;
      if (!existing) body = <>{intro}<InviteAccept email={invitation.email} mode="new-account" token={token} /></>;
      else if (session?.email.toLowerCase() === invitation.email.toLowerCase()) body = <>{intro}<InviteAccept email={invitation.email} mode="accept-signed-in" token={token} /></>;
      else body = <>{intro}<p className="lede">An account for {invitation.email} already exists. <Link className="teal" href="/sign-in">Sign in</Link> with it, then open this invitation link again.</p></>;
    }
  }
  return <main className="auth-page" id="main">
    <section className="auth-brand"><Image src="/logo.png" alt="NyayaFlow" width={220} height={73} priority /><div><p className="eyebrow" style={{ color: "#84d2e2" }}>Operator-controlled access</p><h1>You have been invited to a firm workspace.</h1><p>Access is limited to the matters your role and grants allow.</p></div></section>
    <section className="auth-panel"><div className="card auth-card"><p className="eyebrow">Invitation</p><h2>Join NyayaFlow</h2>{body}</div></section>
  </main>;
}
