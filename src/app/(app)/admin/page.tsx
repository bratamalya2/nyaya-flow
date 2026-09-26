import { Download, ShieldCheck } from "lucide-react";
import { MembersPanel } from "@/components/admin/members-panel";
import { PrivacyPanel } from "@/components/admin/privacy-panel";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { assignableRoles, canAdminister, canViewAudit, roleLabel } from "@/lib/permissions";
import {
  getOrganizationPolicies, latestAuditVerification, listAuditEvents, listConsents, listDataRequests, listInvitations, listLegalHolds,
  listMatters, listMembers, listRetentionClasses,
} from "@/lib/repositories/workspace";
import { isDemoMode } from "@/lib/runtime";
import type { AppRole } from "@/lib/types";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Firm Admin" };

const MATRIX: { role: AppRole; view: boolean; edit: boolean; manage: boolean; restricted: boolean; admin: boolean; audit: boolean }[] = [
  { role: "owner", view: true, edit: true, manage: true, restricted: true, admin: true, audit: true },
  { role: "managing_partner", view: true, edit: true, manage: true, restricted: true, admin: false, audit: true },
  { role: "admin", view: true, edit: true, manage: true, restricted: true, admin: true, audit: true },
  { role: "advocate", view: true, edit: true, manage: false, restricted: false, admin: false, audit: false },
  { role: "associate", view: true, edit: true, manage: false, restricted: false, admin: false, audit: false },
  { role: "paralegal", view: true, edit: true, manage: false, restricted: false, admin: false, audit: false },
  { role: "finance", view: true, edit: false, manage: false, restricted: false, admin: false, audit: false },
];
const mark = (value: boolean) => value ? <span className="dot-yes" aria-label="Yes">●</span> : <span className="dot-no" aria-label="No">—</span>;

export default async function AdminPage() {
  const workspace = await requireWorkspace();
  const admin = canAdminister(workspace.role);
  const auditor = canViewAudit(workspace.role);
  const demoMode = isDemoMode();
  const [members, invitations, policies, consents, requests, holds, retention, matters, auditEvents, verification] = await Promise.all([
    listMembers(workspace),
    admin ? listInvitations(workspace) : [],
    getOrganizationPolicies(workspace),
    admin ? listConsents(workspace) : [],
    admin ? listDataRequests(workspace) : [],
    listLegalHolds(workspace),
    admin ? listRetentionClasses(workspace) : [],
    admin ? listMatters(workspace) : [],
    auditor ? listAuditEvents(workspace) : [],
    auditor ? latestAuditVerification(workspace) : null,
  ]);

  return <div className="page">
    <header className="page-heading">
      <div><p className="eyebrow"><ShieldCheck size={13} /> Access, privacy & evidence</p><h1>Firm Admin & Privacy</h1><p className="lede">Membership and roles, matter isolation, DPDP processing records, legal holds, and the tamper-evident audit trail for {workspace.organizationName}.</p></div>
      <div className="actions">{auditor && !demoMode ? <a className="button" href="/api/v1/audit/export"><Download size={14} />Export audit CSV</a> : null}</div>
    </header>

    <div className="admin-grid" style={{ marginBottom: 14 }}>
      <MembersPanel assignableRoles={assignableRoles(workspace.role)} canAdminister={admin} currentUserId={workspace.userId} demoMode={demoMode} invitations={invitations} members={members} />
      {admin ? (
        <PrivacyPanel consents={consents} demoMode={demoMode} holds={holds} matters={matters} policies={policies} requests={requests} retention={retention} />
      ) : (
        <section className="card card-pad"><p className="eyebrow">DPDP center</p><h2>Privacy controls</h2><p className="lede">Owners and admins manage consent records, data requests, retention, and processing policy. Ask them for changes.</p></section>
      )}
    </div>

    <section className="card table-card" style={{ marginBottom: 14 }}>
      <div className="card-pad section-heading"><div><p className="eyebrow">Enforced by PostgreSQL row-level security</p><h2>Role & matter isolation matrix</h2></div><span className="secondary" style={{ fontSize: 10 }}>Explicit matter grants add view, edit, manage, or export on top of a role.</span></div>
      <div className="table-scroll">
        <table className="data-table role-matrix">
          <thead><tr><th>Role</th><th>View firm matters</th><th>Edit firm matters</th><th>Manage & export</th><th>Restricted without grant</th><th>Members & privacy</th><th>Audit trail</th></tr></thead>
          <tbody>{MATRIX.map((row) => <tr key={row.role}><td style={{ textTransform: "capitalize" }}>{roleLabel(row.role)}{row.role === workspace.role ? " (you)" : ""}</td><td>{mark(row.view)}</td><td>{mark(row.edit)}</td><td>{mark(row.manage)}</td><td>{mark(row.restricted)}</td><td>{mark(row.admin)}</td><td>{mark(row.audit)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>

    {auditor ? (
      <section className="card table-card">
        <div className="card-pad section-heading">
          <div><p className="eyebrow">Tamper-evident chain</p><h2>Recent audit events</h2></div>
          {verification ? (
            <span className="row-actions" style={{ alignItems: "center" }}><StatusBadge value={verification.ok ? "verified" : "failed"} /><span className="secondary" style={{ fontSize: 10 }}>Chain {verification.ok ? "verified" : `broken at #${verification.firstBadIndex}`} · {verification.checkedCount} events · {formatDateTime(verification.verifiedAt)}</span></span>
          ) : <span className="secondary" style={{ fontSize: 10 }}>Not yet verified — the worker checks each organization&apos;s chain every 24 hours.</span>}
        </div>
        <div className="table-scroll">
          <table className="data-table"><thead><tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Outcome</th><th>Correlation ID</th></tr></thead>
            <tbody>{auditEvents.map((event) => <tr key={event.id}><td className="tabular muted">{event.chainIndex}</td><td className="tabular">{formatDateTime(event.createdAt)}</td><td>{event.actor}</td><td className="tabular">{event.action}</td><td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{event.resource}</td><td><StatusBadge value={event.outcome} /></td><td className="tabular muted">{event.correlationId.slice(0, 8)}</td></tr>)}</tbody>
          </table>
        </div>
        {!auditEvents.length ? <div className="empty-state">No audit events yet.</div> : null}
      </section>
    ) : (
      <section className="card card-pad"><h2>Audit trail</h2><p className="lede">Owners, managing partners, and admins can review and export the audit trail.</p></section>
    )}
  </div>;
}
