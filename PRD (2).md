# NyayaFlow — Product Requirements Document

**Version:** Draft 0.1 · **Date:** 26 September 2026 · **Owner:** Product owner  
**Basis:** Supplied `feature_specification.md`; stack decision (revised September 2026): Next.js with self-hosted PostgreSQL, application-owned authentication, and private filesystem storage on an India-hosted VPS; Neo4j joins for the Research beta. This PRD turns an ambitious concept into a phased, testable product plan.

## 1. Product summary

NyayaFlow is a web platform for Indian legal practitioners to organize matters, hearings, tasks, documents, research, billing, and controlled client updates. It begins with a secure practice workspace and grows into evidence-linked legal intelligence and forum-specific automation. The broad source specification covers Supreme Court, High Courts, district courts, tribunals, contracts, criminal-code transition, and filings; initial coverage must be deliberately narrower.

### Problem

Practitioners lose time reconciling court information, scattered case files, manual reminders, and repeated client status requests. Legal research and automated drafting introduce a second risk: a plausible answer without accurate, current, inspectable authority. NyayaFlow should make the underlying source and its freshness visible throughout the workflow.

### Product promise

A team can know what needs attention, find the right matter material, research with inspectable sources, and communicate only verified updates, all under matter-level access control.

## 2. Goals and exclusions

**Goals:** (1) reliable daily work list and matter record; (2) secure document intake/search/versioning; (3) auditable collaboration; (4) passage-linked research with clear uncertainty; (5) extensible court/provider connectors; (6) a path to billing and client portal.

**MVP exclusions:** nationwide automatic court coverage; real-time hearing ETAs where no authorized live feed exists; automatic legal opinions; guaranteed zero hallucinations; one-click filing in unsupported courts; fully browser-native signing with every DSC token; exact nationwide stamp-duty computation; 500 verified templates at launch.

## 3. Personas and jobs

| Persona | Main job | First value |
| --- | --- | --- |
| Solo advocate | Prepare daily cause list, tasks, and case documents | One dependable work queue and document vault. |
| Associate / paralegal | Track assigned matters, prepare bundles, surface changes | Delegated tasks with context and permissions. |
| Partner / senior counsel | Coordinate teams and sensitive matters | Conflicts, workloads, review, and access controls. |
| In-house counsel | Monitor litigation and external counsel | Portfolio view and controlled external collaboration (later). |
| Client | Understand approved progress and provide documents | Limited portal (expansion). |

## 4. Proposed scope and priorities

| Capability | MVP | Research beta | Expansion | Advanced |
| --- | --- | --- | --- | --- |
| Password + mandatory TOTP MFA, PostgreSQL roles/grants with RLS, audit | ✓ | | | |
| Matter records, manual hearings/tasks, conflict warnings, dashboards | ✓ | | | |
| Private document storage, version metadata in PostgreSQL, initial OCR, matter search | ✓ | | | |
| Narrow permitted court connector | Pilot only | | Broaden by forum | Live boards where available |
| Evidence-linked research, citation graph, reviewed treatment | | ✓ | Broaden corpus | |
| Client portal, controlled messages, billing and retainers | | | ✓ | |
| Filing checks, signing, CLM, stamp duty, criminal-code transition | | | | ✓ |

The source specification's visual modes (light, dark, reader) belong in the MVP as accessible preferences. Multi-persona analytics expand after core workflow adoption.

## 5. Primary user journeys

1. **Morning preparation:** advocate signs in; views today's hearings and tasks with source freshness; resolves schedule conflict; opens matter brief and relevant documents.
2. **New matter:** staff creates matter and assignments; adds identifiers and documents; authorized connector proposes externally observed updates; reviewer confirms discrepancies.
3. **Research:** user searches an approved corpus; opens exact passages; receives an answer with per-claim citations and uncertainty; saves reviewed research note.
4. **Client update:** advocate reviews order and message preview; approves selected milestone; client sees approved status and receives delivery where consent/preferences allow.
5. **Billing:** finance approves work/expenses, issues invoice, records advance and payment, and reconciles without changing issued history.

## 6. Requirements and release acceptance

`Functional.md` contains individual requirements FR-001–FR-056. `Business_Requirements.md` contains outcomes BR-01–BR-10. `Business.md` defines state transitions, decision rules, approvals, and edge cases. `Architecture.md` defines implementation boundaries and data flow.

MVP is accepted when a pilot organization can sign in with password and TOTP MFA, create and restrict matters under PostgreSQL row-level security, work from daily hearing/task views, upload and find private documents that are only served after an authorization check, inspect provenance and audit events, and restore PostgreSQL and document storage from backup with the restore drill passing. No known cross-tenant access defect may remain. A connector cannot be labeled live/automatic without validated source permission, measured freshness, and an operational fallback. Research beta additionally requires an expert-reviewed evaluation set, passage locator checks, false-treatment review, and an abstention path.

## 7. UX requirements

- Clear `verified`, `unverified`, `stale`, and `manual` source states, with `last checked` timestamp.
- Show matter context beside tasks, documents, messages, and invoices; avoid duplicate data entry.
- Confirm destructive or externally consequential actions such as sharing, sending, issuing, and submitting.
- Work on desktop and mobile web; accessible keyboard workflow; light, dark, and reader themes.
- Plain-language failure states with retry, correction, or manual workflow.

## 8. Trust, privacy, and compliance

Privileged files, client identity data, and firm strategy demand mandatory MFA, granular PostgreSQL row-level security, private document storage with authenticated downloads so revocation is immediate, audit, retention controls, and data vendor review. DPDP implementation, Bar Council conduct, billing/tax, copyright and court rules must be reviewed with qualified Indian counsel and an accountant as relevant. The MVP runs on an India-hosted VPS (OVH Mumbai, a single availability zone); keep encrypted backups in a separate India-hosted location and verify every processor location, including any future Neo4j, AI, or messaging provider, before making an India-only claim. AI is a drafting/research assistant with human responsibility for final advice and filings.

## 9. Success metrics and proposed pilot targets

| Metric | Proposed target / validation |
| --- | --- |
| Activation | 80% of invited pilot staff create or work on a matter within 14 days. |
| Weekly engagement | 70% of activated pilot staff use the daily view weekly. |
| Document retrieval | 90% of sampled known-item lookups succeed within 2 minutes. |
| Scheduling | 100% of seeded overlap cases generate a visible conflict; false alerts measured. |
| Security | Zero known cross-tenant access defects at pilot release. |
| Research quality | Set quantified citation precision and abstention thresholds from expert baseline before beta. |
| Court ingestion | Publish coverage and observed freshness per connector; do not aggregate into a universal promise. |
| Reliability | Proposed 99.5% monthly availability target after pilot stabilization. |

Targets are planning assumptions and need baseline measurement and acceptance by the product owner.

## 10. Dependencies, risks, and decisions

**Dependencies:** court-source access; legal corpus rights; OCR/model vendors; payment and messaging providers; eSign/DSC and e-stamp partners; jurisdiction-specific court rules.

**Risks:** false legal citations; outdated or inconsistent court data; noisy OCR; privacy leaks; unsupported integration claims; cost of inference and licensed data. Mitigations include provenance, abstention, source freshness, controlled grants, human approval, measured pilots, and narrowly advertised coverage.

**Decisions requested:** first customer segment, first courts/cities, launch OCR languages, corpus licensing, provider/data geography, and whether client portal and billing are part of the first paid release.

## 11. Milestones

1. Discovery and compliance/source-rights validation; pilot design.
2. Secure core and document workflows; usability/security pilot.
3. Narrow court connector and operations dashboard.
4. Research corpus, graph, evaluations, expert beta.
5. Client communication and finance, then advanced court/contract tools by validated provider and jurisdiction.

No calendar dates are committed until data access, team capacity, and pilot partners are confirmed.

## References checked

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)
- [RFC 6238 TOTP](https://www.rfc-editor.org/rfc/rfc6238)
- [eCourts case-status service](https://services.ecourts.gov.in/ecourtindia_v6/casestatus/)
- [Controller of Certifying Authorities eSign](https://cca.gov.in/eSign.html)
- [MeitY DPDP Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025.pdf)
- [Bar Council of India rules](https://www.barcouncilofindia.org/info/bci-rules)
