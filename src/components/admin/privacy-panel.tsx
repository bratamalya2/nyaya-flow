"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useMutation } from "@/components/matter/use-mutation";
import { FormError, Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import type { ConsentRecord, DataRequest, LegalHold, Matter, OrganizationPolicies, RetentionClass } from "@/lib/types";

const NEXT_STEPS: Record<DataRequest["status"], { status: DataRequest["status"]; label: string }[]> = {
  received: [{ status: "identity_review", label: "Start identity check" }],
  identity_review: [{ status: "legal_hold_review", label: "Identity verified" }],
  legal_hold_review: [{ status: "processing", label: "Hold review complete" }],
  processing: [{ status: "fulfilled", label: "Mark fulfilled" }],
  fulfilled: [],
  denied: [],
};

type Transition = { request: DataRequest; status: DataRequest["status"] } | null;

export function PrivacyPanel({ policies, consents, requests, holds, retention, matters, demoMode }: {
  policies: OrganizationPolicies; consents: ConsentRecord[]; requests: DataRequest[]; holds: LegalHold[]; retention: RetentionClass[]; matters: Matter[]; demoMode: boolean;
}) {
  const { busy, error, mutate } = useMutation(demoMode);
  const [transition, setTransition] = useState<Transition>(null);
  const [dialog, setDialog] = useState<"consent" | "request" | "retention" | null>(null);
  const close = () => setDialog(null);

  return (
    <section className="card card-pad">
      <div className="section-heading"><div><p className="eyebrow">DPDP center</p><h2>Privacy controls</h2></div><LockKeyhole size={20} className="teal" /></div>
      <FormError message={error} />

      <div className="policy-row">
        <div><strong>External AI processing</strong><p>{policies.externalAiEnabled ? "Allowed for public, synthetic, and redacted material only." : "Off. Internal and privileged data is always blocked, even when enabled."}</p></div>
        <button aria-pressed={policies.externalAiEnabled} className="button small" disabled={busy} onClick={() => void mutate("/api/v1/organization/policies", "PATCH", { externalAiEnabled: !policies.externalAiEnabled })} type="button">{policies.externalAiEnabled ? "Turn off" : "Allow"}</button>
      </div>
      <div className="policy-row"><div><strong>Automatic deletion</strong><p>Disabled until counsel approves a retention policy. Active legal holds always block deletion.</p></div><StatusBadge value="manual" /></div>

      <div className="section-block">
        <div className="section-heading"><div><h3>Consent and processing basis</h3><p>{consents.filter((consent) => consent.status === "recorded").length} active records</p></div><button className="button small" onClick={() => setDialog("consent")} type="button">Record</button></div>
        {consents.slice(0, 8).map((consent) => (
          <div className="policy-row" key={consent.id}>
            <div><strong>{consent.subjectReference}</strong><p>{consent.purpose} · {consent.legalBasis.replaceAll("_", " ")} · notice v{consent.noticeVersion} · {formatDate(consent.recordedAt)}</p></div>
            <span className="row-actions"><StatusBadge value={consent.status} />{consent.status === "recorded" ? <button className="button small" disabled={busy} onClick={() => void mutate(`/api/v1/privacy/consents/${consent.id}`, "PATCH", { status: "withdrawn" })} type="button">Withdraw</button> : null}</span>
          </div>
        ))}
      </div>

      <div className="section-block">
        <div className="section-heading"><div><h3>Data requests</h3><p>Access, correction, erasure, and export requests</p></div><button className="button small" onClick={() => setDialog("request")} type="button">Log request</button></div>
        {requests.length ? requests.map((request) => (
          <div className="policy-row" key={request.id}>
            <div><strong>{request.requesterReference}</strong><p>{request.requestType} · received {formatDate(request.createdAt)}{request.matterTitle ? ` · ${request.matterTitle}` : ""}{request.decisionReason ? ` · ${request.decisionReason}` : ""}</p></div>
            <span className="row-actions">
              <StatusBadge value={request.status} />
              {NEXT_STEPS[request.status].map((step) => <button className="button small" key={step.status} onClick={() => setTransition({ request, status: step.status })} type="button">{step.label}</button>)}
              {request.status !== "fulfilled" && request.status !== "denied" ? <button className="button small" onClick={() => setTransition({ request, status: "denied" })} type="button">Deny</button> : null}
            </span>
          </div>
        )) : <p className="secondary" style={{ fontSize: 11 }}>No requests logged.</p>}
      </div>

      <div className="section-block">
        <div className="section-heading"><div><h3>Legal holds</h3><p>{holds.filter((hold) => hold.active).length} active</p></div></div>
        {holds.filter((hold) => hold.active).map((hold) => (
          <div className="policy-row" key={hold.id}><div><strong><Link href={`/matters/${hold.matterId}?tab=access`}>{hold.matterTitle}</Link></strong><p>{hold.reason} · since {formatDate(hold.createdAt)} by {hold.createdBy}</p></div><StatusBadge value="hold" /></div>
        ))}
        {!holds.some((hold) => hold.active) ? <p className="secondary" style={{ fontSize: 11 }}>No active holds. Place holds from a matter&apos;s Access tab.</p> : null}
      </div>

      <div className="section-block">
        <div className="section-heading"><div><h3>Retention classes</h3><p>Recorded for review; nothing is deleted automatically.</p></div><button className="button small" onClick={() => setDialog("retention")} type="button">Add class</button></div>
        {retention.map((item) => <div className="policy-row" key={item.id}><div><strong>{item.name}</strong><p>{item.retentionDays ? `${item.retentionDays} days (${(item.retentionDays / 365).toFixed(1)} years)` : "No fixed period"}</p></div><StatusBadge value="manual" /></div>)}
      </div>

      <Modal eyebrow="DPDP" onClose={close} open={dialog === "consent"} title="Record consent or processing basis">
        <form action={async (data) => { if (await mutate("/api/v1/privacy/consents", "POST", { subjectReference: data.get("subject"), purpose: data.get("purpose"), legalBasis: data.get("basis"), noticeVersion: data.get("notice"), status: data.get("status") })) close(); }}>
          <div className="field"><label htmlFor="c-subject">Data principal reference</label><input id="c-subject" maxLength={200} minLength={2} name="subject" placeholder="Client or witness reference — avoid full identity numbers" required /></div>
          <div className="field"><label htmlFor="c-purpose">Purpose</label><input id="c-purpose" maxLength={300} minLength={3} name="purpose" required /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="c-basis">Basis</label><select id="c-basis" name="basis">{["consent", "legitimate_use", "legal_obligation", "court_order", "other"].map((basis) => <option key={basis} value={basis}>{basis.replaceAll("_", " ")}</option>)}</select></div>
            <div className="field"><label htmlFor="c-notice">Notice version</label><input defaultValue="2026.1" id="c-notice" maxLength={40} name="notice" required /></div>
            <div className="field"><label htmlFor="c-status">Record as</label><select id="c-status" name="status"><option value="recorded">Consent recorded</option><option value="not_required">Consent not required (other basis)</option></select></div>
          </div>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={close} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Save record</button></div>
        </form>
      </Modal>

      <Modal eyebrow="DPDP" onClose={close} open={dialog === "request"} title="Log a data request">
        <form action={async (data) => { if (await mutate("/api/v1/privacy/requests", "POST", { requesterReference: data.get("requester"), requestType: data.get("type"), matterId: data.get("matter") || undefined })) close(); }}>
          <div className="field"><label htmlFor="r-requester">Requester reference</label><input id="r-requester" maxLength={200} minLength={2} name="requester" required /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="r-type">Request type</label><select id="r-type" name="type">{["access", "correction", "erasure", "export"].map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            <div className="field"><label htmlFor="r-matter">Linked matter (optional)</label><select id="r-matter" name="matter"><option value="">None</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.reference}</option>)}</select></div>
          </div>
          <p className="form-help">Linking a matter lets NyayaFlow block erasure while that matter is under legal hold.</p>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={close} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Log request</button></div>
        </form>
      </Modal>

      <Modal eyebrow="Retention" onClose={close} open={dialog === "retention"} title="Add retention class">
        <form action={async (data) => { const days = String(data.get("days") ?? ""); if (await mutate("/api/v1/retention-classes", "POST", { name: data.get("name"), retentionDays: days ? Number(days) : undefined })) close(); }}>
          <div className="field"><label htmlFor="rc-name">Name</label><input id="rc-name" maxLength={120} minLength={2} name="name" required /></div>
          <div className="field"><label htmlFor="rc-days">Retention period in days (optional)</label><input id="rc-days" max={36500} min={1} name="days" type="number" /></div>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={close} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Add class</button></div>
        </form>
      </Modal>

      <Modal eyebrow="Data request" onClose={() => setTransition(null)} open={Boolean(transition)} title={transition?.status === "denied" ? "Deny request" : "Advance request"}>
        {transition ? (
          <form action={async (data) => { if (await mutate(`/api/v1/privacy/requests/${transition.request.id}`, "PATCH", { status: transition.status, decisionReason: data.get("decision") || undefined, holdReviewNote: data.get("hold") || undefined })) setTransition(null); }}>
            <p className="lede">{transition.request.requesterReference} · {transition.request.requestType} → {transition.status.replaceAll("_", " ")}</p>
            {transition.request.status === "legal_hold_review" && transition.status === "processing" ? (
              <div className="field"><label htmlFor="t-hold">Legal hold and retention review</label><textarea id="t-hold" maxLength={1000} name="hold" placeholder="Holds checked, retention obligations considered, scope of data identified" required /></div>
            ) : null}
            <div className="field"><label htmlFor="t-decision">{transition.status === "denied" ? "Reason for denial" : "Decision note (optional)"}</label><textarea id="t-decision" maxLength={1000} name="decision" required={transition.status === "denied"} /></div>
            <FormError message={error} />
            <div className="modal-actions"><button className="button" onClick={() => setTransition(null)} type="button">Cancel</button><button className={`button ${transition.status === "denied" ? "danger-button" : "primary"}`} disabled={busy} type="submit">Confirm</button></div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
