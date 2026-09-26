"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError, Modal } from "@/components/ui/modal";
import { callApi, submitWith } from "@/lib/client-api";

type Props = { firstId: string; secondId: string; heading: string; detail: string; canDismiss: boolean; demoMode: boolean };

export function ConflictAlert({ firstId, secondId, heading, detail, canDismiss, demoMode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  async function dismiss(formData: FormData) {
    setBusy(true);
    setError(null);
    if (demoMode) { setHidden(true); setOpen(false); return; }
    const result = await callApi("/api/v1/conflict-dismissals", { method: "POST", body: { firstHearingId: firstId, secondHearingId: secondId, reason: String(formData.get("reason") ?? "") } });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="alert" aria-label="Hearing conflict">
      <AlertTriangle size={24} className="danger" />
      <div className="alert-copy"><strong>{heading}</strong><p>{detail}</p></div>
      <div className="actions">
        <button className="button" disabled={!canDismiss} onClick={() => setOpen(true)} title={canDismiss ? undefined : "You need edit access to one of these matters"} type="button">Dismiss with reason</button>
        <button className="button" disabled title="Proxy briefs arrive with the Expansion release (FR-016)" type="button">Plan proxy counsel</button>
      </div>
      <Modal eyebrow="Conflict review" onClose={() => setOpen(false)} open={open} title="Dismiss this conflict">
        <form onSubmit={submitWith(dismiss)}>
          <p className="lede">The warning is hidden for this pair of hearings. Your reason is kept in the audit trail.</p>
          <div className="field"><label htmlFor="conflict-reason">Reason</label><textarea id="conflict-reason" maxLength={500} minLength={3} name="reason" placeholder="e.g. Junior counsel Karan Rao will appear in Court 2" required /></div>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={() => setOpen(false)} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Dismiss conflict</button></div>
        </form>
      </Modal>
    </section>
  );
}
