# NyayaFlow — Functional Requirements

**Status:** Draft for implementation planning · **Source:** `feature_specification.md`  
**Legend:** M = MVP; R = research beta; E = expansion; A = advanced. Application-owned authentication (Argon2id + mandatory TOTP), self-hosted PostgreSQL with row-level security, and private filesystem storage are the identity, primary database, and file platform; Neo4j holds the derived legal graph. Each requirement is subject to tenant and matter authorization unless explicitly public.

## 1. Identity, workspace, and dashboards

| ID | Phase | Requirement and acceptance condition |
| --- | --- | --- |
| FR-001 | M | Admin creates an organization, invites/removes members through single-use invitation links, and assigns app roles in PostgreSQL; unauthorized invite acceptance fails and is logged. |
| FR-002 | M | Staff signs in with MFA, can revoke sessions, and sees only organizations to which they belong. |
| FR-003 | M | Admin creates restricted matter grants for view/edit/manage/export; Postgres RLS, Storage policies, APIs, search, file access, and jobs enforce them, including direct client queries. |
| FR-004 | M | Solo and staff dashboards show today's assigned hearings, tasks, matter changes, and stale source warnings, with timezone shown. |
| FR-005 | E | Senior, partner, and in-house dashboards aggregate authorized briefs, workloads, finances, contracts, and exposure without leaking restricted data. |
| FR-006 | M | User chooses light/dark and reader mode; settings persist and text remains keyboard accessible. |

## 2. Matters, courts, and scheduling

| ID | Phase | Requirement and acceptance condition |
| --- | --- | --- |
| FR-010 | M | User creates a matter with court/forum, identifier, parties, assignees, status, and optional CNR; duplicates are flagged before save. |
| FR-011 | M | User enters hearings and deadlines manually; edits retain previous value, author, time, and reason. |
| FR-012 | M | System identifies same-advocate overlapping confirmed/proposed hearings and displays a conflict with travel/availability context; user may dismiss with reason. |
| FR-013 | E | Approved forum adapter imports case status, hearing, cause-list, and order records where available; UI displays source URL/ID, fetched time, and confidence. |
| FR-014 | E | Changes from external sources appear as proposals or verified updates according to policy; conflicting dates never silently replace confirmed data. |
| FR-015 | A | Live item tracker operates only where a permitted timely feed exists; otherwise shows unavailable, last-known source time, and no fabricated ETA. |
| FR-016 | E | Authorized advocate generates a proxy brief from selected notes/documents; delegated recipient gets scoped, expiring access and revocation. |
| FR-017 | E | Scheduled digest collects verified listings/tasks/conferences, applies recipient preferences, and sends once per day; late/stale entries are marked. |

## 3. Research and criminal-code transition

| ID | Phase | Requirement and acceptance condition |
| --- | --- | --- |
| FR-020 | R | Research search filters by jurisdiction, court, time, document type, and source rights; result opens exact source passage. |
| FR-021 | R | AI answer links each material proposition to retrievable edition, section/paragraph and source; unsupported claims are withheld or explicitly uncertain. |
| FR-022 | R | User can inspect answer provenance, save a research note, report a citation error, and export with verification status. |
| FR-023 | R | Citation graph shows directional relationships and evidence; alleged overruled/doubted status requires reviewed supporting source. |
| FR-024 | R | Bench-strength filtering applies only to judgments whose metadata is verified; unknown values remain visibly unknown. |
| FR-025 | A | Old/new provision mapping presents side-by-side text, effective dates, exceptions, sources, and version; ambiguous mapping is flagged. |
| FR-026 | A | Applicability worksheet collects relevant facts and outputs reviewable reasoning with uncertainty; never auto-approves a filing. |
| FR-027 | A | Draft converter produces tracked changes and citation report; document stays unchanged until authorized approval. |

## 4. Documents, OCR, and filing

| ID | Phase | Requirement and acceptance condition |
| --- | --- | --- |
| FR-030 | M | Authorized user uploads PDF/image to a tenant-scoped private storage path; PostgreSQL tracks quarantine, and invalid type, size, or failed malware scan prevents publication. |
| FR-031 | M | Every file version has a distinct stored object and PostgreSQL metadata preserving hash, uploader, timestamp, and access history; replacement never overwrites an approved version. |
| FR-032 | M | OCR extracts page text for pilot languages with per-page confidence; user can correct searchable text without overwriting original. |
| FR-033 | M | Search is scoped to granted matters and returns matched text/page; revoked users cannot retrieve cached snippets or file links. |
| FR-034 | A | System drafts synopsis, list of dates, annexure labels, and hyperlinked index; reviewer can reorder/edit and export a controlled package. |
| FR-035 | A | Versioned forum rule pack checks supported filing criteria and shows pass/warning/fail/manual review with rule source/effective date. |
| FR-036 | A | Signing sends the exact approved version to a supported partner/bridge, collects consent and receipt, and locks the signed version. |
| FR-037 | A | Submission, if a permitted court endpoint exists, requires explicit human confirmation and stores acknowledgment; otherwise export for manual filing. |

## 5. Contracts and finances

| ID | Phase | Requirement and acceptance condition |
| --- | --- | --- |
| FR-040 | A | Admin creates/imports approved templates and clause versions; contracts snapshot the versions used. |
| FR-041 | A | Contract review flags clauses with supporting rules and reviewer comments; score includes confidence and is editable with audit trail. |
| FR-042 | A | Stamp-duty estimator is limited to validated state/instrument combinations and shows assumptions/source/version; unsupported inputs require manual review. |
| FR-043 | A | E-stamp procurement appears only for contracted providers; final status follows provider acknowledgment. |
| FR-044 | E | User records time, hearing fees, fixed fees, and expenses; approver can accept/reject with reason. |
| FR-045 | E | Finance issues numbered invoice/PDF from approved charges, records adjustments via credit note, and tracks payment state. |
| FR-046 | E | Payments are reconciled with verified, idempotent webhook events; cash/bank entries may be manually reconciled. |
| FR-047 | E | Retainers are posted as advances; allocation cannot exceed available balance and remains visible in transaction history. |

## 6. Client communication, privacy, and audit

| ID | Phase | Requirement and acceptance condition |
| --- | --- | --- |
| FR-050 | E | Admin invites a client through a single-use invitation to a specific matter view, selected milestones, and selected document versions; revocation blocks access immediately because every download is authorized per request and no bearer links are issued. |
| FR-051 | E | Client uploads requested evidence to a quarantine/review queue, not directly into a published filing package. |
| FR-052 | E | Authorized staff previews and approves client messages; deduplicated queue records channel, template version, delivery state, and opt-out. |
| FR-053 | M | Capture notice/consent or other configured processing basis, purpose, and version; withdrawal changes future eligible processing. |
| FR-054 | M | Log login, view, edit, export, download, print initiated via application, and share events with actor, resource, timestamp, and outcome. Browser/OS actions outside application control are not claimed to be captured. |
| FR-055 | M | Data request workflow verifies requester, checks legal hold/retention, exports authorized data, and records decision. |
| FR-056 | M | Admin sets retention classes and legal holds; deletion job cannot remove held material and produces a completion/error report. |

## 7. Cross-cutting acceptance gates

- **Authorization:** automated tests cover PostgreSQL RLS and storage authorization under anonymous, staff, client, revoked, and cross-tenant identities; include downloads, search, background jobs, graph queries (Research beta), and worker/owner role boundaries.
- **Accessibility:** keyboard use, focus state, readable contrast, screen reader labels, and responsive layout for primary workflows.
- **Audit:** each sensitive workflow emits a traceable event with a correlation ID and tamper-evidence strategy.
- **Reliability:** PostgreSQL job-queue/outbox retries are idempotent; failures display actionable status; the PostgreSQL and document-storage restore drill passes before pilot (Neo4j is added to the drill with the Research beta).
- **Research evaluation:** use a curated expert-reviewed test set for citations, abstention, treatment labels, multilingual queries, and source freshness before public claims.
- **Connector acceptance:** permitted access, provenance, coverage, freshness, rate limits, and fallback are documented per forum/provider.
- **Privacy:** no client document is sent to third-party OCR/AI/message service without the configured legal and contractual checks.
