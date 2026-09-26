"use client";

import { Building2, Copy, Link2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { FormError, Modal } from "@/components/ui/modal";
import { callApi, submitWith } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PlatformOrganization } from "@/lib/repositories/platform";
import { suggestSlug, SLUG_PATTERN } from "@/lib/slug";

type IssuedLink = { title: string; email: string; link: string; expiresAt: string };

function LinkPanel({ issued, onDone }: { issued: IssuedLink; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="form-success" role="status">Share this one-time link privately with {issued.email}. It is shown only once and expires {formatDateTime(issued.expiresAt)}.</p>
      <div className="field"><label htmlFor="issued-link">Owner invitation link</label><input id="issued-link" onFocus={(event) => event.currentTarget.select()} readOnly value={issued.link} /></div>
      <p className="form-help">The owner sets their own password and enrols an authenticator app. Opening the link while signed in as a different account will not work.</p>
      <div className="modal-actions">
        <button className="button" onClick={() => { void navigator.clipboard?.writeText(issued.link).then(() => setCopied(true)); }} type="button"><Copy size={13} />{copied ? "Copied" : "Copy link"}</button>
        <button className="button primary" onClick={onDone} type="button">Done</button>
      </div>
    </div>
  );
}

export function OperatorsConsole({ organizations }: { organizations: PlatformOrganization[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [reissue, setReissue] = useState<PlatformOrganization | null>(null);
  const effectiveSlug = slugEdited ? slug : suggestSlug(name);
  const slugInvalid = effectiveSlug !== "" && !SLUG_PATTERN.test(effectiveSlug);

  async function create(data: FormData) {
    setError(null);
    if (slugInvalid) { setError("Use 2–63 lowercase letters, digits, or hyphens for the slug."); return; }
    setBusy(true);
    const email = String(data.get("ownerEmail") ?? "");
    const result = await callApi<{ data: { invitationLink: string; expiresAt: string } }>("/api/v1/platform/organizations", {
      method: "POST",
      body: { organizationName: name, slug: effectiveSlug, ownerEmail: email, expiresInDays: Number(data.get("days") ?? 7) },
    });
    setBusy(false);
    if (!result.ok) { setError(result.status === 409 ? "That workspace slug is already taken. Choose another." : result.error); return; }
    setIssued({ title: name, email, link: result.data.data.invitationLink, expiresAt: result.data.data.expiresAt });
    setName(""); setSlug(""); setSlugEdited(false);
    router.refresh();
  }

  async function issueAgain(data: FormData) {
    if (!reissue) return;
    setError(null);
    setBusy(true);
    const email = String(data.get("ownerEmail") ?? "");
    const result = await callApi<{ data: { invitationLink: string; expiresAt: string } }>(`/api/v1/platform/organizations/${reissue.id}/owner-invitations`, { method: "POST", body: { ownerEmail: email, expiresInDays: Number(data.get("days") ?? 7) } });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setIssued({ title: reissue.name, email, link: result.data.data.invitationLink, expiresAt: result.data.data.expiresAt });
    setReissue(null);
    router.refresh();
  }

  return (
    <div className="admin-grid">
      <section className="card card-pad">
        <p className="eyebrow"><Plus size={13} /> New operator</p>
        <h2>Create an organization</h2>
        <p className="lede">Creates the firm&apos;s workspace and a one-time invitation for its first owner. No email is sent — you share the link.</p>
        <form method="post" onSubmit={submitWith(create)}>
          <div className="field"><label htmlFor="org-name">Organization name</label><input id="org-name" maxLength={200} minLength={2} onChange={(event) => setName(event.target.value)} placeholder="Rao & Iyer Chambers" required value={name} /></div>
          <div className="field">
            <label htmlFor="org-slug">Workspace slug</label>
            <input aria-describedby="slug-help" aria-invalid={slugInvalid} id="org-slug" maxLength={63} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} required value={effectiveSlug} />
            <small className={slugInvalid ? "danger" : undefined} id="slug-help">{slugInvalid ? "Use 2–63 lowercase letters, digits, or hyphens." : "Unique identifier; lowercase letters, digits, and hyphens."}</small>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="owner-email">Owner email</label><input autoComplete="off" id="owner-email" name="ownerEmail" required type="email" /></div>
            <div className="field"><label htmlFor="owner-days">Link valid for</label><select defaultValue="7" id="owner-days" name="days">{[1, 3, 7, 14].map((days) => <option key={days} value={days}>{days} day{days > 1 ? "s" : ""}</option>)}</select></div>
          </div>
          {!reissue ? <FormError message={error} /> : null}
          <button className="button primary" disabled={busy} type="submit"><Building2 size={14} />Create operator</button>
        </form>
      </section>

      <section className="card table-card">
        <div className="card-pad section-heading"><div><p className="eyebrow"><Building2 size={13} /> Tenants</p><h2>Operators</h2></div><span className="secondary" style={{ fontSize: 10 }}>{organizations.length} organization{organizations.length === 1 ? "" : "s"}</span></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Organization</th><th>Owner</th><th>Members</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{organizations.map((organization) => (
              <tr key={organization.id}>
                <td className="primary-cell"><strong>{organization.name}</strong><span className="tabular">{organization.slug}</span></td>
                <td>
                  {organization.ownerEmails.length ? organization.ownerEmails.join(", ") : <StatusBadge value="no owner yet" />}
                  {organization.pendingOwnerEmail ? <div className="muted" style={{ fontSize: 10 }}>Invited {organization.pendingOwnerEmail} · expires {formatDate(organization.pendingOwnerExpiresAt!)}</div> : null}
                </td>
                <td className="tabular">{organization.activeMembers}</td>
                <td className="tabular">{formatDate(organization.createdAt)}</td>
                <td><button className="button small" onClick={() => { setError(null); setReissue(organization); }} type="button"><Link2 size={11} />New owner link</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {!organizations.length ? <div className="empty-state"><strong>No operators yet.</strong>Create the first organization with the form.</div> : null}
      </section>

      <Modal eyebrow="Owner invitation" onClose={() => setIssued(null)} open={Boolean(issued)} title={issued ? `Invitation for ${issued.title}` : "Invitation"}>
        {issued ? <LinkPanel issued={issued} onDone={() => setIssued(null)} /> : null}
      </Modal>

      <Modal eyebrow="Owner invitation" onClose={() => setReissue(null)} open={Boolean(reissue)} title={reissue ? `New owner link for ${reissue.name}` : "New owner link"}>
        {reissue ? (
          <form method="post" onSubmit={submitWith(issueAgain)}>
            <p className="lede">Any pending owner link for this organization stops working. Existing owners keep their access.</p>
            <div className="form-grid">
              <div className="field"><label htmlFor="reissue-email">Owner email</label><input defaultValue={reissue.pendingOwnerEmail ?? ""} id="reissue-email" name="ownerEmail" required type="email" /></div>
              <div className="field"><label htmlFor="reissue-days">Link valid for</label><select defaultValue="7" id="reissue-days" name="days">{[1, 3, 7, 14].map((days) => <option key={days} value={days}>{days} day{days > 1 ? "s" : ""}</option>)}</select></div>
            </div>
            <FormError message={error} />
            <div className="modal-actions"><button className="button" onClick={() => setReissue(null)} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Issue link</button></div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
