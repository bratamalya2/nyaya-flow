import { ArrowLeft, CalendarDays, FileText, LockKeyhole, Scale, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatTime } from "@/lib/conflicts";
import { listDocuments, listHearings, listMatters, listTasks } from "@/lib/repositories/workspace";
import { TaskToggle } from "@/components/task-toggle";

export default async function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [matters, hearings, tasks, documents] = await Promise.all([listMatters(), listHearings(), listTasks(), listDocuments()]);
  const matter = matters.find((item) => item.id === id);
  if (!matter) notFound();
  const matterHearings = hearings.filter((item) => item.matterId === id);
  const matterTasks = tasks.filter((item) => item.matterId === id);
  const matterDocuments = documents.filter((item) => item.matterId === id);

  return <div className="page">
    <Link href="/matters" className="eyebrow"><ArrowLeft size={13} /> Back to matters</Link>
    <section className="card matter-hero">
      <div className="matter-chips"><span className="status-badge">{matter.forum}</span><span className="status-badge">{matter.reference}</span><StatusBadge value={matter.sourceState} />{matter.restricted ? <span className="status-badge"><LockKeyhole size={11} /> Restricted</span> : null}</div>
      <h1>{matter.title}</h1>
      <p className="lede">{matter.client} · {matter.stage}</p>
      <div className="matter-facts"><span><UserRound size={13} style={{ verticalAlign: "-2px" }} /> Lead: <strong>{matter.lead.name}</strong></span>{matter.cnr ? <span>CNR: <strong className="tabular">{matter.cnr}</strong></span> : null}<span><ShieldCheck size={13} style={{ verticalAlign: "-2px" }} /> Matter grants enforced</span>{matter.nextListingAt ? <span><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> Next: <strong>{formatDate(matter.nextListingAt)} · {formatTime(matter.nextListingAt)}</strong></span> : null}</div>
    </section>
    <nav className="tabs" aria-label="Matter sections"><button className="tab active" type="button">Overview</button><Link className="tab" href="/vault">Smart Vault ({matterDocuments.length})</Link><button className="tab" type="button">Proceedings</button><button className="tab" type="button">Access & audit</button></nav>
    <div className="content-grid">
      <section className="card card-pad">
        <div className="section-heading"><div><p className="eyebrow"><Scale size={13} /> Proceeding history</p><h2>Hearings and milestones</h2></div><button className="button primary" type="button">Add hearing</button></div>
        {matterHearings.length ? matterHearings.map((hearing) => <div className="policy-row" key={hearing.id}><div><strong>{formatDate(hearing.startsAt)} · {formatTime(hearing.startsAt)}</strong><p>{hearing.forum}, {hearing.courtRoom} · {hearing.status}</p></div><StatusBadge value={hearing.sourceState} /></div>) : <p className="secondary">No hearing records yet. Add the first manual listing.</p>}
        <div className="section-heading" style={{ marginTop: 22 }}><div><p className="eyebrow"><FileText size={13} /> Recent documents</p><h2>Vault activity</h2></div><Link className="button" href="/vault">Open vault</Link></div>
        {matterDocuments.length ? matterDocuments.map((document) => <div className="policy-row" key={document.id}><div><strong>{document.title}</strong><p>{document.version} · {document.pages} pages · {document.language}</p></div><StatusBadge value={document.status} /></div>) : <p className="secondary">No documents uploaded.</p>}
      </section>
      <aside className="card card-pad">
        <div className="section-heading"><div><p className="eyebrow">Action list</p><h2>Matter tasks</h2></div></div>
        {matterTasks.length ? matterTasks.map((task) => <label className="task-row" key={task.id}><TaskToggle id={task.id} initialDone={task.state === "done"} /><span><strong>{task.title}</strong><p>{task.assignee.name}</p></span><span className={task.priority === "urgent" ? "danger" : "muted"}>{formatTime(task.dueAt)}</span></label>) : <p className="secondary">No tasks assigned.</p>}
        <button className="button" style={{ width: "100%", marginTop: 12 }} type="button">Add task</button>
      </aside>
    </div>
  </div>;
}
