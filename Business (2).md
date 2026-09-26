# NyayaFlow — Business Logic

**Status:** Proposed rules and workflows · **Source:** `feature_specification.md`  
This file describes how the product behaves. Legal conclusions, tax treatment, court filing rules, and professional-conduct interpretations require qualified review before use in production.

## 1. Business entities and ownership

- **Organization** owns subscription, staff, policies, and private matter data.
- **Member** signs in through Supabase Auth and has an application role (owner, managing partner, advocate, associate, paralegal, finance, admin) and explicit grants for restricted matters in Postgres.
- **Client** is a portal identity connected only to explicitly shared matters/documents.
- **Matter** is the work unit: forum, identifiers, parties, assignees, status, dates, documents, tasks, fees, and activity.
- **Source record** retains the external origin, fetched/observed time, parser version, and confidence for imported facts.
- **Legal authority** is an editioned statute or judgment with precise source and passage locators; treatment relationships carry evidence and reviewer state.
- **Document** has immutable versions; an approval or filing package points to a specific version.
- **Ledger entry** tracks financial movements without changing previous entries.

Every tenant-owned Postgres row and private Supabase Storage object belongs to exactly one tenant; shared identity records and the curated public corpus are segregated. A user can access a private resource only through membership and its matter/document grant; organization-wide analytics must not reveal restricted-matter titles or amounts to unauthorized members.

## 2. Matter lifecycle

`Draft → Active → Stayed / Closed`; a closed matter can be reopened by an authorized user, with a reason. Matter identifiers are validated by forum. CNR is accepted only when applicable and is unique per tenant/forum combination, while different case identifiers may be linked to the same matter after review. A sync does not overwrite user-authored notes or confirmed manual corrections. Conflicting source values create a review item.

Hearings have `proposed`, `confirmed`, `adjourned`, `completed`, or `cancelled` states. A new court listing records its source and freshness. Conflict detection compares the advocate's confirmed and proposed hearings, realistic travel buffers, and stated availability; it surfaces a warning, not an automatic reassignment. Proxy briefs share only approved matter facts and expire/revoke with the delegated grant.

## 3. Notifications and client visibility

A change can trigger a message only if the rule is enabled, recipient and contact route are verified, consent/preferences allow that channel, and the underlying event has reached a publishable state. Preview includes source, audience, language, and sensitive fields. Queueing uses a unique `(tenant, event, recipient, channel, templateVersion)` key to avoid duplicates. Delivery status is separate from legal-event truth. Retries are bounded, and failures appear in an action queue. Court-date changes and orders default to advocate approval before client delivery.

A client sees only explicitly published milestones and selected document versions. Revoking access blocks new authenticated reads and URL issuance; previously issued signed download URLs remain usable until expiry, so sensitive files should use authenticated downloads and very short link lifetimes where links are unavoidable. Already downloaded copies cannot be recalled. Daily digests use the recipient's timezone and a configurable send time (default proposed 07:00 IST), deduplicate events, and identify records that are stale or unconfirmed.

## 4. Research and legal authority

Research answers are grounded in a corpus with recorded source rights and publication/update dates. Retrieval filters by jurisdiction, time, access, and source type. Each material legal proposition links to passage-level evidence. If a locator cannot be verified, the system excludes the claim or flags it for manual research. Generated text is draft assistance, never an automatic legal opinion or filing. Citation treatment (`cited`, `followed`, `distinguished`, `overruled`, `doubted`) is displayed with supporting passages and reviewer status. Negative treatment is not inferred merely from a citation edge.

The old/new criminal-code mapping stores effective dates, jurisdiction, exceptions, source references, and version. Applicability checks produce a reasoning worksheet and request fact confirmation; they cannot issue a definitive determination solely from offense/FIR/trial dates. Bulk citation conversion generates a proposed diff and requires lawyer approval before replacing text.

## 5. Documents and filing

Supabase Storage receives uploads only into private, tenant-scoped paths; Postgres records matter/owner linkage and quarantine status. Upload accepts allowed MIME/content types and size limits; quarantine until scan passes. OCR text keeps per-page language and confidence, plus references to the original image. A human can correct extracted text while preserving the original. A synopsis/list of dates or annexure index is a draft requiring review against the case file. Filing rules are versioned by forum and effective date. Defect checks classify `pass`, `warning`, `fail`, or `manual review`; a pass is not a guarantee of registry acceptance. Filing submissions require a human action and a supported, authorized court path.

Signing has a provider-specific flow: identify signers, verify consent, submit exact document hash, capture provider receipt/certificate evidence, and lock signed version. A changed document restarts signing. Token signing support is subject to a supported bridge or partner; eSign only through licensed/authorized providers.

## 6. Contracts, stamp duty, and templates

Templates and clauses are versioned and approved by an organization owner or delegated legal reviewer. A created contract snapshots template and clause versions. Risk scores are explainable draft signals and do not replace legal review. Stamp-duty output stores state, instrument, consideration inputs, rule version, source, and assumptions; uncertain or unsupported combinations return `manual confirmation required`. No procurement or payment is represented as completed without provider confirmation.

## 7. Billing and retainer accounting

Matter work may be fixed fee, hearing fee, hourly, or expense reimbursement as configured in an engagement. Time entries need owner, date, duration, and approval state. Invoice issuance snapshots approved charges, tax treatment, payer, currency, and PDF version. Corrections use credit notes or adjustment entries, never silent mutation of issued invoices. Payment webhooks are authenticated and idempotent; settlement and reconciliation are separate from invoice creation.

Retainer receipts create liability/advance balance entries. Applying a retainer to an earned fee records an explicit allocation and maintains audit history. Prevent an allocation exceeding available balance. Export firm income separately from client advances. Subscription pricing is flat/per-seat SaaS as a proposed model; no referral fee, fee splitting, or success percentage is built into the platform. Final professional-conduct and accounting treatment needs counsel/accountant review.

## 8. Consent, access, and audit

Capture notice version, purpose, legal basis/consent where applicable, timestamp, and actor. Withdrawal blocks future processing dependent on that consent, subject to lawful retention and litigation obligations. Deletion requests move through identity verification, legal hold check, data inventory, fulfillment, and evidence of completion. Audit events record actor, tenant, action, resource, outcome, and time; sensitive contents are minimized. RLS and SQL grants prevent ordinary administrators from modifying access logs; privileged service access is audited separately. Exports and bulk downloads require elevated grants and are logged.

## 9. Entitlements and plan enforcement

Organizations have plan limits for seats, storage, OCR pages, research usage, and connectors. Check entitlement before job creation and disclose expected billable usage. Grace periods and upgrades must never make already stored client documents inaccessible without an export path. Suspension disables new billable actions but permits authorized data export within policy.

## 10. Examples and edge cases

| Event | Decision |
| --- | --- |
| Court source reports a new date different from a manually confirmed date | Preserve both; show discrepancy and source time; require confirmation before sensitive notice. |
| Same PDF uploaded twice | Deduplicate storage by hash within security boundary, retain separate matter/version metadata if intentionally attached twice. |
| AI answer lacks a passage supporting one sentence | Suppress that sentence or mark answer incomplete; do not fabricate a citation. |
| A case citation is later overruled | Add evidence-backed treatment edge and notify only saved research/matters where enabled after review. |
| Provider webhook repeats | Consume once by provider event ID and reconcile state; keep duplicate receipt in operational logs. |
| Client access is revoked during a download | New URL requests fail; short-lived already-issued URLs expire quickly. |
