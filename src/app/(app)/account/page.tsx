import { ShieldCheck } from "lucide-react";
import { SessionsPanel } from "@/components/sessions-panel";
import { listSessions } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Security" };

export default async function AccountPage() {
  const workspace = await requireWorkspace();
  const sessions = await listSessions(workspace.session);
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><ShieldCheck size={13} /> Your account</p><h1>Security & sessions</h1><p className="lede">{workspace.session.displayName} · {workspace.session.email}</p></div></header>
    <div className="stack">
      <section className="card card-pad">
        <div className="section-heading"><div><p className="eyebrow">Memberships</p><h2>Organizations</h2></div></div>
        {workspace.memberships.map((membership) => <div className="policy-row" key={membership.organizationId}><div><strong>{membership.organizationName}</strong><p>{roleLabel(membership.role)}</p></div>{membership.organizationId === workspace.organizationId ? <span className="status-badge verified">Active</span> : null}</div>)}
        <p className="form-help">Authenticator (TOTP) sign-in is required for every staff account. Ask an owner or admin to reset it if you lose your device.</p>
      </section>
      <SessionsPanel demoMode={isDemoMode()} sessions={sessions} />
    </div>
  </div>;
}
