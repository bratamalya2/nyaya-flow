// Synthetic demo data. Every party, person, and case below is fictional.
import { DEMO_USER_ID } from "@/lib/runtime";
import type {
  AuditEvent, AuditVerification, ConsentRecord, DataRequest, Hearing, Invitation, LegalHold, Matter, MatterGrant, Member,
  OcrPage, OrganizationPolicies, Party, Person, RetentionClass, Revision, Task, VaultDocument,
} from "@/lib/types";

export const members: Member[] = [
  { id: DEMO_USER_ID, name: "Adv. Meera Iyer", initials: "MI", role: "managing_partner", email: "meera@demo.nyayaflow.test", active: true, mfaEnabled: true },
  { id: "00000000-0000-4000-8000-000000000102", name: "Adv. Karan Rao", initials: "KR", role: "associate", email: "karan@demo.nyayaflow.test", active: true, mfaEnabled: true },
  { id: "00000000-0000-4000-8000-000000000103", name: "Adv. Farah Siddiqui", initials: "FS", role: "advocate", email: "farah@demo.nyayaflow.test", active: true, mfaEnabled: true },
  { id: "00000000-0000-4000-8000-000000000104", name: "Ritu Nair", initials: "RN", role: "paralegal", email: "ritu@demo.nyayaflow.test", active: true, mfaEnabled: true },
  { id: "00000000-0000-4000-8000-000000000105", name: "Sanjay Kulkarni", initials: "SK", role: "finance", email: "sanjay@demo.nyayaflow.test", active: true, mfaEnabled: false },
];
export const people: Person[] = members.map(({ id, name, initials, role }) => ({ id, name, initials, role }));

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const at = (hour: number, minute: number) => new Date(`${istDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`).toISOString();

const id = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

export const matters: Matter[] = [
  {
    id: id(1), title: "Asha Textiles Pvt. Ltd. v. Union of India & Anr.", reference: "W.P.(C) 4417/2026", cnr: "DLHC010044172026",
    forum: "Delhi High Court", courtRoom: "Court 12", stage: "Final arguments", status: "active", sourceState: "manual", updatedAt: at(7, 10),
    client: "Asha Textiles Pvt. Ltd.", lead: people[0], nextListingAt: at(11, 45), restricted: true, tags: ["Constitutional"],
  },
  {
    id: id(2), title: "Meridian Credit Ltd. v. Suryodaya Power Ltd.", reference: "CP(IB)/58/2026",
    forum: "NCLT Principal Bench", courtRoom: "Court 2", stage: "Admission", status: "active", sourceState: "unverified", updatedAt: at(6, 50),
    client: "Meridian Credit Ltd.", lead: people[0], nextListingAt: at(11, 30), tags: ["IBC"],
  },
  {
    id: id(3), title: "Kabir Malhotra v. State (NCT of Delhi)", reference: "SLP(Crl.) 5120/2026",
    forum: "Supreme Court of India", courtRoom: "Court 1", stage: "Special leave petition", status: "active", sourceState: "manual", updatedAt: at(6, 15),
    client: "Kabir Malhotra", lead: people[2], nextListingAt: at(14, 0), tags: ["Bail"],
  },
  {
    id: id(4), title: "Northwind Logistics v. Vistara Cloud Systems", reference: "CS(COMM) 301/2025",
    forum: "Delhi High Court", courtRoom: "Registrar Chamber", stage: "Service report", status: "stayed", sourceState: "stale", updatedAt: at(5, 40),
    client: "Northwind Logistics", lead: people[1], tags: ["Commercial"],
  },
];

export const hearings: Hearing[] = [
  { id: id(101), matterId: matters[0].id, matterTitle: matters[0].title, reference: matters[0].reference, forum: matters[0].forum, courtRoom: "Court 12", startsAt: at(11, 35), endsAt: at(12, 15), itemNumber: 14, advocate: people[0], status: "confirmed", sourceState: "manual", updatedAt: at(7, 5), note: "Written submissions and rejoinder ready." },
  { id: id(102), matterId: matters[1].id, matterTitle: matters[1].title, reference: matters[1].reference, forum: matters[1].forum, courtRoom: "Court 2", startsAt: at(11, 25), endsAt: at(12, 5), itemNumber: 8, advocate: people[0], status: "proposed", sourceState: "unverified", updatedAt: at(6, 55), note: "Proxy counsel decision pending." },
  { id: id(103), matterId: matters[2].id, matterTitle: matters[2].title, reference: matters[2].reference, forum: matters[2].forum, courtRoom: "Court 1", startsAt: at(14, 0), endsAt: at(15, 0), advocate: people[2], status: "confirmed", sourceState: "manual", updatedAt: at(6, 10) },
];

export const tasks: Task[] = [
  { id: id(201), matterId: matters[0].id, matterTitle: matters[0].title, title: "Review rejoinder affidavit", dueAt: at(10, 30), assignee: people[1], state: "in_progress", priority: "urgent" },
  { id: id(202), matterId: matters[1].id, matterTitle: matters[1].title, title: "Confirm proxy advocate", dueAt: at(10, 45), assignee: people[0], state: "open", priority: "urgent" },
  { id: id(203), matterId: matters[2].id, matterTitle: matters[2].title, title: "Prepare SLP compendium", dueAt: at(13, 0), assignee: people[2], state: "open", priority: "normal" },
  { id: id(204), matterId: matters[0].id, matterTitle: matters[0].title, title: "Index certified order", dueAt: at(17, 0), assignee: people[3], state: "open", priority: "normal" },
];

const doc = (n: number, matter: Matter, title: string, extra: Partial<VaultDocument>): VaultDocument => ({
  id: id(300 + n), documentId: id(400 + n), matterId: matter.id, title, version: "v1.0", versionNumber: 1, pages: 0, size: "1.0 MB",
  status: "ready", classification: "Unclassified", language: "English", uploadedAt: at(6, 30), uploadedBy: people[3].name, hash: "0000…0000", ...extra,
});
export const documents: VaultDocument[] = [
  doc(1, matters[0], "Writ_Petition_Final_Signed.pdf", { version: "v3.0", versionNumber: 3, pages: 64, size: "12.8 MB", classification: "Pleading", ocrConfidence: 98.7, uploadedBy: people[1].name, hash: "98af…32b1" }),
  doc(2, matters[0], "Annexure_P1_Impugned_Order.pdf", { pages: 24, size: "8.1 MB", classification: "Annexure P-1", language: "Mixed", ocrConfidence: 94.2, hash: "32be…a990" }),
  doc(3, matters[0], "Draft_Rejoinder_Affidavit.pdf", { version: "v4.0", versionNumber: 4, pages: 18, size: "3.4 MB", status: "processing", classification: "Draft", uploadedAt: at(8, 5), uploadedBy: people[1].name, hash: "81cb…043c" }),
  doc(4, matters[1], "Hindi_Affidavit_Scan.pdf", { pages: 42, size: "18.6 MB", status: "ocr_pending", classification: "Evidence", language: "Hindi", uploadedAt: at(8, 20), hash: "119a…b311" }),
  doc(5, matters[2], "SLP_Compendium.pdf", { version: "v2.0", versionNumber: 2, pages: 286, size: "84.2 MB", status: "quarantined", classification: "Compendium", uploadedAt: at(8, 55), uploadedBy: people[2].name, hash: "f92c…8a10" }),
];

export const ocrPages: OcrPage[] = [
  { id: id(501), pageNumber: 1, language: "eng", confidence: 97.4, extractedText: "IN THE HIGH COURT OF DELHI AT NEW DELHI\nW.P.(C) 4417/2026\nAsha Textiles Pvt. Ltd. ... Petitioner\nversus\nUnion of India & Anr. ... Respondents" },
  { id: id(502), pageNumber: 2, language: "eng", confidence: 91.2, extractedText: "SYNOPSIS AND LIST OF DATES\nThe petitioner challenges the impugned order dated 04.08.2026 …", correctedText: "SYNOPSIS AND LIST OF DATES\nThe petitioner challenges the impugned order dated 04.08.2026 passed by Respondent No. 2." },
];

export const parties: Party[] = [
  { id: id(601), name: "Asha Textiles Pvt. Ltd.", partyType: "petitioner" },
  { id: id(602), name: "Union of India", partyType: "respondent" },
  { id: id(603), name: "Directorate of Textile Standards", partyType: "respondent" },
];

export const grants: MatterGrant[] = [
  { id: id(701), userId: people[1].id, userName: people[1].name, permission: "edit", grantedBy: people[0].name },
  { id: id(702), userId: people[3].id, userName: people[3].name, permission: "view", expiresAt: at(23, 0), grantedBy: people[0].name },
];

export const revisions: Revision[] = [
  { id: id(801), resourceType: "hearing", resourceId: hearings[0].id, previous: { startsAt: at(10, 30) }, changes: { startsAt: at(11, 35) }, reason: "Board shows matter moved after lunch pass-over.", changedBy: people[1].name, changedAt: at(7, 5) },
];

export const legalHolds: LegalHold[] = [
  { id: id(901), matterId: matters[0].id, matterTitle: matters[0].title, reason: "Appeal window open; preserve all versions.", active: true, createdBy: people[0].name, createdAt: at(6, 0) },
];

export const auditEvents: AuditEvent[] = [
  { id: id(1001), actor: people[1].name, action: "document.upload", resource: `document_version · ${documents[2].id}`, outcome: "success", createdAt: at(8, 5), correlationId: "3f1c2a90-7d1e-4b1a-9a52-1f0d3c2b9e11", chainIndex: 42 },
  { id: id(1002), actor: people[0].name, action: "matter.grant.create", resource: `matter · ${matters[0].id}`, outcome: "success", createdAt: at(7, 52), correlationId: "9b2e4f10-2c3d-4e5f-8a6b-7c8d9e0f1a2b", chainIndex: 41 },
  { id: id(1003), actor: people[3].name, action: "ocr.correct", resource: `ocr_page · ${ocrPages[1].id}`, outcome: "success", createdAt: at(7, 30), correlationId: "c4d5e6f7-0a1b-4c2d-9e3f-4a5b6c7d8e9f", chainIndex: 40 },
];

export const auditVerification: AuditVerification = { verifiedAt: at(2, 20), ok: true, checkedCount: 42 };

export const invitations: Invitation[] = [
  { id: id(1101), email: "new.associate@demo.nyayaflow.test", role: "associate", expiresAt: at(23, 59), invitedBy: people[0].name },
];

export const consents: ConsentRecord[] = [
  { id: id(1201), subjectReference: "Client: Asha Textiles Pvt. Ltd. (authorised signatory)", purpose: "Matter representation and document processing", legalBasis: "consent", noticeVersion: "2026.1", status: "recorded", recordedAt: at(6, 5) },
  { id: id(1202), subjectReference: "Witness: R. Menon", purpose: "Evidence file processing", legalBasis: "legal_obligation", noticeVersion: "2026.1", status: "not_required", recordedAt: at(6, 25) },
];

export const dataRequests: DataRequest[] = [
  { id: id(1301), requesterReference: "Former client ref. NW-2019-14", requestType: "erasure", status: "legal_hold_review", createdAt: at(5, 55) },
  { id: id(1302), requesterReference: "Client ref. MC-2026-02", requestType: "export", status: "identity_review", createdAt: at(6, 40) },
];

export const retentionClasses: RetentionClass[] = [
  { id: id(1401), name: "Litigation file (closed)", retentionDays: 2555, automaticDeletion: false },
  { id: id(1402), name: "Billing records", retentionDays: 2920, automaticDeletion: false },
];

export const policies: OrganizationPolicies = { externalAiEnabled: false, automaticDeletionEnabled: false, timezone: "Asia/Kolkata" };
