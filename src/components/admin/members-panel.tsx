"use client";

import { Copy, UserPlus } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useMutation } from "@/components/matter/use-mutation";
import { FormError, Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import type { AppRole, Invitation, Member } from "@/lib/types";

const label = (role: string) => role.replaceAll("_", " ");

export function MembersPanel({ members, invitations, currentUserId, canAdminister, assignableRoles, demoMode }: {
  members: Member[]; invitations: Invitation[]; currentUserId: string; canAdminister: boolean; assignableRoles: AppRole[]; demoMode: boolean;
}) {
  const { busy, error, mutate } = useMutation(demoMode);
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const invite = useMutation(demoMode);

  async function sendInvite(data: FormData) {
    const result = await invite.mutate<{ data: { link: string } }>("/api/v1/invitations", "POST", { email: String(data.get("email") ?? ""), role: String(data.get("role") ?? "associate"), expiresInDays: Number(data.get("days") ?? 7) });
    if (result) setLink(result.data.link);
  }

  return (
    <section className="card card-pad">
      <div className="section-heading">
        <div><p className="eyebrow">Workspace members</p><h2>People & roles</h2></div>
        {canAdminister ? <button className="button primary" onClick={() => { setInviting(true); setLink(null); setCopied(false); }} type="button"><UserPlus size={14} />Invite member</button> : null}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Member</th><th>Role</th><th>MFA</th><th>Status</th></tr></thead>
          <tbody>{members.map((member) => {
            const self = member.id === currentUserId;
            const editable = canAdminister && !self && (member.role !== "owner" || assignableRoles.includes("owner"));
            return (
              <tr key={member.id}>
                <td className="primary-cell"><strong>{member.name}{self ? " (you)" : ""}</strong><span>{member.email}</span></td>
                <td>{editable ? (
                  <select aria-label={`Role for ${member.name}`} defaultValue={member.role} disabled={busy} onChange={(event) => void mutate(`/api/v1/members/${member.id}`, "PATCH", { role: event.target.value })}>
                    {assignableRoles.concat(assignableRoles.includes(member.role) ? [] : [member.role]).map((role) => <option key={role} value={role}>{label(role)}</option>)}
                  </select>
                ) : <span style={{ textTransform: "capitalize" }}>{label(member.role)}</span>}</td>
                <td><StatusBadge value={member.mfaEnabled ? "enrolled" : "pending"} /></td>
                <td>{editable ? (
                  <button className="button small" disabled={busy} onClick={() => void mutate(`/api/v1/members/${member.id}`, "PATCH", { active: !member.active })} type="button">{member.active ? "Deactivate" : "Reactivate"}</button>
                ) : <StatusBadge value={member.active ? "active" : "inactive"} />}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <FormError message={error} />
      {canAdminister && invitations.length ? (
        <div className="section-block">
          <p className="nav-label" style={{ paddingLeft: 0 }}>Pending invitations</p>
          {invitations.map((invitation) => (
            <div className="policy-row" key={invitation.id}>
              <div><strong>{invitation.email}</strong><p>{label(invitation.role)} · invited by {invitation.invitedBy} · expires {formatDate(invitation.expiresAt)}</p></div>
              <button className="button small" disabled={busy} onClick={() => void mutate(`/api/v1/invitations/${invitation.id}`, "DELETE")} type="button">Revoke</button>
            </div>
          ))}
        </div>
      ) : null}
      <Modal eyebrow="Operator-controlled access" onClose={() => setInviting(false)} open={inviting} title="Invite a member">
        {link ? (
          <div>
            <p className="form-success" role="status">Invitation created. Share this one-time link privately. It is shown only once.</p>
            <div className="field"><label htmlFor="invite-link">Invitation link</label><input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></div>
            <div className="modal-actions">
              <button className="button" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }} type="button"><Copy size={13} />{copied ? "Copied" : "Copy link"}</button>
              <button className="button primary" onClick={() => setInviting(false)} type="button">Done</button>
            </div>
          </div>
        ) : (
          <form action={sendInvite}>
            <p className="lede">The invitee sets a password and must enrol an authenticator app before seeing any firm data. No email is sent by NyayaFlow.</p>
            <div className="field"><label htmlFor="invite-email">Work email</label><input autoComplete="off" id="invite-email" name="email" required type="email" /></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="invite-role">Role</label><select defaultValue="associate" id="invite-role" name="role">{assignableRoles.map((role) => <option key={role} value={role}>{label(role)}</option>)}</select></div>
              <div className="field"><label htmlFor="invite-days">Link valid for</label><select defaultValue="7" id="invite-days" name="days">{[1, 3, 7, 14].map((days) => <option key={days} value={days}>{days} day{days > 1 ? "s" : ""}</option>)}</select></div>
            </div>
            <FormError message={invite.error} />
            <div className="modal-actions"><button className="button" onClick={() => setInviting(false)} type="button">Cancel</button><button className="button primary" disabled={invite.busy} type="submit">Create invitation</button></div>
          </form>
        )}
      </Modal>
    </section>
  );
}
