# NyayaFlow — Business Requirements

**Status:** Draft for stakeholder review · **Date:** 26 September 2026  
**Source:** `feature_specification.md`; stack decision (revised September 2026): Next.js with self-hosted PostgreSQL, application-owned authentication, and private document storage on an India-hosted VPS; Neo4j for the Research beta. This document states desired business outcomes and constraints; detailed behavior is in `Functional.md`.

## 1. Opportunity and objectives

Indian legal practitioners often manage matter records, court listings, documents, research, billing, and client updates across disconnected tools. NyayaFlow aims to give solo advocates, firms, and in-house teams one secure workspace with traceable source information and controlled automation.

| ID | Business requirement | Measure / evidence | Priority |
| --- | --- | --- | --- |
| BR-01 | Reduce time spent preparing daily court schedules and tracking matters. | Pilot users can see assigned hearings, source freshness, conflicts, and pending tasks in one view; baseline and post-pilot time study. | Must |
| BR-02 | Reduce missed actions from conflicting hearings, tasks, and changing dates. | Pilot counts confirmed conflict alerts, due-task completion, and missed events; no duplicate alert floods. | Must |
| BR-03 | Preserve client confidentiality while enabling collaboration. | Mandatory MFA and PostgreSQL row-level security restrict matters and documents; access tests pass; audit trail available for reads, downloads, edits, and shares. | Must |
| BR-04 | Make document intake, retrieval, and version control faster. | Pilot measures upload-to-search readiness, retrieval success, and OCR correction burden. | Must |
| BR-05 | Enable reliable, evidence-linked legal research. | Evaluated answers cite retrievable passages; unsupported claims and uncertain treatment are surfaced or withheld. | Must for research release |
| BR-06 | Improve transparent client updates without exposing unapproved case facts. | Authorized clients see shared milestones; messages show approval and delivery status. | Should |
| BR-07 | Track fees, expenses, advances, and invoices with a defensible history. | Reconciled ledger and invoice samples pass accountant review. | Should |
| BR-08 | Support court-specific preparation with transparent checks. | Every supported filing rule has source, effective version, test cases, and a human review step. | Later |
| BR-09 | Expand to contracts, signing, and stamp-duty workflows where partner and rule coverage is verified. | Supported jurisdiction/provider matrix and completed transaction receipts. | Later |
| BR-10 | Provide sustainable SaaS economics compatible with professional-conduct review. | Plans, cost-to-serve, and contracts approved by legal/accounting stakeholders; no commission logic. | Must |

## 2. Customers and buying context

- **Solo advocate:** purchases simple matter, hearing, task, document, and research workflows.
- **Law firm managing partner:** buys controlled collaboration, reporting, administration, and billing visibility.
- **Senior counsel / associate / paralegal:** uses daily brief, delegated tasks, notes, and shared document review.
- **Corporate in-house legal team:** needs litigation portfolio view, external counsel tracking, contract pipeline, and restricted access.
- **Client:** invited portal user; sees only approved information and can upload requested documents.

Initial commercial focus should be chosen after interviews; the scope is too broad to promise every persona and forum at launch.

## 3. Commercial model and policy

Proposed B2B subscription with fixed tiers and/or seats plus disclosed usage allowances for storage, OCR, and AI. No percentage of legal fees, advocate referral commission, or success-fee marketplace. Offer an export path at offboarding and clear retention terms. Pricing, GST treatment, contract terms, and professional-conduct positioning require legal/accounting sign-off. Maintain separate budgets for provider messages, OCR, model inference, court connectors, and licensed legal data.

## 4. Business process requirements

1. Organization admin onboards users, configures access and policies, and invites clients only for chosen matters.
2. Advocate creates/imports a matter and verifies court identity. Listings and dates show origin and recency.
3. Team allocates hearings and tasks, resolves conflicts, records proceedings, and reviews order changes.
4. Staff uploads documents, confirms extracted text/index, and assembles controlled versions for sharing or filing.
5. Researcher queries licensed/permitted sources; legal reviewer verifies citations and decisions before using generated work.
6. Approver reviews client messages and shared milestones; system records attempt and delivery status.
7. Finance approves charges, issues invoices, records advances, reconciles payments, and exports records.
8. Admin handles access, retention, consent, incident, and audit requests.

## 5. Release scope and gates

| Release | Business capability | Exit gate |
| --- | --- | --- |
| MVP | Solo/small-firm workspace, matters, tasks/hearings, documents/OCR for selected languages, permissions, audit, manual court updates, narrow approved source ingestion | 3–5 pilot organizations can run real workflows securely; zero known cross-tenant leaks; restore drill completed. |
| Research beta | Licensed/approved corpus, passage-linked answers, citation graph, treatment review | Blind legal-expert evaluation on a representative test set; target metrics and error thresholds agreed before release. |
| Expansion | Client portal, approved communications, billing, more forums | Provider permissions and delivery/reconciliation evidence; measured pilot value. |
| Advanced | Court-specific defect rules, CLM, signing, e-stamp, criminal-code transition | Each court/provider/state supported only after rule, rights, legal, and integration validation. |

## 6. External dependencies and risks

- Court status, cause lists, live item numbers, filing endpoints, and coverage vary. Each forum needs an approved access path, monitoring, and manual fallback. The specification's nationwide coverage is a roadmap aspiration.
- Judgment/statute licensing, citation metadata quality, and rights to store or redistribute need procurement and counsel review.
- Legal AI cannot guarantee zero hallucinations; factual support, abstention, evaluation, and human verification are product controls.
- OCR accuracy varies by script, handwriting, image quality, and forum. Claims require measured datasets by language.
- Filing rules, stamp duty, privacy obligations, signature flows, and professional conduct change; maintain versioned rulebooks and review owners.
- India's DPDP requirements and commencement dates need counsel review at implementation. The MVP is hosted on an OVH Mumbai VPS; verify every backup, log, future Neo4j, and third-party processing path before claiming India-only processing.

## 7. Launch decision checklist

- Name, logo, and trademark clearance complete before public marketing.
- Pilot persona, forum list, jurisdictions, language set, and licensed corpus approved.
- Data-processing and professional-conduct assessment approved.
- Authentication and MFA configuration, PostgreSQL RLS review, database-role and secret isolation, accessibility check, incident runbook, PostgreSQL and document-storage restore drill, and support process complete.
- Product metrics defined: activation, weekly active matters, time-to-brief, document search success, source freshness, citation verification pass, retention, support volume, gross margin.
- Contracted partners and their fallback paths documented for every advertised integration.

## 8. Open questions for owner

1. Which first buyer: solo advocates, litigation firms, or corporate legal departments?
2. Which 1–2 courts/forums and cities should the pilot support?
3. What legal corpus and data licences already exist, if any?
4. Which languages are needed for the first OCR release?
5. Must client portal, billing, and messaging be in the first paid version?
6. Is India-only processing mandatory for AI, support, logs, and backups too?

## References for validation

- [eCourts Services case status](https://services.ecourts.gov.in/ecourtindia_v6/casestatus/)
- [eCourts cause list](https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list)
- [MeitY DPDP Rules and timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025.pdf)
- [Bar Council of India rules information](https://www.barcouncilofindia.org/info/bci-rules)
