"use client";

import { LockKeyhole, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { FormError, Modal } from "@/components/ui/modal";
import { callApi, submitWith } from "@/lib/client-api";
import type { Matter, Person } from "@/lib/types";

const FORUMS = ["Supreme Court of India", "Delhi High Court", "Bombay High Court", "NCLT Principal Bench", "NCLAT", "District Court", "Consumer Commission", "Revenue Court"];
const CNR = /^[A-Z]{4}\d{12}$/;
type Duplicate = { id: string; title: string; reference: string; cnr?: string; forum: string };
type PartyDraft = { key: number; name: string; partyType: string };

interface Props {
  initialMatters: Matter[];
  members: Person[];
  currentUserId: string;
  canCreate: boolean;
  canCreateRestricted: boolean;
  demoMode: boolean;
}

export function MattersWorkspace({ initialMatters, members, currentUserId, canCreate, canCreateRestricted, demoMode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [matters, setMatters] = useState<Matter[]>(initialMatters);
  const [creating, setCreating] = useState(canCreate && searchParams.get("create") === "true");
  const filtered = useMemo(() => matters.filter((matter) => {
    const haystack = `${matter.title} ${matter.reference} ${matter.cnr ?? ""} ${matter.client}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "all" || matter.status === status);
  }), [matters, query, status]);

  return (
    <>
      <div className="filters">
        <div className="global-search" style={{ display: "block", maxWidth: 360, marginRight: 5, flex: "0 0 auto", width: 320 }}>
          <Search size={16} aria-hidden="true" />
          <input aria-label="Filter matters" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by title, client, CNR or reference…" />
        </div>
        {["all", "active", "draft", "stayed", "closed"].map((item) => <button aria-pressed={status === item} className={`filter-chip ${status === item ? "active" : ""}`} key={item} onClick={() => setStatus(item)} type="button">{item}</button>)}
        {canCreate ? <button className="button primary" onClick={() => setCreating(true)} style={{ marginLeft: "auto" }} type="button"><Plus size={14} />New matter</button> : null}
      </div>
      <div className="card table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Matter</th><th>Forum & stage</th><th>Lead</th><th>Next listing</th><th>Source</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {filtered.map((matter) => (
                <tr key={matter.id}>
                  <td className="primary-cell"><strong>{matter.restricted ? <LockKeyhole size={11} aria-label="Restricted" style={{ marginRight: 4 }} /> : null}{matter.title}</strong><span>{matter.reference}{matter.cnr ? ` · ${matter.cnr}` : ""} · {matter.client}</span></td>
                  <td><strong>{matter.forum}</strong><div className="muted">{matter.stage}</div></td>
                  <td>{matter.lead.name}</td>
                  <td className="tabular">{matter.nextListingAt ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(matter.nextListingAt)) : <span className="muted">—</span>}</td>
                  <td><StatusBadge value={matter.sourceState} /></td>
                  <td><StatusBadge value={matter.status} /></td>
                  <td><Link className="button small" href={`/matters/${matter.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <div className="empty-state"><strong>No matters match.</strong>{matters.length ? "Clear the filter to see all matters you can access." : "Create the first matter to begin."}</div> : null}
      </div>
      {creating ? (
        <CreateMatterDialog
          canCreateRestricted={canCreateRestricted}
          currentUserId={currentUserId}
          demoMode={demoMode}
          members={members}
          onClose={() => setCreating(false)}
          onCreated={(matter) => {
            setCreating(false);
            if (demoMode) setMatters((current) => [matter, ...current]);
            else router.push(`/matters/${matter.id}`);
          }}
        />
      ) : null}
    </>
  );
}

function CreateMatterDialog({ members, currentUserId, canCreateRestricted, demoMode, onClose, onCreated }: {
  members: Person[]; currentUserId: string; canCreateRestricted: boolean; demoMode: boolean; onClose: () => void; onCreated: (matter: Matter) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cnr, setCnr] = useState("");
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [parties, setParties] = useState<PartyDraft[]>([{ key: 1, name: "", partyType: "petitioner" }, { key: 2, name: "", partyType: "respondent" }]);
  const cnrInvalid = cnr.trim() !== "" && !CNR.test(cnr.trim().toUpperCase());

  async function checkDuplicates(form: HTMLFormElement) {
    const data = new FormData(form);
    const reference = String(data.get("reference") ?? "").trim();
    const cnrValue = String(data.get("cnr") ?? "").trim();
    if (reference.length < 2 && !cnrValue) return;
    const params = new URLSearchParams({ reference, cnr: cnrValue, forum: String(data.get("forum") ?? "") });
    const result = await callApi<{ data: Duplicate[] }>(`/api/v1/matters/duplicates?${params}`);
    if (result.ok) { setDuplicates(result.data.data); setAcknowledged(false); }
  }

  async function submit(formData: FormData) {
    setError(null);
    if (cnrInvalid) { setError("CNR must be 4 letters followed by 12 digits, or left blank."); return; }
    if (duplicates.length && !acknowledged) { setError("Confirm that this is a different matter from the possible duplicates listed."); return; }
    setBusy(true);
    const body = {
      title: String(formData.get("title") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      cnr: String(formData.get("cnr") ?? ""),
      forum: String(formData.get("forum") ?? ""),
      courtRoom: String(formData.get("courtRoom") ?? ""),
      client: String(formData.get("client") ?? ""),
      leadId: String(formData.get("leadId") ?? currentUserId),
      restricted: formData.get("restricted") === "on",
      parties: parties.filter((party) => party.name.trim().length >= 2).map((party) => ({ name: party.name.trim(), partyType: party.partyType })),
    };
    if (demoMode) {
      const lead = members.find((member) => member.id === body.leadId) ?? members[0];
      onCreated({ id: `demo-${crypto.randomUUID()}`, title: body.title, reference: body.reference, cnr: body.cnr.toUpperCase() || undefined, forum: body.forum, courtRoom: body.courtRoom || undefined, stage: "Intake", status: "draft", sourceState: "manual", updatedAt: new Date().toISOString(), client: body.client, lead, restricted: body.restricted, tags: [] });
      return;
    }
    const result = await callApi<{ data: { id: string } }>("/api/v1/matters", { method: "POST", body });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onCreated({ id: result.data.data.id } as Matter);
  }

  return (
    <Modal eyebrow="Manual matter intake" onClose={onClose} open title="Create matter" width={680}>
      <form onSubmit={submitWith(submit)} onBlur={(event) => { const target = event.target; if (target instanceof HTMLInputElement && ["reference", "cnr", "forum"].includes(target.name)) void checkDuplicates(event.currentTarget); }}>
        <div className="form-grid">
          <div className="field span-2"><label htmlFor="title">Matter title</label><input id="title" name="title" required minLength={3} maxLength={240} placeholder="Petitioner v. Respondent" /></div>
          <div className="field"><label htmlFor="reference">Case reference</label><input id="reference" name="reference" required minLength={2} maxLength={100} placeholder="W.P.(C) 1234/2026" /></div>
          <div className="field">
            <label htmlFor="cnr">CNR (optional)</label>
            <input aria-describedby="cnr-help" aria-invalid={cnrInvalid} id="cnr" name="cnr" value={cnr} onChange={(event) => setCnr(event.target.value)} maxLength={16} placeholder="DLHC010012342026" style={{ textTransform: "uppercase" }} />
            <small id="cnr-help" className={cnrInvalid ? "danger" : undefined}>{cnrInvalid ? "Use 4 letters followed by 12 digits." : "16 characters, where the forum issues one."}</small>
          </div>
          <div className="field"><label htmlFor="forum">Forum</label><input id="forum" list="forum-options" name="forum" required minLength={2} defaultValue="Delhi High Court" /><datalist id="forum-options">{FORUMS.map((forum) => <option key={forum} value={forum} />)}</datalist></div>
          <div className="field"><label htmlFor="courtRoom">Court room (optional)</label><input id="courtRoom" name="courtRoom" maxLength={80} placeholder="Court 12" /></div>
          <div className="field"><label htmlFor="client">Client</label><input id="client" name="client" required minLength={2} maxLength={200} /></div>
          <div className="field"><label htmlFor="leadId">Lead advocate</label><select defaultValue={currentUserId} id="leadId" name="leadId">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontSize: 10, fontWeight: 700, marginBottom: 5 }}>Parties</legend>
          {parties.map((party, index) => (
            <div className="actions" key={party.key} style={{ marginBottom: 6, flexWrap: "nowrap" }}>
              <select aria-label={`Party ${index + 1} role`} value={party.partyType} onChange={(event) => setParties((current) => current.map((item) => item.key === party.key ? { ...item, partyType: event.target.value } : item))} style={{ width: 140, flex: "0 0 auto" }}>
                {["petitioner", "respondent", "appellant", "defendant", "other"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <input aria-label={`Party ${index + 1} name`} value={party.name} onChange={(event) => setParties((current) => current.map((item) => item.key === party.key ? { ...item, name: event.target.value } : item))} placeholder="Party name" />
              <button aria-label={`Remove party ${index + 1}`} className="icon-button" onClick={() => setParties((current) => current.filter((item) => item.key !== party.key))} type="button"><Trash2 size={15} /></button>
            </div>
          ))}
          {parties.length < 20 ? <button className="button small" onClick={() => setParties((current) => [...current, { key: Date.now(), name: "", partyType: "respondent" }])} type="button"><Plus size={12} />Add party</button> : null}
        </fieldset>
        {canCreateRestricted ? <label className="check-field"><input name="restricted" type="checkbox" /><span><strong>Restricted matter.</strong> Only owners, managing partners, admins, and people you grant access can see it. A lead outside leadership receives manage access.</span></label> : null}
        {duplicates.length ? (
          <div className="form-note" role="status">
            <strong>Possible duplicate{duplicates.length > 1 ? "s" : ""}:</strong>
            <ul style={{ margin: "6px 0", paddingLeft: 18 }}>{duplicates.map((duplicate) => <li key={duplicate.id}><Link href={`/matters/${duplicate.id}`} target="_blank">{duplicate.reference}{duplicate.cnr ? ` · ${duplicate.cnr}` : ""}</Link> — {duplicate.title} ({duplicate.forum})</li>)}</ul>
            <label className="check-field" style={{ margin: 0 }}><input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" /><span>This is a different matter.</span></label>
          </div>
        ) : null}
        <p className="form-help">This creates a draft manual record. No court source is contacted.</p>
        <FormError message={error} />
        <div className="modal-actions"><button className="button" onClick={onClose} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit"><Plus size={14} />Create draft</button></div>
      </form>
    </Modal>
  );
}
