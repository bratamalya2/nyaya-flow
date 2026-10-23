# NyayaFlow — Next Release Product Requirements Update

**Document:** PRD_Update.md  
**Product:** NyayaFlow  
**Release:** Next Release — Litigation Operations and Commercial Foundations  
**Status:** Proposed  
**Version:** 1.0  
**Date:** 20 October 2026  
**Audience:** Product, engineering, design, legal-domain reviewers, operations, and pilot customers

---

## 1. Purpose

This document defines the complete scope for NyayaFlow’s next release after the current MVP foundation. It converts the previously identified priorities into an implementable product increment:

1. Litigation Command Centre
2. Case Chronology Builder
3. Deadline and Limitation Engine
4. Conflict-Check Engine
5. Hearing Preparation Workspace
6. Tiered plans, entitlements, and subscription billing
7. Razorpay payment integration

The release must build on the existing secure core: Next.js, self-hosted PostgreSQL, PostgreSQL row-level security, private filesystem document storage, background jobs, immutable audit events, mandatory TOTP MFA, and India-hosted deployment.

This release is intended to make NyayaFlow useful every day for advocates and legal teams while creating the commercial foundation for paid plans. It does not attempt to deliver every feature in the original broad specification.

## 2. Product context

The current NyayaFlow product already provides the foundations for:

- Organizations, memberships, roles, matter-level grants, and restricted matters.
- Matter records, parties, forum identifiers, hearings, tasks, and manual source states.
- Private document storage, immutable document versions, malware scanning, OCR, corrections, and search.
- Provenance, freshness, audit logging, retention controls, legal holds, and data-request workflows.
- Research-beta boundaries for passage-linked legal research and a future Neo4j citation graph.
- Planned client communication, billing, contracts, filing checks, and external connectors.

The next release should improve the daily operational loop before expanding into more automated court coverage or autonomous legal drafting.

## 3. Release vision

When an advocate signs in, NyayaFlow should answer five questions immediately:

1. What requires attention today?
2. Which hearing, filing, limitation, or client deadline is at risk?
3. What is the complete chronology of the matter?
4. Are there conflicts or restrictions before this matter is accepted or shared?
5. What must be prepared before the next hearing?

For the firm owner, NyayaFlow should additionally answer:

1. Which plan is active and what usage is available?
2. Which subscription and payment events are settled, pending, failed, or refunded?
3. Which users, matters, storage, OCR, and operational features are covered by the plan?

## 4. Objectives and measurable outcomes

### 4.1 Product objectives

- Reduce time spent preparing for a hearing.
- Reduce missed deadlines and unassigned operational actions.
- Provide a reliable, reviewable chronology from matter records and documents.
- Detect conflicts before a matter is accepted or shared.
- Make all high-impact suggestions explainable and human-reviewable.
- Enable firms to start, upgrade, renew, pause, and cancel paid plans securely.
- Ensure payment status is derived from verified server-side events, not browser claims.

### 4.2 Proposed pilot targets

| Outcome | Target |
| --- | --- |
| Daily-board adoption | 70% of activated pilot staff use the Command Centre weekly |
| Hearing preparation | 50% reduction in time required to assemble a basic hearing brief in sampled matters |
| Deadline visibility | 100% of seeded limitation/deadline scenarios appear in the correct risk bucket |
| Conflict detection | 100% of seeded exact-match conflicts are surfaced before matter acceptance |
| Chronology provenance | 95% of sampled generated events link to a source record or are clearly marked manual |
| Billing reliability | 100% of verified Razorpay webhook events are idempotently reflected in subscription state |
| Security | Zero known cross-tenant, cross-matter, or payment-secret exposure defects |
| Payment reconciliation | 100% of successful test payments reconcile to an organization and invoice |

Targets are planning assumptions and should be baselined during pilot discovery.

## 5. Personas and permissions

### 5.1 Existing personas

- **Owner / managing partner:** Controls organization settings, plans, payment methods, invoices, and all matters subject to policy.
- **Advocate / senior counsel:** Reviews hearings, chronology, deadlines, conflicts, and hearing briefs; may approve operational actions.
- **Associate:** Works on assigned matters, updates chronology items, prepares briefs, and completes tasks within grants.
- **Paralegal / clerk:** Adds documents, dates, tasks, and source observations; cannot approve sensitive external communication unless granted.
- **Finance user:** Views subscription, invoices, payment status, and firm billing data without automatically receiving access to restricted matter contents.
- **Admin:** Manages users and configured operational settings according to existing role policy; cannot bypass matter RLS.
- **Client:** No access to this release’s internal command centre. Existing client-portal scope remains an expansion feature.

### 5.2 New permission concepts

The release adds the following permission checks without weakening existing role or matter grants:

| Permission | Purpose |
| --- | --- |
| `view_command_centre` | View only items the user can already access |
| `manage_deadlines` | Create, edit, confirm, dismiss, or reopen deadlines |
| `review_chronology` | Approve, reject, merge, or correct chronology events |
| `run_conflict_check` | Search permitted current and historical parties/entities |
| `approve_hearing_brief` | Mark a hearing brief ready for use or sharing |
| `manage_billing` | View plans, invoices, payment status, and billing settings |
| `manage_subscription` | Start, upgrade, downgrade, pause, or cancel the organization plan |

Permissions must be evaluated server-side and recorded in the audit log for consequential actions.

## 6. Release scope

### 6.1 In scope

- Prioritized Litigation Command Centre.
- Matter-level command-centre views and filters.
- Case chronology generated from structured matter records and reviewed document events.
- Manual and rule-based deadline creation, calculation, reminders, and escalation.
- Limitation/deadline calculation worksheets with assumptions and source references.
- Conflict checking across parties, aliases, entities, related parties, advocates, and historical matters visible to the checker.
- Conflict result review, dismissal with reason, and acceptance hold.
- Hearing preparation workspace with a structured brief, source links, checklist, and approvals.
- Plan catalog, feature entitlements, usage counters, trial state, invoices, and organization billing settings.
- Razorpay checkout/payment integration for one-time plan activation and recurring subscription plans where enabled for the account.
- Verified Razorpay webhooks, payment reconciliation, failed-payment handling, refunds, and audit events.
- Upgrade/downgrade/cancellation flows with clear effective dates.
- Admin and finance views for subscription and invoice status.
- Documentation, migration, support runbooks, metrics, and restore/reconciliation tests.

### 6.2 Explicitly out of scope for this release

- Nationwide automatic cause-list ingestion.
- Guaranteed real-time court item-number estimates.
- Automatic legal opinions or autonomous filing decisions.
- Automatic limitation conclusions without user-confirmed facts.
- Automatic acceptance of a matter despite an unresolved conflict.
- Private matter data being inserted into the shared public-law Neo4j graph.
- Native USB DSC browser integration for every token vendor.
- State-wide exact stamp-duty automation.
- Client portal expansion beyond existing foundations.
- External counsel marketplace.
- Full contract lifecycle management.
- Automatic collection of payment from clients for legal fees; this release covers NyayaFlow organization subscriptions.
- Automatic tax advice. GST fields and invoice presentation must be reviewed with the firm’s accountant.

## 7. Core user journeys

### 7.1 Morning Command Centre

1. User signs in with password and TOTP MFA.
2. NyayaFlow resolves the active organization and permitted matters through existing RLS policies.
3. Command Centre displays today’s hearings, overdue tasks, upcoming deadlines, unresolved conflicts, incomplete chronology reviews, and hearing briefs requiring attention.
4. User filters by advocate, matter, court/forum, urgency, status, and date range.
5. User opens an item in its matter context without losing the operational queue.
6. User completes, assigns, snoozes, dismisses, or escalates the item according to permission.
7. Every consequential action records actor, time, reason, previous state, new state, and source where applicable.

### 7.2 Build a chronology

1. User selects a matter and opens Chronology.
2. NyayaFlow displays structured events from hearings, tasks, document metadata, orders, notices, and manually entered events.
3. The system may propose events from OCR or approved extraction jobs, but proposed events are visibly unverified.
4. User reviews the event, opens the source page or record, and confirms, edits, rejects, or merges it.
5. A confirmed event becomes part of the matter chronology with its source locator and reviewer.
6. Conflicting dates remain visible as separate observations until resolved; the system never silently overwrites a confirmed manual fact.
7. User exports or attaches a reviewed chronology to a hearing brief, subject to export permission.

### 7.3 Create and review a deadline

1. User selects a matter and chooses a deadline type.
2. User enters the triggering event, relevant date, jurisdiction/forum, excluded days or assumptions, and source.
3. NyayaFlow calculates a proposed due date and displays the calculation worksheet.
4. The user confirms facts and accepts, edits, or marks the calculation for manual review.
5. The deadline receives a status, owner, reminder schedule, and risk level.
6. Changes to the triggering date, rule, due date, or owner require a reason and create a revision.
7. Reminders appear in the Command Centre and may be sent through enabled firm channels after consent and notification policy checks.

### 7.4 Run a conflict check

1. User starts a conflict check during intake or from an existing matter.
2. User enters proposed client, opposing parties, related entities, directors, aliases, and known representatives.
3. NyayaFlow searches permitted active and historical matter data using exact and normalized matching.
4. Results are grouped as exact, strong, possible, or no apparent match.
5. The user opens the permitted match context, records a review decision, and optionally requests senior review.
6. An unresolved high-confidence conflict blocks matter acceptance by default.
7. A dismissal requires a reason and can optionally expire or require re-review.

### 7.5 Prepare for a hearing

1. User opens a hearing and selects “Prepare brief.”
2. NyayaFlow creates a draft brief from the matter record, chronology, prior hearings, approved documents, open tasks, and saved research notes.
3. The brief shows source links beside every generated or imported section.
4. User adds issues, questions, authorities, documents, witnesses, instructions, and hearing-specific notes.
5. System runs completeness checks for missing prior orders, unresolved deadlines, unreviewed chronology items, and absent required documents.
6. User or authorized reviewer approves the brief for internal use or controlled sharing.
7. The approved brief points to immutable document versions and records an approval event.

### 7.6 Start a paid plan

1. Organization owner opens Plans and Billing.
2. User compares plan limits, included features, billing interval, tax presentation, and effective price.
3. User selects monthly or annual billing and is sent to Razorpay Checkout or the configured Razorpay subscription flow.
4. NyayaFlow creates a pending checkout or subscription record before redirecting.
5. Razorpay returns the user to NyayaFlow, but the client response is treated only as a correlation signal.
6. Server-side signature verification and/or a verified webhook changes the payment state.
7. The organization entitlement becomes active only after the configured activation event is verified.
8. Invoice and receipt details are stored and made available to the billing user.

### 7.7 Upgrade, downgrade, or cancel

1. Owner views the current plan, usage, renewal date, and change impact.
2. Upgrade may take effect immediately after successful payment, with any credit/proration policy shown before confirmation.
3. Downgrade normally takes effect at the end of the current paid period to avoid unexpectedly removing access.
4. Cancellation stops future renewal but preserves access until the paid-through date, subject to payment provider state and contractual terms.
5. Subscription changes are written to an immutable subscription event history.
6. The organization receives a clear export and data-retention notice before any suspension or deletion action.

## 8. Functional requirements

### 8.1 Litigation Command Centre

- **NXR-FR-001:** The system shall display a tenant-scoped daily Command Centre for the signed-in user.
- **NXR-FR-002:** The board shall include hearings, tasks, deadlines, conflict reviews, chronology reviews, and hearing briefs relevant to the user’s permissions.
- **NXR-FR-003:** The board shall support Today, Next 7 Days, Overdue, and Custom Date Range views.
- **NXR-FR-004:** Users shall filter by matter, assignee, advocate, forum, priority, status, and source state.
- **NXR-FR-005:** The board shall visually distinguish verified, manual, proposed, stale, blocked, and overdue items.
- **NXR-FR-006:** Users shall complete, reassign, snooze, reopen, or escalate supported items without bypassing permissions.
- **NXR-FR-007:** Restricted matters shall not expose titles, parties, amounts, or document details to unauthorized users through counts, search, filters, exports, notifications, or browser payloads.
- **NXR-FR-008:** The board shall show a source timestamp and freshness state when an item originated from an external or imported source.
- **NXR-FR-009:** The board shall provide a persistent link back to the matter, source record, and activity history.
- **NXR-FR-010:** Empty, failed, stale, and partially available states shall explain what the user can do next.

### 8.2 Case Chronology Builder

- **NXR-FR-011:** The system shall create chronology events from hearings, tasks, document metadata, source records, and manual input.
- **NXR-FR-012:** Each event shall contain event date or date range, event type, title, description, source state, source reference, confidence, creator, and review state.
- **NXR-FR-013:** The system shall support exact dates, approximate dates, date ranges, and unknown dates without inventing precision.
- **NXR-FR-014:** Proposed extraction events shall remain separate from confirmed chronology events until an authorized review occurs.
- **NXR-FR-015:** Users shall confirm, edit, reject, merge, split, or mark an event as unresolved.
- **NXR-FR-016:** The system shall preserve the original proposed value and every later correction in revision history.
- **NXR-FR-017:** Conflicting event observations shall remain traceable to their sources.
- **NXR-FR-018:** Chronology search shall support event type, date range, source, reviewer, and keyword.
- **NXR-FR-019:** A reviewed chronology shall be exportable to a print-ready or document format only for users with export permission.
- **NXR-FR-020:** Exported chronology shall include a generated-at timestamp, matter identifier, review state, source references, and disclaimer where events remain unresolved.

### 8.3 Deadline and Limitation Engine

- **NXR-FR-021:** The system shall support manually created deadlines and rule-based proposed deadlines.
- **NXR-FR-022:** Deadline types shall be configurable by organization and may include hearing preparation, filing, reply, compliance, notice response, limitation, appeal, renewal, and internal review.
- **NXR-FR-023:** Each deadline shall record trigger date, rule or source, jurisdiction/forum, calculation version, assumptions, excluded days, due date, owner, reminder schedule, and review state.
- **NXR-FR-024:** The system shall show a human-readable calculation worksheet before a calculated date is confirmed.
- **NXR-FR-025:** The system shall support `proposed`, `confirmed`, `manual_review`, `completed`, `waived`, `cancelled`, and `superseded` states.
- **NXR-FR-026:** The system shall mark a deadline `manual_review` when required facts, rule coverage, holidays, service date, or jurisdiction are uncertain.
- **NXR-FR-027:** The system shall never represent a calculated date as legal advice or guaranteed registry acceptance.
- **NXR-FR-028:** Changes to a confirmed deadline’s trigger, rule, due date, owner, or status shall require a reason and revision record.
- **NXR-FR-029:** Reminder jobs shall be idempotent and shall not send a notification unless recipient, channel, consent, and firm policy checks pass.
- **NXR-FR-030:** Deadline calculations shall be versioned so a future rule update does not silently change an existing confirmed deadline.
- **NXR-FR-031:** Users shall be able to override a calculated date with a manual date while preserving the calculated proposal and override reason.

### 8.4 Conflict-Check Engine

- **NXR-FR-032:** The system shall run a conflict check against permitted current, closed, archived, and historical matters according to organization policy.
- **NXR-FR-033:** Users shall enter people, entities, aliases, directors, beneficial owners where applicable, opposing parties, and representatives.
- **NXR-FR-034:** Matching shall normalize case, punctuation, spacing, common legal suffixes, and configured transliteration variants without replacing the original values.
- **NXR-FR-035:** Results shall be grouped by match confidence and display why a result was returned.
- **NXR-FR-036:** A result shall reveal only the minimum permitted context and shall require additional matter permission for deeper access.
- **NXR-FR-037:** Exact and high-confidence unresolved conflicts shall block acceptance of a matter by default.
- **NXR-FR-038:** An authorized reviewer shall be able to dismiss a result with a required reason and optional expiration/review date.
- **NXR-FR-039:** The system shall support conflict-check decisions of `open`, `cleared`, `cleared_with_conditions`, `escalated`, and `blocked`.
- **NXR-FR-040:** Conflict checks shall be rerunnable when a party, related entity, or matter scope changes.
- **NXR-FR-041:** Every search, result view, decision, dismissal, and override shall be audited.

### 8.5 Hearing Preparation Workspace

- **NXR-FR-042:** Users shall create a hearing brief from a scheduled hearing or matter.
- **NXR-FR-043:** The workspace shall include hearing details, matter summary, chronology, prior orders, pending tasks, issues, authorities, documents, witnesses, questions, instructions, and notes.
- **NXR-FR-044:** Generated content shall be labelled as draft and shall link to supporting source records or document locations.
- **NXR-FR-045:** Users shall add, reorder, remove, and annotate sections without changing source documents.
- **NXR-FR-046:** The system shall identify unresolved chronology events, missing sources, overdue tasks, unreviewed documents, and open conflicts as preparation warnings.
- **NXR-FR-047:** A brief shall support `draft`, `in_review`, `approved`, `archived`, and `superseded` states.
- **NXR-FR-048:** Approval shall capture reviewer, timestamp, selected version, and approval scope.
- **NXR-FR-049:** Sharing an approved brief shall require a new audience review and shall not automatically share every linked matter document.
- **NXR-FR-050:** A brief shall remain linked to immutable document versions; later document versions shall not silently alter an approved brief.

### 8.6 Plans, entitlements, and billing

- **NXR-FR-051:** The system shall maintain a versioned plan catalog with plan code, display name, billing interval, price, currency, tax treatment, included limits, feature flags, and active dates.
- **NXR-FR-052:** Each organization shall have at most one active base plan, plus explicitly configured add-ons if enabled later.
- **NXR-FR-053:** The system shall track trial, active, past_due, paused, cancelled, expired, suspended, and payment_pending states.
- **NXR-FR-054:** Feature access shall be checked server-side before billable or restricted actions.
- **NXR-FR-055:** Usage counters shall be organization-scoped and shall distinguish current usage, included quota, reserved usage, and billable usage where applicable.
- **NXR-FR-056:** Plan enforcement shall not make already stored client documents inaccessible without an export path and policy-compliant notice.
- **NXR-FR-057:** The billing page shall show current plan, seats, storage, OCR usage, research usage if applicable, renewal date, payment status, invoices, and upgrade options.
- **NXR-FR-058:** Finance users shall not receive matter access solely because they can view subscription or invoice records.
- **NXR-FR-059:** Issued invoices shall be immutable; corrections shall use credit notes, adjustments, or replacement invoices according to configured accounting policy.
- **NXR-FR-060:** Subscription changes shall preserve a complete event history with actor, provider event, prior state, new state, and effective date.

### 8.7 Razorpay integration

- **NXR-FR-061:** Razorpay credentials and signing secrets shall be stored only as server-side secrets and shall never be sent to the browser.
- **NXR-FR-062:** The server shall create an internal checkout or subscription attempt before invoking Razorpay.
- **NXR-FR-063:** The system shall associate every Razorpay order, payment, subscription, invoice, refund, and webhook event with an organization and internal billing record.
- **NXR-FR-064:** Browser callbacks shall not by themselves activate a plan; activation shall require successful signature verification and/or a verified provider webhook according to the configured flow.
- **NXR-FR-065:** Webhook signatures shall be verified using the configured Razorpay webhook secret before processing.
- **NXR-FR-066:** Webhook processing shall be idempotent by provider event identifier and shall safely handle duplicate, delayed, and out-of-order events.
- **NXR-FR-067:** The system shall record the raw provider event metadata needed for reconciliation while minimizing payment and personal data retention.
- **NXR-FR-068:** Payment success shall activate entitlements only for the intended organization, plan, interval, and billing period.
- **NXR-FR-069:** Failed, expired, cancelled, refunded, and disputed payments shall update billing state without deleting historical invoices or audit events.
- **NXR-FR-070:** The system shall provide a manual reconciliation view for authorized finance users.
- **NXR-FR-071:** The system shall support refund records and shall not treat a refund as a silent deletion of the original payment.
- **NXR-FR-072:** The system shall display the payment provider, invoice number, payment date, amount, currency, tax fields, status, and receipt reference where available.
- **NXR-FR-073:** Provider outages shall leave the organization in a safe pending state and provide a retry or support path.

## 9. Proposed tiered pricing and features

The following is a proposed India launch model. Prices are planning proposals and require validation with pilot firms, payment-provider capabilities, GST treatment, infrastructure cost, and support cost. Unless explicitly stated otherwise, prices are exclusive of applicable taxes.

### 9.1 Plan summary

| Plan | Proposed price | Intended customer |
| --- | ---: | --- |
| **Free Trial** | ₹0 for 14 days | Evaluation by a firm or solo advocate |
| **Solo** | ₹1,499/month or ₹14,990/year | Individual advocate or very small practice |
| **Firm** | ₹4,999/month or ₹49,990/year | Small firm, up to 5 seats |
| **Professional** | ₹11,999/month or ₹119,990/year | Growing firm, up to 15 seats |
| **Enterprise** | Custom annual pricing | Large firm, corporate legal team, or special deployment |

Annual pricing represents an approximate discount and must be configured as an explicit plan price rather than calculated silently at checkout.

### 9.2 Feature matrix

| Capability | Free Trial | Solo | Firm | Professional | Enterprise |
| --- | --- | --- | --- | --- | --- |
| Seats | 2 | 1 | 5 | 15 | Custom |
| Active matters | 10 | 100 | Unlimited | Unlimited | Unlimited |
| Document storage | 1 GB | 25 GB | 100 GB | 500 GB | Custom |
| MFA and audit | Included | Included | Included | Included | Included |
| Matter-level permissions | Basic | Included | Advanced | Advanced | Custom policies |
| Command Centre | Included | Included | Included | Included | Included |
| Chronology Builder | 3 matters | Included | Included | Included | Included |
| Deadline engine | Basic | Included | Included | Advanced rules | Custom rules |
| Conflict checks | 5 checks | 25/month | Unlimited | Unlimited + history | Enterprise review workflow |
| Hearing workspaces | 3 | Included | Included | Included | Included |
| OCR | 100 pages | 2,000 pages/month | 10,000 pages/month | 50,000 pages/month | Custom |
| Court connectors | Manual sources | Manual sources | Configured pilots | Approved connectors | Custom coverage |
| Research beta | Not included | Optional/limited | Included where enabled | Higher allowance | Custom |
| Client portal | Not included | Not included | Basic | Included | White-labelled |
| Billing and invoices | Not included | Organization subscription | Organization subscription | Organization subscription | Custom billing |
| Analytics | Basic usage | Basic | Firm operations | Advanced | Custom exports |
| Support | Self-service | Email | Priority email | Priority support | SLA |
| Data export | Available | Available | Available | Available | Assisted export |

### 9.3 Plan enforcement rules

- A trial shall have a clear expiry date, usage limits, and upgrade path.
- Limits shall be visible before an action is blocked.
- The system shall not silently delete or hide existing documents when a plan is downgraded.
- New matter creation, new uploads, OCR jobs, additional seats, and research usage may be blocked or placed in a pending state when a quota is exceeded.
- Existing authorized users shall retain read/export access during a grace period after payment failure, subject to the organization’s contract and security policy.
- Enterprise limits, deployment options, SSO, dedicated support, and data-retention arrangements shall be configured per contract rather than hard-coded into the public plan table.
- A plan catalog change shall not retroactively alter an existing subscription’s price or included features without a versioned change and required notice.

### 9.4 Optional future add-ons

These should not block the release but the entitlement model should allow them later:

- Additional storage packs.
- Additional OCR page packs.
- Additional seats.
- Premium research corpus access.
- Additional court connectors.
- White-labelled client portal.
- Dedicated India-hosted deployment or private network deployment.

## 10. Razorpay payment design

### 10.1 Payment boundary

Razorpay is an external payment provider, not the source of truth for NyayaFlow’s authorization model. PostgreSQL remains the canonical source for organization plan, entitlement, invoice, and subscription state. Razorpay identifiers and verified events are stored as provider references.

The integration must be isolated behind a `PaymentProvider` adapter so Razorpay can later be replaced or supplemented without changing entitlement logic.

```text
NyayaFlow checkout
        ↓
Internal billing attempt
        ↓
Razorpay order or subscription
        ↓
Checkout / recurring payment
        ↓
Verified callback and webhook
        ↓
Payment reconciliation
        ↓
Subscription state and entitlements
```

### 10.2 Supported payment scenarios

#### Initial activation

- Monthly or annual plan selection.
- Razorpay order or subscription creation.
- Checkout completion.
- Signature/webhook verification.
- Entitlement activation for the selected period.
- Invoice and receipt availability.

#### Upgrade

- Display current and new plan.
- Display effective date and any configured credit/proration treatment.
- Collect payment through Razorpay.
- Activate the new plan only after verified success.
- Preserve the previous subscription event and invoice history.

#### Downgrade

- Schedule downgrade for the end of the paid period by default.
- Show which limits and features will change.
- Preserve current access until the effective date unless the user explicitly requests immediate change and policy permits it.

#### Renewal

- Process provider renewal event.
- Extend the billing period only after verified payment state.
- Create or link the provider invoice and internal invoice.
- Notify the owner/finance user according to organization preferences.

#### Failed payment

- Mark the subscription `past_due` or `payment_pending` according to provider state.
- Retry only through supported provider mechanisms; do not create duplicate subscriptions.
- Show a clear payment-update path.
- Apply a configured grace period.
- Restrict new billable actions after grace expiry while preserving export and policy-approved read access.

#### Cancellation and refund

- Record cancellation request, requested date, effective date, reason, and actor.
- Stop future renewal where supported.
- Record refunds as separate financial events linked to the original payment.
- Do not delete invoices, receipts, provider events, or audit events.

### 10.3 Internal billing records

The implementation should introduce or extend these PostgreSQL entities:

| Entity | Purpose |
| --- | --- |
| `plan_catalog` | Versioned plan and price definitions |
| `plan_prices` | Monthly/annual price, currency, tax metadata, provider plan reference |
| `organization_subscriptions` | Current and historical organization subscription periods |
| `entitlements` | Effective feature and quota values for an organization |
| `usage_counters` | Metered usage by organization and period |
| `billing_customers` | Internal organization-to-provider customer mapping |
| `billing_attempts` | Checkout/order/subscription initiation state |
| `payment_transactions` | Payment, refund, dispute, and settlement references |
| `billing_invoices` | Immutable internal invoice snapshots |
| `provider_events` | Verified/idempotent Razorpay webhook event records |
| `subscription_events` | Append-only changes to subscription status and plan |
| `billing_adjustments` | Credits, refunds, manual corrections, or approved discounts |

All organization-owned rows must carry `organization_id` and follow existing RLS rules. Provider webhook intake may first write to a narrowly scoped non-tenant staging record, then resolve and link the event inside a transaction.

### 10.4 Razorpay configuration

Required server-side configuration should include:

- Razorpay key identifier for checkout initialization.
- Razorpay key secret for server-side API requests.
- Razorpay webhook secret.
- Environment-specific API base configuration.
- Configured provider plan IDs for monthly and annual plan prices where recurring subscriptions are enabled.
- Webhook endpoint and event allowlist.
- Currency configuration, initially INR.
- Payment timeout and retry policy.

Secrets must be stored outside source control, rotated through an operational procedure, and redacted from logs. Test and production credentials must never be mixed.

### 10.5 Webhook processing rules

1. Receive the provider request over HTTPS.
2. Verify the Razorpay webhook signature using the configured secret.
3. Reject invalid signatures without mutating subscription or entitlement state.
4. Check provider event identifier for prior processing.
5. Store the verified event and checksum/idempotency key.
6. Resolve the organization and internal billing record.
7. Apply a transaction-safe state transition.
8. Write an audit event and outbox event.
9. Return a success response only after durable acceptance.
10. Send asynchronous notifications or reconciliation jobs from the outbox.

Duplicate events must be harmless. Out-of-order events must not regress a subscription from a newer verified state to an older state without an explicit reconciliation rule.

### 10.6 Payment security requirements

- Do not store card numbers, CVV, UPI PINs, or other payment credentials.
- Use Razorpay-hosted or provider-controlled checkout components where possible.
- Do not trust amount, plan, organization, or currency values supplied by the browser.
- Recalculate the payable amount from the server-side plan catalog.
- Use idempotency keys for internal billing attempts and provider calls where supported.
- Log provider IDs and correlation IDs, not secrets or sensitive payment payloads.
- Restrict billing administration to authorized roles and audit all changes.
- Verify refund and cancellation permissions server-side.
- Maintain a manual reconciliation process for webhook outages, disputed payments, and provider mismatches.

## 11. Data model and architecture changes

### 11.1 Command Centre data

The Command Centre should be a read model or query layer over existing tables plus indexed operational fields. It should not duplicate private matter data unnecessarily. Recommended fields include:

- `priority`
- `operational_status`
- `next_action_at`
- `source_state`
- `source_checked_at`
- `assigned_user_id`
- `risk_bucket`
- `last_reviewed_at`

Use a PostgreSQL view or server-side query that applies RLS before aggregation. Do not create unauthorized counts from broad unfiltered tables.

### 11.2 Chronology data

Recommended tables:

- `chronology_events`
- `chronology_event_sources`
- `chronology_event_revisions`
- `chronology_review_actions`

A chronology event may reference a hearing, task, document version, OCR page, source record, or manual note. Source references should include stable IDs, page/paragraph locators where available, extraction version, and review state.

### 11.3 Deadline data

Recommended tables:

- `deadline_rules`
- `deadline_rule_versions`
- `matter_deadlines`
- `deadline_calculations`
- `deadline_reminders`
- `deadline_revisions`

Rules should be editioned by effective date and jurisdiction. A confirmed deadline should retain the exact rule version and assumptions used at confirmation time.

### 11.4 Conflict data

Recommended tables:

- `conflict_checks`
- `conflict_check_subjects`
- `conflict_matches`
- `conflict_decisions`
- `conflict_aliases`

Conflict search indexes must use normalized values while retaining original text. Access to a match should be checked again when the user opens context.

### 11.5 Hearing brief data

Recommended tables:

- `hearing_briefs`
- `hearing_brief_sections`
- `hearing_brief_sources`
- `hearing_brief_checklist_items`
- `hearing_brief_approvals`

Approved briefs should snapshot the selected source versions and generated text. Later edits should create a new brief version rather than mutate an approved version.

### 11.6 Billing and entitlement data

Billing tables should be separate from matter and client-ledger tables. Subscription billing for NyayaFlow is a firm-level commercial function and must not be confused with client retainers or legal-fee accounting.

The worker should process:

- OCR and chronology extraction jobs.
- Deadline reminder jobs.
- Conflict index refresh jobs.
- Invoice and receipt generation.
- Razorpay webhook reconciliation.
- Subscription renewal checks.
- Usage counter rollups.
- Payment failure notifications.

## 12. API requirements

Illustrative routes under `/api/v1`:

### Command Centre

- `GET /command-centre`
- `GET /command-centre/summary`
- `POST /command-centre/items/:id/complete`
- `POST /command-centre/items/:id/snooze`
- `POST /command-centre/items/:id/escalate`

### Chronology

- `GET /matters/:matterId/chronology`
- `POST /matters/:matterId/chronology/events`
- `POST /chronology/events/:eventId/confirm`
- `POST /chronology/events/:eventId/reject`
- `POST /chronology/events/:eventId/merge`
- `GET /chronology/events/:eventId/sources`
- `POST /matters/:matterId/chronology/export`

### Deadlines

- `GET /matters/:matterId/deadlines`
- `POST /matters/:matterId/deadlines/calculate`
- `POST /matters/:matterId/deadlines`
- `PATCH /deadlines/:deadlineId`
- `POST /deadlines/:deadlineId/complete`
- `POST /deadlines/:deadlineId/waive`
- `GET /deadline-rules`

### Conflicts

- `POST /conflict-checks`
- `GET /conflict-checks/:checkId`
- `POST /conflict-checks/:checkId/review`
- `POST /conflict-matches/:matchId/dismiss`
- `POST /conflict-checks/:checkId/escalate`

### Hearing preparation

- `POST /hearings/:hearingId/briefs`
- `GET /hearing-briefs/:briefId`
- `PATCH /hearing-briefs/:briefId`
- `POST /hearing-briefs/:briefId/checklist`
- `POST /hearing-briefs/:briefId/submit-review`
- `POST /hearing-briefs/:briefId/approve`
- `POST /hearing-briefs/:briefId/export`

### Plans and billing

- `GET /billing/plans`
- `GET /organizations/:organizationId/billing`
- `POST /billing/checkout`
- `POST /billing/subscriptions`
- `POST /billing/subscriptions/:subscriptionId/upgrade`
- `POST /billing/subscriptions/:subscriptionId/downgrade`
- `POST /billing/subscriptions/:subscriptionId/cancel`
- `GET /billing/invoices`
- `GET /billing/invoices/:invoiceId`
- `POST /billing/refunds`
- `POST /billing/reconcile`
- `POST /webhooks/razorpay`

All mutating endpoints must use the existing session, CSRF/cross-origin, zod validation, role, organization, matter-grant, RLS, rate-limit, audit, and correlation-ID wrappers.

## 13. User interface requirements

### 13.1 Command Centre

- Desktop-first responsive layout with usable mobile view.
- Summary cards for hearings, overdue items, deadlines, conflicts, and preparation status.
- Queue view with urgency, owner, matter, source state, and next action.
- No ambiguous red/green-only status; include text labels and accessible icons.
- Keyboard navigation for high-frequency actions.
- Saved filters for advocates and managers.

### 13.2 Chronology

- Vertical timeline and table view.
- Clear separation between proposed, confirmed, disputed, and manual events.
- Source preview beside the event.
- Review actions that do not destroy the original extraction.
- Export preview before download.

### 13.3 Deadlines

- Calendar and list views.
- Calculation worksheet with editable assumptions.
- Risk buckets: overdue, due today, due soon, scheduled, manual review, and completed.
- Clear distinction between a system calculation and a lawyer-confirmed deadline.

### 13.4 Conflict checks

- Intake form with repeated-party suggestions.
- Match confidence and explanation.
- Restricted-context placeholder when the user lacks deeper matter access.
- Mandatory reason for dismissal or override.

### 13.5 Hearing workspace

- Matter context always visible.
- Sections can be collapsed, reordered, and individually sourced.
- Preparation checklist with owners and due dates.
- Approval banner showing version and reviewer.
- Sharing dialog that defaults to least privilege.

### 13.6 Plans and billing

- Feature comparison with included limits.
- Price, interval, tax note, renewal date, and effective date shown before payment.
- No dark patterns around renewal or cancellation.
- Payment state labels: pending, paid, failed, past due, refunded, cancelled, and under review.
- Downloadable invoices and receipts.
- Clear support path for payment mismatch.

## 14. AI and automation boundaries

AI may assist with:

- Proposing chronology events from approved matter documents.
- Summarizing source-linked matter information.
- Drafting a hearing brief from selected sources.
- Suggesting duplicate or related party names.
- Classifying operational urgency.

AI must not:

- Create an untraceable chronology fact.
- Confirm a deadline without user review.
- Clear a conflict automatically.
- Present a legal conclusion as authoritative advice.
- Use internal, privileged, or restricted data with an external provider unless the organization’s data-classification policy explicitly permits it.
- Generate a payment or entitlement decision.

Every AI-assisted output must show draft status, source coverage, uncertainty, model/configuration version where applicable, and a human review action.

## 15. Security, privacy, and compliance requirements

- Existing mandatory TOTP MFA remains required for staff.
- Existing PostgreSQL RLS remains the final tenant and matter visibility boundary.
- Billing access must not grant matter access.
- Razorpay secrets must be server-only and redacted from logs.
- Webhook verification must happen before state mutation.
- Payment data minimization must be applied; NyayaFlow must not store card credentials.
- Every plan change, payment state change, refund, manual reconciliation, conflict decision, deadline override, chronology confirmation, and brief approval must be auditable.
- Billing exports must exclude restricted matter content unless the export permission explicitly covers it.
- Data retention and deletion workflows must consider invoices, payment evidence, audit requirements, legal holds, and applicable tax/accounting obligations.
- Data processor, payment provider, messaging provider, AI provider, and hosting geography must remain documented for any India-only deployment claim.
- Product copy must state that deadline calculations, source summaries, and AI assistance require professional review.

## 16. Notifications

The release may support in-app notifications first. Email, WhatsApp, and SMS remain subject to provider setup, consent, cost, and policy.

Notification categories:

- Hearing approaching.
- Deadline due soon or overdue.
- Conflict review required.
- Chronology review required.
- Hearing brief awaiting approval.
- Payment succeeded.
- Payment failed or subscription past due.
- Renewal approaching.
- Plan limit reached or nearing limit.

All notifications require event deduplication, recipient verification, channel preference checks, and a source link. Payment notifications must not expose matter details.

## 17. Reporting and analytics

### Operational metrics

- Matters with hearings today.
- Overdue tasks and deadlines by owner.
- Unresolved conflict checks.
- Chronology events pending review.
- Hearing briefs created, approved, and used.
- Average time from hearing creation to brief approval.
- Deadline override and manual-review rate.

### Commercial metrics

- Trial starts and activation rate.
- Trial-to-paid conversion.
- Plan distribution.
- Monthly recurring revenue and annual recurring revenue.
- Churn and cancellation reasons.
- Payment success and failure rate.
- Refund and dispute rate.
- Average revenue per organization.
- Usage against included quotas.

Commercial analytics must be organization-aggregated and must not reveal restricted matter details.

## 18. Acceptance criteria

### 18.1 Command Centre

- A seeded organization with hearings, tasks, deadlines, conflicts, and briefs sees the correct permitted items.
- Unauthorized restricted-matter details do not appear in totals, filters, APIs, exports, or notifications.
- Completing or snoozing an item updates the board and audit history.
- Duplicate reminder jobs do not create duplicate notifications.

### 18.2 Chronology

- Events from structured records appear with source references.
- Proposed OCR/AI events cannot appear as confirmed until an authorized review.
- Corrections preserve the original event and revision history.
- Conflicting dates are visible and cannot silently overwrite confirmed facts.
- Export includes review state and source references.

### 18.3 Deadline engine

- Test cases for known rules produce the expected proposed dates.
- Missing or uncertain facts result in `manual_review`.
- Confirmed dates preserve rule version and assumptions.
- Overrides require a reason and are auditable.
- Notifications respect timezone, consent, deduplication, and permissions.

### 18.4 Conflict engine

- Exact seeded matches are found before matter acceptance.
- Normalized names do not replace originals.
- High-confidence unresolved conflicts block acceptance by default.
- Dismissals require a reason and are auditable.
- Restricted result context is not exposed to unauthorized users.

### 18.5 Hearing workspace

- A brief can be created from a hearing and contains source-linked sections.
- Missing preparation inputs create visible warnings.
- Approved briefs are versioned and cannot be silently changed.
- Sharing requires audience selection and does not share all matter documents by default.

### 18.6 Plans and Razorpay

- A user cannot activate a plan by modifying browser payloads.
- Amount and plan are recalculated server-side.
- Invalid webhook signatures cause no subscription mutation.
- Duplicate webhook delivery is idempotent.
- Out-of-order events do not incorrectly regress the subscription.
- Successful test payment activates the correct organization and plan.
- Failed payment enters a safe grace/past-due state.
- Refunds preserve the original payment and invoice history.
- Downgrade and cancellation effective dates are visible and accurate.
- Payment secrets never appear in frontend bundles, logs, audit payloads, or error messages.

## 19. Rollout plan

### Phase 1 — Internal foundation

- Database migrations and RLS policies.
- Entitlement service and plan catalog.
- Billing pages with test-mode Razorpay configuration.
- Command Centre read model/query layer.
- Basic chronology and deadline data structures.
- Feature flags for every new module.

### Phase 2 — Pilot operations

- Command Centre.
- Manual chronology review.
- Manual and rule-based deadlines.
- Basic conflict checks.
- Hearing brief with manual/source-linked sections.
- Internal payment and invoice testing.

### Phase 3 — Controlled commercial launch

- Trial and paid plan activation.
- Razorpay production webhooks.
- Upgrade, cancellation, refund, and reconciliation flows.
- Firm and Professional plan enforcement.
- Usage alerts and billing support runbook.

### Phase 4 — Measured automation

- Proposed chronology extraction from OCR.
- More deadline rule versions after legal review.
- Improved party/entity normalization.
- Source-linked hearing brief assistance.
- Additional provider or court integrations only after permission and freshness validation.

## 20. Operational readiness

Before production launch:

- Complete Razorpay KYC, account, webhook, settlement, refund, and support configuration.
- Configure separate test and production credentials.
- Create an incident runbook for payment mismatch, webhook outage, duplicate event, refund dispute, and subscription regression.
- Run database and document-storage restore drills.
- Run RLS and authorization tests for each new table and endpoint.
- Test plan changes, quota enforcement, grace periods, and export access.
- Validate invoice numbering, GST presentation, and accounting treatment with the organization’s accountant.
- Complete privacy and processor review for Razorpay and any AI or messaging provider.
- Train pilot users on manual review of chronology, deadlines, conflicts, and hearing briefs.

## 21. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Incorrect limitation calculation | Versioned rules, calculation worksheet, manual-review state, lawyer confirmation |
| False conflict match | Explainable matching, confidence buckets, senior review, dismissal reason |
| AI-generated incorrect fact | Source links, proposed state, human confirmation, no silent mutation |
| Payment callback spoofing | Server-side signature verification and webhook verification |
| Duplicate or delayed webhooks | Provider event IDs, idempotency, transactional state machine, reconciliation queue |
| Accidental access after downgrade | Grace period, export path, entitlement checks, retention policy |
| Billing and matter data leakage | Separate permissions, RLS, minimized exports, redacted logs |
| Overly broad release scope | Feature flags, phased rollout, narrow pilot acceptance criteria |
| Provider outage | Pending state, retry/reconciliation tools, operational fallback |
| Unsupported legal or tax interpretation | Qualified Indian legal/accounting review before production claims |

## 22. Product decisions required before build completion

1. Confirm the first pilot forums and jurisdictions for deadline rules.
2. Confirm whether the trial is 14 or 30 days.
3. Confirm final launch prices and whether prices are displayed inclusive or exclusive of GST.
4. Confirm monthly/annual discount policy.
5. Confirm whether upgrades are immediate and whether proration is offered.
6. Confirm the grace period after failed renewal.
7. Confirm organization seat behavior and additional-seat pricing.
8. Confirm whether Razorpay recurring subscriptions are enabled at launch or whether the first release uses one-time renewal payments.
9. Confirm invoice numbering and GST fields with the accountant.
10. Confirm which AI-assisted chronology and brief-generation workflows may use external processing.
11. Confirm retention periods for invoices, payment evidence, provider events, and audit records.

## 23. Summary

This release positions NyayaFlow as a daily litigation operations platform rather than only a document and research repository. Its core promise is a traceable flow from matter data to chronology, deadline, conflict review, and hearing preparation.

The commercial layer introduces transparent plans and controlled entitlements without weakening security or data access boundaries. Razorpay is integrated as a verified payment provider, while PostgreSQL remains the canonical source for subscription, invoice, and entitlement state.

The release should launch only after operational workflows, payment reconciliation, RLS coverage, restore testing, and professional/legal review are complete. Automation may propose and prioritize; authorized legal professionals remain responsible for confirmation and final use.
