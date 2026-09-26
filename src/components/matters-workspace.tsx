"use client";

import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { Matter } from "@/lib/types";

export function MattersWorkspace({ initialMatters, organizationId, demoMode }: { initialMatters: Matter[]; organizationId: string; demoMode: boolean }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [matters, setMatters] = useState<Matter[]>(initialMatters);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(searchParams.get("create") === "true");
  const filtered = useMemo(() => matters.filter((matter) => {
    const matchesQuery = `${matter.title} ${matter.reference} ${matter.cnr ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || matter.status === status);
  }), [matters, query, status]);

  const createMatter = async (formData: FormData) => {
    const title = String(formData.get("title") ?? "").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    if (!title || !reference) return;
    const draft: Matter = {
      id: `matter-${crypto.randomUUID()}`,
      title,
      reference,
      cnr: String(formData.get("cnr") ?? "").trim() || undefined,
      forum: String(formData.get("forum") ?? "Other forum"),
      stage: "Intake",
      status: "draft",
      sourceState: "manual",
      client: String(formData.get("client") ?? "Not assigned"),
      lead: initialMatters[0]?.lead ?? { id: "current", name: "Current user", initials: "CU", role: "advocate" },
      tags: ["New intake"],
    };
    if (!demoMode) {
      const response = await fetch("/api/v1/matters", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({organizationId,title,reference,cnr:draft.cnr,forum:draft.forum,client:draft.client}) });
      const value = await response.json();
      if (!response.ok) { setError(value.error || "Could not create matter."); return; }
      draft.id = value.data.id;
    }
    setMatters((current) => [draft, ...current]);
    setCreating(false);
  };

  return (
    <>
      <div className="filters">
        <div className="global-search" style={{ display: "block", maxWidth: 360, marginRight: 5 }}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, CNR or reference…" /></div>
        {["all", "active", "draft", "stayed", "closed"].map((item) => <button className={`filter-chip ${status === item ? "active" : ""}`} key={item} onClick={() => setStatus(item)} type="button">{item}</button>)}
      </div>
      <div className="card table-card">
        <table className="data-table">
          <thead><tr><th>Matter</th><th>Forum & stage</th><th>Lead</th><th>Source</th><th>Status</th><th></th></tr></thead>
          <tbody>{filtered.map((matter) => <tr key={matter.id}>
            <td className="primary-cell"><strong>{matter.title}</strong><span>{matter.reference}{matter.cnr ? ` · ${matter.cnr}` : ""}</span></td>
            <td><strong>{matter.forum}</strong><div className="muted">{matter.stage}</div></td>
            <td>{matter.lead.name}</td><td><StatusBadge value={matter.sourceState} /></td><td><StatusBadge value={matter.status} /></td>
            <td><Link className="button" href={`/matters/${matter.id}`}>Open</Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      {creating ? <div role="dialog" aria-modal="true" aria-label="Create matter" style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", background: "rgba(2,6,23,.58)", padding: 16 }}>
        <form action={createMatter} className="card card-pad" style={{ width: "min(620px, 100%)" }}>
          <div className="section-heading"><div><p className="eyebrow">Manual matter intake</p><h2>Create matter</h2></div><button aria-label="Close" className="icon-button" onClick={() => setCreating(false)} type="button"><X size={18} /></button></div>
          <div className="admin-grid">
            <div className="field"><label htmlFor="title">Matter title</label><input id="title" name="title" required /></div>
            <div className="field"><label htmlFor="reference">Case reference</label><input id="reference" name="reference" required /></div>
            <div className="field"><label htmlFor="cnr">CNR (optional)</label><input id="cnr" name="cnr" /></div>
            <div className="field"><label htmlFor="client">Client</label><input id="client" name="client" required /></div>
            <div className="field"><label htmlFor="forum">Forum</label><select id="forum" name="forum"><option>Delhi High Court</option><option>Supreme Court of India</option><option>NCLT Principal Bench</option><option>Other forum</option></select></div>
          </div>
          <p className="form-help">This creates a draft manual record. No court source will be contacted.</p>{error ? <p className="danger" role="alert">{error}</p> : null}
          <div className="actions" style={{ justifyContent: "flex-end" }}><button className="button" onClick={() => setCreating(false)} type="button">Cancel</button><button className="button primary" type="submit"><Plus size={14} />Create draft</button></div>
        </form>
      </div> : null}
      {!creating ? <button className="button primary" onClick={() => setCreating(true)} type="button" style={{ position: "fixed", right: 22, bottom: 84 }}><Plus size={15} />New matter</button> : null}
    </>
  );
}
