import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Clock3, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ConflictAlert } from "@/components/conflict-alert";
import { StatusBadge } from "@/components/status-badge";
import { TaskToggle } from "@/components/task-toggle";
import { findHearingConflicts } from "@/lib/conflicts";
import { formatDate, formatLongDate, formatTime, isPast, relativeTime, shiftDate, todayInIndia } from "@/lib/format";
import { canEditMatters } from "@/lib/permissions";
import { conflictKey, listDayHearings, listDismissedConflicts, listDueTasks, listMatters } from "@/lib/repositories/workspace";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Today" };

type Search = { date?: string; scope?: string; forum?: string };

export default async function TodayPage({ searchParams }: { searchParams: Promise<Search> }) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const today = todayInIndia();
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const scope = params.scope === "firm" ? "firm" : "mine";
  const personId = scope === "mine" ? workspace.userId : undefined;

  const [dayHearings, tasks, matters] = await Promise.all([
    listDayHearings(workspace, { date, advocateId: personId }),
    listDueTasks(workspace, { assigneeId: personId }),
    listMatters(workspace),
  ]);
  const forums = [...new Set(dayHearings.map((hearing) => hearing.forum))].sort();
  const forum = params.forum && forums.includes(params.forum) ? params.forum : undefined;
  const hearings = forum ? dayHearings.filter((hearing) => hearing.forum === forum) : dayHearings;
  const dismissed = await listDismissedConflicts(workspace, dayHearings.map((hearing) => hearing.id));
  const conflicts = findHearingConflicts(dayHearings, 35).filter((conflict) => !dismissed.has(conflictKey(conflict.first.id, conflict.second.id)));
  const urgent = tasks.filter((task) => task.priority === "urgent").length;
  const overdue = tasks.filter((task) => isPast(task.dueAt)).length;

  const link = (next: Partial<Search>) => {
    const query = new URLSearchParams();
    const merged = { date, scope, forum, ...next };
    if (merged.date && merged.date !== today) query.set("date", merged.date);
    if (merged.scope === "firm") query.set("scope", "firm");
    if (merged.forum) query.set("forum", merged.forum);
    const text = query.toString();
    return text ? `/today?${text}` : "/today";
  };

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><Scale size={13} /> Daily chamber docket · Asia/Kolkata</p>
          <h1>Today&apos;s Cause List & Workboard</h1>
          <p className="lede">Hearings your team entered manually, open work, and each record&apos;s source state. Verify listings against the official cause list.</p>
        </div>
        <div className="actions">
          <div className="segmented" aria-label="Whose work to show">
            <Link aria-current={scope === "mine" ? "true" : undefined} className={scope === "mine" ? "active" : ""} href={link({ scope: "mine" })}>Mine</Link>
            <Link aria-current={scope === "firm" ? "true" : undefined} className={scope === "firm" ? "active" : ""} href={link({ scope: "firm" })}>Firm</Link>
          </div>
          <Link className="button primary" href="/matters?create=true">New matter <ArrowRight size={14} /></Link>
        </div>
      </header>

      <div className="filters" aria-label="Date and forum">
        <div className="date-stepper">
          <Link aria-label="Previous day" className="icon-button" href={link({ date: shiftDate(date, -1) })}><ChevronLeft size={16} /></Link>
          <strong className="tabular">{date === today ? "Today · " : ""}{formatLongDate(date)}</strong>
          <Link aria-label="Next day" className="icon-button" href={link({ date: shiftDate(date, 1) })}><ChevronRight size={16} /></Link>
          {date !== today ? <Link className="button small" href={link({ date: today })}><CalendarDays size={12} /> Today</Link> : null}
        </div>
        <Link className={`filter-chip ${!forum ? "active" : ""}`} href={link({ forum: undefined })}>All forums ({dayHearings.length})</Link>
        {forums.map((item) => <Link className={`filter-chip ${forum === item ? "active" : ""}`} href={link({ forum: item })} key={item}>{item} ({dayHearings.filter((hearing) => hearing.forum === item).length})</Link>)}
      </div>

      <div className="metrics">
        <div className="card metric"><span className="metric-label">Listed {date === today ? "today" : "this day"}</span><strong className="tabular">{String(dayHearings.length).padStart(2, "0")}</strong><p>Across {forums.length} forum{forums.length === 1 ? "" : "s"}</p><span className="metric-icon"><CalendarDays size={18} /></span></div>
        <div className="card metric"><span className="metric-label">Active matters</span><strong className="tabular">{matters.filter((matter) => matter.status === "active").length}</strong><p>{matters.filter((matter) => matter.restricted).length} restricted visible to you</p><span className="metric-icon"><BriefcaseBusiness size={18} /></span></div>
        <div className={`card metric ${conflicts.length ? "alert" : ""}`}><span className="metric-label">Overlap conflicts</span><strong className="tabular">{String(conflicts.length).padStart(2, "0")}</strong><p>{conflicts.length ? "Human decision required" : "None open"}</p><span className="metric-icon"><AlertTriangle size={18} /></span></div>
        <div className="card metric"><span className="metric-label">Open tasks</span><strong className="tabular">{String(tasks.length).padStart(2, "0")}</strong><p>{urgent} urgent · {overdue} overdue</p><span className="metric-icon"><ShieldCheck size={18} /></span></div>
      </div>

      {conflicts.map((conflict) => (
        <ConflictAlert
          canDismiss={canEditMatters(workspace.role)}
          demoMode={isDemoMode()}
          detail={`${conflict.first.advocate.name} is assigned to ${conflict.first.reference} at ${formatTime(conflict.first.startsAt)} and ${conflict.second.reference} at ${formatTime(conflict.second.startsAt)}. ${conflict.overlapMinutes ? `The time windows overlap by ${conflict.overlapMinutes} minutes.` : `The gap between them is shorter than the ${conflict.travelMinutes}-minute travel buffer.`}`}
          firstId={conflict.first.id}
          heading={`HEARING OVERLAP · ${conflict.first.forum} ${conflict.first.courtRoom} and ${conflict.second.forum} ${conflict.second.courtRoom}`}
          key={conflictKey(conflict.first.id, conflict.second.id)}
          secondId={conflict.second.id}
        />
      ))}

      <div className="content-grid">
        <section aria-labelledby="board-heading">
          <div className="section-heading"><div><h2 id="board-heading">Hearing board</h2><p>Entered manually by your team. Confirm times and item numbers against the official listing.</p></div><StatusBadge value="manual" /></div>
          <div className="hearing-list">
            {hearings.length ? hearings.map((hearing) => (
              <article className="card hearing-card" key={hearing.id}>
                <div className="hearing-top"><strong>{hearing.forum} · {hearing.courtRoom}</strong><span className="actions"><StatusBadge value={hearing.status} /><StatusBadge value={hearing.sourceState} /></span></div>
                <div className="hearing-body">
                  <div className="item-box"><span>Item</span><strong className="tabular">{hearing.itemNumber ? `#${hearing.itemNumber}` : "—"}</strong></div>
                  <div style={{ minWidth: 0 }}>
                    <Link className="hearing-title" href={`/matters/${hearing.matterId}`}>{hearing.matterTitle}</Link>
                    <div className="hearing-meta">{hearing.reference} · {hearing.advocate.name} · updated {relativeTime(hearing.updatedAt)}</div>
                    {hearing.note ? <div className="hearing-meta">{hearing.note}</div> : null}
                  </div>
                  <div className="hearing-time"><strong className="tabular">{formatTime(hearing.startsAt)}</strong><span>to {formatTime(hearing.endsAt)} IST</span></div>
                </div>
              </article>
            )) : <div className="card empty-state"><strong>No hearings {scope === "mine" ? "assigned to you" : "entered"} for {formatLongDate(date)}.</strong>Add hearings from a matter&apos;s page.</div>}
          </div>
        </section>
        <aside aria-labelledby="tasks-heading">
          <div className="section-heading"><div><h2 id="tasks-heading">Priority tasks</h2><p>Open work that is overdue or due by tomorrow.</p></div></div>
          <div className="card task-list">
            {tasks.length ? tasks.map((task) => {
              const late = isPast(task.dueAt);
              return (
                <label className="task-row" key={task.id}>
                  <TaskToggle id={task.id} initialDone={false} label={task.title} />
                  <span><strong>{task.title}</strong><p>{task.matterTitle} · {task.assignee?.name ?? "Unassigned"}</p></span>
                  <span className={`task-time ${task.priority === "urgent" || late ? "danger" : ""}`}><Clock3 size={11} style={{ verticalAlign: "-2px" }} /> {late ? `Overdue · ${formatDate(task.dueAt)}` : formatTime(task.dueAt)}</span>
                </label>
              );
            }) : <div className="empty-state"><strong>Nothing due.</strong>Tasks due today or tomorrow appear here.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
