"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useState } from "react";

type Passage = { id: string; locator: string; heading: string | null };

export function ResearchNoteComposer({ passages }: { passages: Passage[] }) {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(form: FormData) {
    setSaving(true);
    setMessage(undefined);
    const passageId = String(form.get("passageId") || "");
    const claimText = String(form.get("claimText") || "").trim();
    const response = await fetch("/api/v1/research/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: form.get("title"), body: form.get("body"), citations: passageId && claimText ? [{ passageId, claimText }] : [] }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Research note saved as a draft. Review the primary source before relying on it." : (data.error || "Could not save the research note."));
    if (response.ok) (document.getElementById("research-note-form") as HTMLFormElement | null)?.reset();
  }

  return <details className="card research-note-composer">
    <summary><Save size={15} /> Save a research note <span>Draft only</span></summary>
    <form action={submit} id="research-note-form">
      <label className="field"><span>Note title</span><input maxLength={240} name="title" placeholder="What needs verification?" required /></label>
      <label className="field"><span>Working note</span><textarea maxLength={20_000} name="body" placeholder="Record the issue, source limits, and next verification step. Do not treat generated text as a legal conclusion." required rows={5} /></label>
      <div className="research-note-citation">
        <label className="field"><span>Optional passage</span><select name="passageId"><option value="">No passage linked</option>{passages.map((passage) => <option key={passage.id} value={passage.id}>{passage.locator}{passage.heading ? ` · ${passage.heading}` : ""}</option>)}</select></label>
        <label className="field"><span>Claim to verify</span><input maxLength={5_000} name="claimText" placeholder="Describe what you will verify" /></label>
      </div>
      <button className="button primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save draft"} <Save size={13} /></button>
      {message ? <p className="research-note-message" role="status"><CheckCircle2 size={14} /> {message}</p> : null}
    </form>
  </details>;
}
