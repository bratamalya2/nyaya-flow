import { AlertTriangle, CalendarClock, CheckSquare, FileText, Gavel } from "lucide-react";
import Link from "next/link";
import { withActor } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Command Centre" };

export default async function CommandCentrePage() {
  const workspace = await requireWorkspace();
  const model = await withActor(workspace.userId, async (client) => {
    const permission = await client.query<{ allowed: boolean }>("select has_app_permission($1,'view_command_centre'::app_permission) allowed", [workspace.organizationId]);
    if (!permission.rows[0]?.allowed) return null;
    const [hearings, deadlines, conflicts, reviews, briefs] = await Promise.all([
      client.query(`select h.id,h.starts_at,m.id as matter_id,m.title,m.restricted from hearings h join matters m on m.id=h.matter_id where h.organization_id=$1 and h.starts_at>=now() order by h.starts_at limit 8`, [workspace.organizationId]),
      client.query(`select d.id,d.title,d.due_on,d.risk_level,d.matter_id,m.title as matter_title,m.restricted from matter_deadlines d join matters m on m.id=d.matter_id where d.organization_id=$1 and d.review_state in ('proposed','in_review') order by d.due_on limit 8`, [workspace.organizationId]),
      client.query(`select id,query_summary,created_at from conflict_checks where organization_id=$1 and status='completed' order by created_at desc limit 5`, [workspace.organizationId]),
      client.query(`select e.id,e.title,e.occurred_on,e.matter_id,m.title as matter_title,m.restricted from chronology_events e join matters m on m.id=e.matter_id where e.organization_id=$1 and e.review_state in ('proposed','in_review') order by e.occurred_on desc limit 8`, [workspace.organizationId]),
      client.query(`select b.id,b.title,h.matter_id,m.title as matter_title,m.restricted from hearing_briefs b join hearings h on h.id=b.hearing_id join matters m on m.id=h.matter_id where b.organization_id=$1 and b.status in ('proposed','in_review') limit 8`, [workspace.organizationId]),
    ]);
    return { hearings: hearings.rows, deadlines: deadlines.rows, conflicts: conflicts.rows, reviews: reviews.rows, briefs: briefs.rows };
  });
  if (!model) return <div className="page"><section className="card empty-state"><AlertTriangle size={24} /><strong>Command Centre access is not enabled for your role.</strong><p>Ask an organization administrator to grant the permission.</p></section></div>;
  return <div className="page"><header className="page-heading"><div><p className="eyebrow"><Gavel size={13} /> RLS-visible operational queue</p><h1>Litigation Command Centre</h1><p className="lede">Upcoming hearings, deadlines, reviews, conflicts, and briefs you are permitted to see. Restricted matter details are never included in this dashboard for unauthorized users.</p></div></header>
    <div className="metrics"><Metric icon={<CalendarClock size={18} />} label="Upcoming hearings" value={model.hearings.length} /><Metric icon={<AlertTriangle size={18} />} label="Deadline reviews" value={model.deadlines.length} /><Metric icon={<CheckSquare size={18} />} label="Chronology reviews" value={model.reviews.length} /><Metric icon={<FileText size={18} />} label="Brief approvals" value={model.briefs.length} /></div>
    <div className="content-grid"><Queue title="Deadlines needing review" rows={model.deadlines.map((row) => ({ title: `${row.title} · due ${String(row.due_on).slice(0,10)}`, href: `/matters/${row.matter_id}/deadlines` }))} empty="No unreviewed deadlines." /><Queue title="Chronology proposals" rows={model.reviews.map((row) => ({ title: `${row.title} · ${String(row.occurred_on).slice(0,10)}`, href: `/matters/${row.matter_id}/chronology` }))} empty="No chronology proposals." /></div>
    <div className="content-grid"><Queue title="Upcoming hearings" rows={model.hearings.map((row) => ({ title: `${row.title} · ${new Date(String(row.starts_at)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, href: `/matters/${row.matter_id}` }))} empty="No upcoming hearings." /><Queue title="Conflict checks" rows={model.conflicts.map((row) => ({ title: String(row.query_summary), href: "/conflict-checks" }))} empty="No visible conflict checks." /></div>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="card metric"><span className="metric-label">{label}</span><strong className="tabular">{value}</strong><span className="metric-icon">{icon}</span></div>; }
function Queue({ title, rows, empty }: { title: string; rows: { title: string; href: string }[]; empty: string }) { return <section className="card card-pad"><div className="section-heading"><h2>{title}</h2></div>{rows.length ? <div className="hearing-list">{rows.map((row) => <Link key={`${row.href}-${row.title}`} className="task-row" href={row.href}><strong>{row.title}</strong></Link>)}</div> : <p className="secondary">{empty}</p>}</section>; }
