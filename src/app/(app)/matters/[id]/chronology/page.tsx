import { History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withActor } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Chronology" };
export default async function ChronologyPage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await requireWorkspace(); const { id } = await params;
  const rows = await withActor(workspace.userId, async (client) => (await client.query(`select title,event_type,occurred_on,description,review_state,source_state,confidence from chronology_events where matter_id=$1 and organization_id=$2 order by occurred_on`, [id,workspace.organizationId])).rows);
  if (!rows) notFound();
  return <div className="page"><Link href={`/matters/${id}`} className="eyebrow">← Back to matter</Link><header className="page-heading"><div><p className="eyebrow"><History size={13} /> Versioned evidence timeline</p><h1>Chronology Builder</h1><p className="lede">Manual and approved-redacted proposals remain reviewable with their source state and version history.</p></div></header><section className="card card-pad"><ol className="timeline">{rows.length ? rows.map((row) => <li key={`${row.title}-${row.occurred_on}`}><strong>{String(row.occurred_on).slice(0,10)} · {String(row.title)}</strong><p>{String(row.event_type)} · {String(row.review_state)} · {String(row.source_state)}{row.confidence ? ` · ${row.confidence}% confidence` : ""}</p>{row.description ? <p>{String(row.description)}</p> : null}</li>) : <p className="secondary">No chronology events have been recorded.</p>}</ol></section></div>;
}
