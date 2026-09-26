"use client";

import { LockKeyhole, ShieldOff, UserPlus } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useMutation } from "@/components/matter/use-mutation";
import { FormError, Modal } from "@/components/ui/modal";
import { istDateTime } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/format";
import type { LegalHold, MatterGrant, Person } from "@/lib/types";

export function GrantsPanel({ matterId, grants, members, canManage, restricted, demoMode }: { matterId: string; grants: MatterGrant[]; members: Person[]; canManage: boolean; restricted: boolean; demoMode: boolean }) {
  const { busy, error, mutate } = useMutation(demoMode);
  async function add(data: FormData) {
    const expires = String(data.get("expires") ?? "");
    await mutate(`/api/v1/matters/${matterId}/grants`, "POST", { userId: String(data.get("userId")), permission: String(data.get("permission")), expiresAt: expires ? istDateTime(expires, "23:59") : undefined });
  }
  return (
    <section className="card card-pad">
      <div className="section-heading"><div><p className="eyebrow"><LockKeyhole size={13} /> Matter grants</p><h2>Who else can access</h2></div><StatusBadge value={restricted ? "restricted" : "firm-wide"} /></div>
      <p className="lede" style={{ marginTop: 0 }}>{restricted ? "Restricted: only owners, managing partners, admins, and the people below can open this matter." : "Every active member can view this matter; advocates, associates, and paralegals can edit. Grants add manage or export rights."}</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Person</th><th>Permission</th><th>Expires</th><th>Granted by</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{grants.map((grant) => (
            <tr key={grant.id}>
              <td>{grant.userName}</td><td><StatusBadge value={grant.permission} /></td><td className="tabular">{grant.expiresAt ? formatDateTime(grant.expiresAt) : "No expiry"}</td><td>{grant.grantedBy}</td>
              <td>{canManage ? <button className="button small" disabled={busy} onClick={() => void mutate(`/api/v1/matters/${matterId}/grants/${grant.id}`, "DELETE")} type="button">Revoke</button> : null}</td>
            </tr>
          ))}</tbody>
        </table>
        {!grants.length ? <div className="empty-state">No explicit grants.</div> : null}
      </div>
      {canManage ? (
        <form action={add} className="actions" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0, minWidth: 180 }}><label htmlFor="g-user">Person</label><select id="g-user" name="userId" required>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="g-permission">Permission</label><select defaultValue="view" id="g-permission" name="permission">{["view", "edit", "manage", "export"].map((permission) => <option key={permission} value={permission}>{permission}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="g-expires">Expires (optional)</label><input id="g-expires" name="expires" type="date" /></div>
          <button className="button primary" disabled={busy} type="submit"><UserPlus size={14} />Grant access</button>
        </form>
      ) : <p className="form-help">Managing access requires manage permission on this matter.</p>}
      <FormError message={error} />
    </section>
  );
}

export function LegalHoldPanel({ matterId, holds, canManage, demoMode }: { matterId: string; holds: LegalHold[]; canManage: boolean; demoMode: boolean }) {
  const [releasing, setReleasing] = useState<LegalHold | null>(null);
  const { busy, error, mutate } = useMutation(demoMode);
  const active = holds.find((hold) => hold.active);
  return (
    <section className="card card-pad">
      <div className="section-heading"><div><p className="eyebrow"><ShieldOff size={13} /> Retention</p><h2>Legal hold</h2></div><StatusBadge value={active ? "hold" : "none"} /></div>
      {active ? <p className="lede" style={{ marginTop: 0 }}>Placed {formatDate(active.createdAt)} by {active.createdBy}: {active.reason} Held material cannot be deleted, including through erasure requests.</p> : <p className="lede" style={{ marginTop: 0 }}>No active hold. Automatic deletion is disabled for the whole organization.</p>}
      {canManage && !active ? (
        <form action={async (data) => { await mutate(`/api/v1/matters/${matterId}/legal-holds`, "POST", { reason: String(data.get("reason") ?? "") }); }} style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="hold-reason">Reason</label><input id="hold-reason" maxLength={500} minLength={3} name="reason" placeholder="e.g. Appeal window open; preserve all versions" required /></div>
          <button className="button" disabled={busy} type="submit">Place legal hold</button>
        </form>
      ) : null}
      {canManage && active ? <button className="button" onClick={() => setReleasing(active)} style={{ marginTop: 10 }} type="button">Release hold</button> : null}
      {holds.filter((hold) => !hold.active).length ? <p className="form-help">{holds.filter((hold) => !hold.active).length} released hold(s) in history.</p> : null}
      <FormError message={error} />
      <Modal eyebrow="Legal hold" onClose={() => setReleasing(null)} open={Boolean(releasing)} title="Release legal hold">
        <form action={async (data) => { if (await mutate(`/api/v1/legal-holds/${releasing?.id}`, "PATCH", { active: false, reason: String(data.get("reason") ?? "") })) setReleasing(null); }}>
          <p className="lede">Releasing allows retention rules to apply again. Your reason is recorded in the audit trail.</p>
          <div className="field"><label htmlFor="release-reason">Reason</label><textarea id="release-reason" maxLength={500} minLength={3} name="reason" required /></div>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={() => setReleasing(null)} type="button">Cancel</button><button className="button danger-button" disabled={busy} type="submit">Release hold</button></div>
        </form>
      </Modal>
    </section>
  );
}
