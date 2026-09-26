import { ArrowLeft, CalendarDays, FileText, History, LockKeyhole, Scale, ShieldCheck, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { GrantsPanel, LegalHoldPanel } from "@/components/matter/access-panels";
import { EditMatterButton, HearingDialogButton, TaskDialogButton } from "@/components/matter/matter-dialogs";
import { StatusBadge } from "@/components/status-badge";
import { TaskToggle } from "@/components/task-toggle";
import { recordAudit } from "@/lib/audit";
import { withActor } from "@/lib/db";
import { formatDate, formatDateTime, formatTime, isPast } from "@/lib/format";
import { canViewAudit } from "@/lib/permissions";
import { getMatterDetail, listAuditEvents, listMembers } from "@/lib/repositories/workspace";
import { isDemoMode } from "@/lib/runtime";
import type { Hearing, Person, Revision } from "@/lib/types";
import { requireWorkspace } from "@/lib/workspace";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "proceedings", label: "Proceedings history" },
  { key: "documents", label: "Documents" },
  { key: "access", label: "Access & audit" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_LABELS: Record<string, string> = { starts_at: "Start", ends_at: "End", advocate_id: "Advocate", court_room: "Court room", item_number: "Item", status: "Status", notes: "Notes", title: "Title", stage: "Stage", restricted: "Restricted", lead_id: "Lead", due_at: "Due", assignee_id: "Assignee", priority: "Priority", state: "State" };

function display(value: unknown, names: Map<string, string>) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && names.has(value)) return names.get(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}

export async function generateMetadata() {
  return { title: "Matter" };
}

export default async function MatterDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const tab: TabKey = TABS.some((item) => item.key === requestedTab) ? (requestedTab as TabKey) : "overview";
  if (!UUID.test(id)) notFound();

  const [detail, members] = await Promise.all([getMatterDetail(workspace, id), listMembers(workspace)]);
  if (!detail) notFound();
  const { matter, permissions } = detail;
  const activeMembers = members.filter((member) => member.active);
  const demoMode = isDemoMode();
  const auditEvents = tab === "access" && canViewAudit(workspace.role) ? await listAuditEvents(workspace, { resourceId: id, limit: 50 }) : [];

  if (!demoMode) {
    after(() => withActor(workspace.userId, (client) => recordAudit(client, { organizationId: workspace.organizationId, actorId: workspace.userId, action: "matter.view", resourceType: "matter", resourceId: id, outcome: "success", metadata: { tab } })).catch(() => undefined));
  }

  const upcoming = detail.hearings.filter((hearing) => !isPast(hearing.endsAt)).reverse();
  const past = detail.hearings.filter((hearing) => isPast(hearing.endsAt));
  const hearingById = new Map(detail.hearings.map((hearing) => [hearing.id, hearing]));
  const memberNames = new Map(members.map((member) => [member.id, member.name]));

  return <div className="page">
    <Link href="/matters" className="eyebrow"><ArrowLeft size={13} /> Back to matters</Link>
    <section className="card matter-hero">
      <div className="matter-chips">
        <span className="status-badge">{matter.forum}</span>
        <span className="status-badge">{matter.reference}</span>
        <StatusBadge value={matter.status} />
        <StatusBadge value={matter.sourceState} />
        {matter.restricted ? <span className="status-badge"><LockKeyhole size={11} /> Restricted</span> : null}
        {detail.legalHolds.some((hold) => hold.active) ? <StatusBadge value="hold" /> : null}
      </div>
      <h1>{matter.title}</h1>
      <p className="lede">{matter.client} · {matter.stage}</p>
      <div className="matter-facts">
        <span><UserRound size={13} style={{ verticalAlign: "-2px" }} /> Lead: <strong>{matter.lead.name}</strong></span>
        {matter.cnr ? <span>CNR: <strong className="tabular">{matter.cnr}</strong></span> : <span className="muted">No CNR recorded</span>}
        {matter.courtRoom ? <span>Court room: <strong>{matter.courtRoom}</strong></span> : null}
        {matter.nextListingAt ? <span><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> Next: <strong>{formatDate(matter.nextListingAt)} · {formatTime(matter.nextListingAt)}</strong></span> : null}
        <span className="muted">Updated {formatDateTime(matter.updatedAt)}</span>
      </div>
      {detail.parties.length ? <div className="matter-facts"><span><Users size={13} style={{ verticalAlign: "-2px" }} /> {detail.parties.map((party) => `${party.name} (${party.partyType})`).join(" · ")}</span></div> : null}
      {permissions.edit ? <div className="actions" style={{ marginTop: 14 }}><EditMatterButton canManage={permissions.manage} demoMode={demoMode} matter={matter} members={activeMembers} /></div> : null}
    </section>

    <nav className="tabs" aria-label="Matter sections">
      {TABS.map((item) => (
        <Link aria-current={tab === item.key ? "page" : undefined} className={`tab ${tab === item.key ? "active" : ""}`} href={item.key === "overview" ? `/matters/${id}` : `/matters/${id}?tab=${item.key}`} key={item.key}>
          {item.label}{item.key === "documents" ? ` (${detail.documents.length})` : item.key === "proceedings" ? ` (${detail.revisions.length})` : ""}
        </Link>
      ))}
    </nav>

    {tab === "overview" ? (
      <div className="content-grid">
        <section className="card card-pad">
          <div className="section-heading"><div><p className="eyebrow"><Scale size={13} /> Hearings</p><h2>Listings and milestones</h2></div>{permissions.edit ? <HearingDialogButton defaultAdvocateId={matter.lead.id || workspace.userId} demoMode={demoMode} matterId={id} members={activeMembers} /> : null}</div>
          <HearingList canEdit={permissions.edit} demoMode={demoMode} hearings={upcoming} matterId={id} members={activeMembers} title="Upcoming" empty="No upcoming hearings. Add the next listing manually." />
          <HearingList canEdit={permissions.edit} demoMode={demoMode} hearings={past} matterId={id} members={activeMembers} title="Past" empty="No past hearings recorded." />
        </section>
        <aside className="card card-pad">
          <div className="section-heading"><div><p className="eyebrow">Action list</p><h2>Matter tasks</h2></div></div>
          {detail.tasks.length ? detail.tasks.map((task) => (
            <label className="task-row" key={task.id}>
              <TaskToggle id={task.id} initialDone={task.state === "done"} label={task.title} />
              <span><strong className={task.state === "done" ? "muted" : ""}>{task.title}</strong><p>{task.assignee?.name ?? "Unassigned"}</p></span>
              <span className={task.priority === "urgent" && task.state !== "done" ? "task-time danger" : "task-time"}>{formatDate(task.dueAt)} · {formatTime(task.dueAt)}</span>
            </label>
          )) : <p className="secondary">No tasks yet.</p>}
          {permissions.edit ? <TaskDialogButton defaultAssigneeId={workspace.userId} demoMode={demoMode} matterId={id} members={activeMembers} /> : null}
        </aside>
      </div>
    ) : null}

    {tab === "proceedings" ? (
      <section className="card card-pad">
        <div className="section-heading"><div><p className="eyebrow"><History size={13} /> Edit history</p><h2>Changes to hearings, deadlines, and this matter</h2></div></div>
        {detail.revisions.length ? (
          <ol className="timeline">
            {detail.revisions.map((revision) => <RevisionItem hearing={hearingById.get(revision.resourceId)} key={revision.id} names={memberNames} revision={revision} />)}
          </ol>
        ) : <p className="secondary">No edits yet. Every change to a hearing, deadline, or matter field is kept here with its author and reason.</p>}
      </section>
    ) : null}

    {tab === "documents" ? (
      <section className="card table-card">
        <div className="card-pad section-heading"><div><p className="eyebrow"><FileText size={13} /> Smart Vault</p><h2>Matter documents</h2></div><Link className="button primary" href={`/vault?matter=${id}`}>Upload or search in vault</Link></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Document</th><th>Version</th><th>Pages</th><th>OCR</th><th>Status</th></tr></thead>
            <tbody>{detail.documents.map((document) => (
              <tr key={document.id}><td className="primary-cell"><strong>{document.title}</strong><span>{document.classification} · uploaded {formatDate(document.uploadedAt)} by {document.uploadedBy}</span></td><td>{document.version}</td><td className="tabular">{document.pages || "—"}</td><td>{document.ocrConfidence ? `${document.ocrConfidence}% · ${document.language}` : <span className="muted">Pending</span>}</td><td><StatusBadge value={document.status} /></td></tr>
            ))}</tbody>
          </table>
        </div>
        {!detail.documents.length ? <div className="empty-state"><strong>No documents uploaded.</strong>Upload from the Smart Vault.</div> : null}
      </section>
    ) : null}

    {tab === "access" ? (
      <div className="stack">
        <GrantsPanel canManage={permissions.manage} demoMode={demoMode} grants={detail.grants} matterId={id} members={activeMembers} restricted={Boolean(matter.restricted)} />
        <LegalHoldPanel canManage={permissions.manage} demoMode={demoMode} holds={detail.legalHolds} matterId={id} />
        <section className="card table-card">
          <div className="card-pad section-heading"><div><p className="eyebrow"><ShieldCheck size={13} /> Audit trail</p><h2>Activity on this matter</h2></div></div>
          {canViewAudit(workspace.role) ? (
            <div className="table-scroll">
              <table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Outcome</th></tr></thead>
                <tbody>{auditEvents.map((event) => <tr key={event.id}><td className="tabular">{formatDateTime(event.createdAt)}</td><td>{event.actor}</td><td className="tabular">{event.action}</td><td><StatusBadge value={event.outcome} /></td></tr>)}</tbody>
              </table>
              {!auditEvents.length ? <div className="empty-state">No matter-level events recorded yet.</div> : null}
            </div>
          ) : <p className="card-pad secondary" style={{ paddingTop: 0 }}>Owners, managing partners, and admins can review the audit trail.</p>}
        </section>
      </div>
    ) : null}
  </div>;
}

function HearingList({ title, hearings, empty, canEdit, matterId, members, demoMode }: { title: string; hearings: Hearing[]; empty: string; canEdit: boolean; matterId: string; members: Person[]; demoMode: boolean }) {
  return (
    <div className="section-block">
      <p className="nav-label" style={{ paddingLeft: 0 }}>{title}</p>
      {hearings.length ? hearings.map((hearing) => (
        <div className="policy-row" key={hearing.id}>
          <div>
            <strong className="tabular">{formatDate(hearing.startsAt)} · {formatTime(hearing.startsAt)}–{formatTime(hearing.endsAt)}</strong>
            <p>{hearing.forum}, {hearing.courtRoom}{hearing.itemNumber ? ` · Item ${hearing.itemNumber}` : ""} · {hearing.advocate.name}</p>
            {hearing.note ? <p>{hearing.note}</p> : null}
          </div>
          <div className="row-actions" style={{ alignItems: "center" }}>
            <StatusBadge value={hearing.status} /><StatusBadge value={hearing.sourceState} />
            {canEdit ? <HearingDialogButton defaultAdvocateId={hearing.advocate.id} demoMode={demoMode} hearing={hearing} matterId={matterId} members={members} /> : null}
          </div>
        </div>
      )) : <p className="secondary" style={{ fontSize: 11 }}>{empty}</p>}
    </div>
  );
}

function RevisionItem({ revision, hearing, names }: { revision: Revision; hearing?: Hearing; names: Map<string, string> }) {
  const subject = revision.resourceType === "hearing" ? `Hearing${hearing ? ` on ${formatDate(hearing.startsAt)}` : ""}` : revision.resourceType === "task" ? "Task" : "Matter";
  return (
    <li>
      <strong>{subject} updated by {revision.changedBy}</strong>
      <p>{formatDateTime(revision.changedAt)} — “{revision.reason}”</p>
      <div className="diff">
        {Object.keys(revision.changes).map((key) => (
          <span key={key}>{FIELD_LABELS[key] ?? key}: <del>{display(revision.previous[key], names)}</del> → <ins>{display(revision.changes[key], names)}</ins></span>
        ))}
      </div>
    </li>
  );
}
