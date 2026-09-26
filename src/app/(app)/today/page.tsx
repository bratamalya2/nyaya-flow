import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarDays, Clock3, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { findHearingConflicts, formatTime } from "@/lib/conflicts";
import { listHearings, listMatters, listTasks } from "@/lib/repositories/workspace";
import { TaskToggle } from "@/components/task-toggle";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const [hearings, matters, tasks] = await Promise.all([listHearings(), listMatters(), listTasks()]);
  const conflicts = findHearingConflicts(hearings, 35);
  const openTasks = tasks.filter((task) => task.state !== "done" && task.state !== "cancelled");
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><Scale size={13} /> Daily chamber docket · Asia/Kolkata</p>
          <h1>Today&apos;s Cause List & Workboard</h1>
          <p className="lede">Manual court records, assigned work, and source state in one reliable morning view.</p>
        </div>
        <div className="actions">
          <button className="button" type="button"><CalendarDays size={15} /> Today</button>
          <Link className="button primary" href="/matters?create=true">New matter <ArrowRight size={14} /></Link>
        </div>
      </header>

      <div className="metrics">
        <div className="card metric"><span className="metric-label">Listed today</span><strong>{String(hearings.length).padStart(2, "0")}</strong><p>Across {new Set(hearings.map((item) => item.forum)).size} forums</p><span className="metric-icon"><CalendarDays size={18} /></span></div>
        <div className="card metric"><span className="metric-label">Active matters</span><strong>{matters.filter((matter) => matter.status === "active").length}</strong><p>{matters.filter((matter) => matter.restricted).length} restricted matter</p><span className="metric-icon"><BriefcaseBusiness size={18} /></span></div>
        <div className="card metric alert"><span className="metric-label">Overlap conflicts</span><strong>{String(conflicts.length).padStart(2, "0")}</strong><p>Human decision required</p><span className="metric-icon"><AlertTriangle size={18} /></span></div>
        <div className="card metric"><span className="metric-label">Open tasks</span><strong>{String(openTasks.length).padStart(2, "0")}</strong><p>{openTasks.filter((task) => task.priority === "urgent").length} urgent today</p><span className="metric-icon"><ShieldCheck size={18} /></span></div>
      </div>

      {conflicts.map((conflict) => (
        <section className="alert" key={`${conflict.first.id}-${conflict.second.id}`} aria-label="Hearing conflict">
          <AlertTriangle size={24} className="danger" />
          <div className="alert-copy">
            <strong>HEARING OVERLAP · {conflict.first.courtRoom} and {conflict.second.courtRoom}</strong>
            <p>{conflict.first.advocate.name} is assigned to both matters. The time windows overlap by {conflict.overlapMinutes} minutes and the configured travel buffer is {conflict.travelMinutes} minutes.</p>
          </div>
          <div className="actions"><button className="button" type="button">Dismiss with reason</button><button className="button danger-button" type="button">Plan proxy counsel</button></div>
        </section>
      ))}

      <div className="content-grid">
        <section>
          <div className="section-heading"><div><h2>Hearing board</h2><p>Times are entered manually and must be verified against official listings.</p></div><StatusBadge value="manual" /></div>
          <div className="hearing-list">
            {hearings.map((hearing) => (
              <article className="card hearing-card" key={hearing.id}>
                <div className="hearing-top"><strong>{hearing.forum} · {hearing.courtRoom}</strong><StatusBadge value={hearing.sourceState} /></div>
                <div className="hearing-body">
                  <div className="item-box"><span>Item</span><strong>#{hearing.itemNumber}</strong></div>
                  <div><Link className="hearing-title" href={`/matters/${hearing.matterId}`}>{hearing.matterTitle}</Link><div className="hearing-meta">{hearing.reference} · {hearing.advocate.name} · {hearing.status}</div></div>
                  <div className="hearing-time"><strong>{formatTime(hearing.startsAt)}</strong><span>to {formatTime(hearing.endsAt)} IST</span></div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside>
          <div className="section-heading"><div><h2>Priority tasks</h2><p>Assigned work due today.</p></div></div>
          <div className="card task-list">
            {tasks.map((task) => (
              <label className="task-row" key={task.id}>
                <TaskToggle id={task.id} initialDone={task.state === "done"} />
                <span><strong className={task.state === "done" ? "muted" : ""}>{task.title}</strong><p>{task.assignee.name}</p></span>
                <span className={`task-time ${task.priority === "urgent" ? "danger" : ""}`}><Clock3 size={11} style={{ verticalAlign: "-2px" }} /> {formatTime(task.dueAt)}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
