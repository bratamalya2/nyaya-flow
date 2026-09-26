import { Download, KeyRound, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatTime } from "@/lib/conflicts";
import { listAuditEvents, listMembers } from "@/lib/repositories/workspace";

export const metadata = { title: "Firm Admin" };

export default async function AdminPage() {
  const [people, auditEvents] = await Promise.all([listMembers(), listAuditEvents()]);
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><ShieldCheck size={13} /> Access, privacy & evidence</p><h1>Firm Admin & Privacy</h1><p className="lede">Membership, matter permissions, processing controls, legal holds, and tamper-evident activity records.</p></div><div className="actions"><button className="button" type="button"><Download size={14} />Audit export</button><button className="button primary" type="button"><UserPlus size={14} />Invite member</button></div></header>
    <div className="admin-grid" style={{ marginBottom: 14 }}>
      <section className="card card-pad"><div className="section-heading"><div><p className="eyebrow">Workspace members</p><h2>People & roles</h2></div><StatusBadge value="verified" /></div>{people.map((person) => <div className="member-row" key={person.id}><div className="avatar">{person.initials}</div><div className="member-copy"><strong>{person.name}</strong><span>{person.role.replaceAll("_", " ")} · MFA required</span></div><button className="button" type="button">Manage</button></div>)}</section>
      <section className="card card-pad"><div className="section-heading"><div><p className="eyebrow">Processing policy</p><h2>Privacy controls</h2></div><LockKeyhole size={20} className="teal" /></div>
        <div className="policy-row"><div><strong>Automatic deletion</strong><p>Off until a reviewed retention class is assigned.</p></div><StatusBadge value="manual" /></div>
        <div className="policy-row"><div><strong>External AI processing</strong><p>Privileged and private matter data is blocked.</p></div><StatusBadge value="blocked" /></div>
        <div className="policy-row"><div><strong>English/Hindi OCR</strong><p>Runs on the India-hosted worker.</p></div><StatusBadge value="verified" /></div>
        <div className="policy-row"><div><strong>Live court connectors</strong><p>No approved connector is enabled.</p></div><StatusBadge value="unverified" /></div>
        <button className="button" style={{ marginTop: 12 }} type="button"><KeyRound size={14} />Review access policy</button>
      </section>
    </div>
    <section className="card table-card"><div className="card-pad section-heading"><div><p className="eyebrow">Tamper-evident chain</p><h2>Recent audit events</h2></div><span className="secondary" style={{ fontSize: 10 }}>Contents minimized · hashes verified nightly</span></div><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Outcome</th><th>Correlation ID</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><td>{formatTime(event.createdAt)}</td><td>{event.actor}</td><td className="tabular">{event.action}</td><td>{event.resource}</td><td><StatusBadge value={event.outcome === "success" ? "verified" : "unverified"} /></td><td className="tabular muted">{event.correlationId}</td></tr>)}</tbody></table></section>
  </div>;
}
