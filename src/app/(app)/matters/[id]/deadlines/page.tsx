import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { withActor } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Deadlines" };
export default async function DeadlinesPage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await requireWorkspace(); const { id } = await params;
  const rows = await withActor(workspace.userId, async (client) => (await client.query(`select title,due_on,risk_level,review_state,calculation from matter_deadlines where matter_id=$1 and organization_id=$2 order by due_on`, [id,workspace.organizationId])).rows);
  return <div className="page"><Link href={`/matters/${id}`} className="eyebrow">← Back to matter</Link><header className="page-heading"><div><p className="eyebrow"><CalendarClock size={13} /> Configurable deadline rules</p><h1>Deadlines</h1><p className="lede">Every calculated date keeps its source rule, assumptions, excluded days, and a human review state. Verify court-specific deadlines before filing.</p></div></header><section className="card card-pad"><div className="hearing-list">{rows.length ? rows.map((row) => <article key={`${row.title}-${row.due_on}`} className="task-row"><span><strong>{String(row.title)}</strong><p>{String(row.review_state)} · {String(row.risk_level)} risk</p></span><strong>{String(row.due_on).slice(0,10)}</strong></article>) : <p className="secondary">No deadlines have been recorded.</p>}</div></section></div>;
}
