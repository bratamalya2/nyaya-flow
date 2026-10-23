"use client";

import { AlertTriangle, ArrowLeftRight, CheckCircle2, FileDiff, Save } from "lucide-react";
import { useMemo, useState } from "react";

type Mapping = { id: string; legacy: { code: string; section: string }; current: { code: string; section: string } | null };
export function TransitionWorkspace({ mappings }: { mappings: Mapping[] }) {
  const [offenceDate, setOffenceDate] = useState("");
  const [firDate, setFirDate] = useState("");
  const [proceedingDate, setProceedingDate] = useState("");
  const [draft, setDraft] = useState("");
  const [mappingId, setMappingId] = useState(mappings[0]?.id ?? "");
  const [saveMessage, setSaveMessage] = useState<string>();
  const review = useMemo(() => {
    const messages = ["Lawyer review is required. This worksheet does not determine the applicable law."];
    if (offenceDate) messages.push(offenceDate < "2024-07-01" ? "Recorded offence date is before 1 July 2024: verify substantive-law and savings questions against the official source." : "Recorded offence date is on/after 1 July 2024: verify commencement facts and the official source.");
    if (firDate || proceedingDate) messages.push("FIR/proceeding dates are recorded as context; they do not create an automated legal conclusion.");
    return messages;
  }, [offenceDate, firDate, proceedingDate]);
  const hits = mappings.filter((mapping) => draft.toLowerCase().includes(`${mapping.legacy.code.toLowerCase()} ${mapping.legacy.section.toLowerCase()}`) || draft.toLowerCase().includes(`section ${mapping.legacy.section.toLowerCase()}`));
  async function saveWorksheet() {
    setSaveMessage(undefined);
    const response = await fetch("/api/v1/transitions/worksheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mappingId: mappingId || null, offenceDate, firDate, proceedingDate }) });
    const data = await response.json().catch(() => ({}));
    setSaveMessage(response.ok ? "Worksheet saved for lawyer review." : (data.error || "Could not save worksheet."));
  }
  return <div className="transition-tools">
    <section className="card transition-tool"><div className="section-heading"><div><p className="eyebrow"><CheckCircle2 size={12} /> Review worksheet</p><h2>Transition applicability review</h2></div><span className="policy-state">Review required</span></div>
      <div className="transition-date-grid"><label className="field"><span>Mapping</span><select onChange={(event) => setMappingId(event.target.value)} value={mappingId}>{mappings.map((mapping) => <option key={mapping.id} value={mapping.id}>{mapping.legacy.code} {mapping.legacy.section} → {mapping.current ? `${mapping.current.code} ${mapping.current.section}` : "review"}</option>)}</select></label><label className="field"><span>Offence date</span><input onChange={(event) => setOffenceDate(event.target.value)} type="date" value={offenceDate} /></label><label className="field"><span>FIR date</span><input onChange={(event) => setFirDate(event.target.value)} type="date" value={firDate} /></label><label className="field"><span>Proceeding date</span><input onChange={(event) => setProceedingDate(event.target.value)} type="date" value={proceedingDate} /></label></div>
      <div className="research-answer-warning"><AlertTriangle size={15} /><span>{review.map((message) => <span className="transition-message" key={message}>{message}</span>)}</span></div><button className="button" onClick={saveWorksheet} type="button"><Save size={13} /> Save worksheet for review</button>{saveMessage ? <p className="research-note-message" role="status"><CheckCircle2 size={14} /> {saveMessage}</p> : null}
    </section>
    <section className="card transition-tool"><div className="section-heading"><div><p className="eyebrow"><FileDiff size={12} /> Local-only draft check</p><h2>Flag legacy citations</h2><p>Text stays in this browser; no draft is uploaded or automatically rewritten.</p></div><ArrowLeftRight size={18} /></div>
      <textarea aria-label="Draft citation check" onChange={(event) => setDraft(event.target.value)} placeholder="Paste a non-sensitive draft excerpt to flag possible legacy citations…" rows={6} value={draft} />
      {draft ? <div className="transition-hits">{hits.length ? hits.map((hit) => <p key={hit.id}><strong>{hit.legacy.code} {hit.legacy.section}</strong> may need review against {hit.current ? `${hit.current.code} ${hit.current.section}` : "the reviewed corpus"}. No replacement is applied.</p>) : <p>No fixture legacy citation matched. This is not evidence that the draft has no transition issue.</p>}</div> : null}
    </section>
  </div>;
}
