import type { AuditEvent, Hearing, Matter, Person, Task, VaultDocument } from "@/lib/types";

export const people: Person[] = [
  { id: "p1", name: "Adv. Vikram Sen", initials: "VS", role: "managing_partner" },
  { id: "p2", name: "Adv. Ananya Deshmukh", initials: "AD", role: "associate" },
  { id: "p3", name: "Rohan Mittal", initials: "RM", role: "advocate" },
  { id: "p4", name: "Meera Kapoor", initials: "MK", role: "paralegal" },
];

const today = new Date();
const at = (hour: number, minute: number) => {
  const value = new Date(today);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

export const matters: Matter[] = [
  {
    id: "matter-tata",
    title: "Tata Consumer Products Ltd. v. Union of India & Anr.",
    reference: "W.P.(C) 8812/2024",
    cnr: "DLHC010098422024",
    forum: "Delhi High Court",
    courtRoom: "Court 12",
    stage: "Final arguments",
    status: "active",
    sourceState: "manual",
    lastCheckedAt: at(7, 10),
    client: "Tata Consumer Products Ltd.",
    lead: people[0],
    nextListingAt: at(11, 45),
    restricted: true,
    tags: ["Constitutional", "Competition"],
  },
  {
    id: "matter-apex",
    title: "Apex Finvest Corp. v. Solarium Energetics Ltd.",
    reference: "CP(IB)/102/2025",
    cnr: "NCLT010001022025",
    forum: "NCLT Principal Bench",
    courtRoom: "Court 2",
    stage: "Admission",
    status: "active",
    sourceState: "unverified",
    client: "Apex Finvest Corp.",
    lead: people[0],
    nextListingAt: at(11, 30),
    tags: ["IBC", "Section 7"],
  },
  {
    id: "matter-anand",
    title: "Anand Varma v. Directorate of Enforcement",
    reference: "SLP(Crl.) 9934/2026",
    cnr: "SCIN010099342026",
    forum: "Supreme Court of India",
    courtRoom: "Court 1",
    stage: "Special leave petition",
    status: "active",
    sourceState: "manual",
    client: "Anand Varma",
    lead: people[2],
    nextListingAt: at(14, 0),
    tags: ["PMLA", "Bail"],
  },
  {
    id: "matter-matrix",
    title: "Matrix Digital Infra v. CloudNet Systems",
    reference: "CS(COMM) 188/2024",
    forum: "Delhi High Court",
    courtRoom: "Registrar Chamber",
    stage: "Service report",
    status: "stayed",
    sourceState: "stale",
    client: "Matrix Digital Infra",
    lead: people[1],
    tags: ["Commercial", "Service"],
  },
];

export const hearings: Hearing[] = [
  {
    id: "h1",
    matterId: "matter-tata",
    matterTitle: matters[0].title,
    reference: matters[0].reference,
    forum: matters[0].forum,
    courtRoom: "Court 12",
    startsAt: at(11, 35),
    endsAt: at(12, 15),
    itemNumber: 14,
    advocate: people[0],
    status: "confirmed",
    sourceState: "manual",
    note: "Written submissions and rejoinder ready.",
  },
  {
    id: "h2",
    matterId: "matter-apex",
    matterTitle: matters[1].title,
    reference: matters[1].reference,
    forum: matters[1].forum,
    courtRoom: "Court 2",
    startsAt: at(11, 25),
    endsAt: at(12, 5),
    itemNumber: 8,
    advocate: people[0],
    status: "proposed",
    sourceState: "unverified",
    note: "Proxy counsel decision pending.",
  },
  {
    id: "h3",
    matterId: "matter-anand",
    matterTitle: matters[2].title,
    reference: matters[2].reference,
    forum: matters[2].forum,
    courtRoom: "Court 1",
    startsAt: at(14, 0),
    endsAt: at(15, 0),
    itemNumber: 28,
    advocate: people[2],
    status: "confirmed",
    sourceState: "manual",
  },
];

export const tasks: Task[] = [
  { id: "t1", matterId: "matter-tata", title: "Review rejoinder affidavit", dueAt: at(10, 30), assignee: people[1], state: "in_progress", priority: "urgent" },
  { id: "t2", matterId: "matter-apex", title: "Confirm proxy advocate", dueAt: at(10, 45), assignee: people[0], state: "open", priority: "urgent" },
  { id: "t3", matterId: "matter-anand", title: "Prepare SLP compendium", dueAt: at(13, 0), assignee: people[2], state: "open", priority: "normal" },
  { id: "t4", matterId: "matter-tata", title: "Index certified order", dueAt: at(17, 0), assignee: people[3], state: "done", priority: "normal" },
];

export const documents: VaultDocument[] = [
  { id: "d1", matterId: "matter-tata", title: "Writ_Petition_Final_Signed.pdf", version: "v3.2", pages: 64, size: "12.8 MB", status: "ready", classification: "Pleading", language: "English", ocrConfidence: 98.7, uploadedAt: at(6, 35), uploadedBy: people[1].name, hash: "98af…32b1" },
  { id: "d2", matterId: "matter-tata", title: "Annexure_P1_Impugned_Order.pdf", version: "v1.0", pages: 24, size: "8.1 MB", status: "ready", classification: "Annexure P-1", language: "Mixed", ocrConfidence: 94.2, uploadedAt: at(6, 42), uploadedBy: people[3].name, hash: "32be…a990" },
  { id: "d3", matterId: "matter-tata", title: "Draft_Rejoinder_Affidavit.doc.pdf", version: "v4.0", pages: 18, size: "3.4 MB", status: "processing", classification: "Draft", language: "English", ocrConfidence: 72.4, uploadedAt: at(8, 5), uploadedBy: people[1].name, hash: "81cb…043c" },
  { id: "d4", matterId: "matter-apex", title: "Hindi_Affidavit_Scan.pdf", version: "v1.0", pages: 42, size: "18.6 MB", status: "ocr_pending", classification: "Evidence", language: "Hindi", uploadedAt: at(8, 20), uploadedBy: people[3].name, hash: "119a…b311" },
  { id: "d5", matterId: "matter-anand", title: "SLP_Compendium.pdf", version: "v2.1", pages: 286, size: "84.2 MB", status: "quarantined", classification: "Compendium", language: "English", uploadedAt: at(8, 55), uploadedBy: people[2].name, hash: "f92c…8a10" },
];

export const auditEvents: AuditEvent[] = [
  { id: "a1", actor: people[1].name, action: "document.upload", resource: documents[2].title, outcome: "success", createdAt: at(8, 5), correlationId: "req_8M2P7" },
  { id: "a2", actor: people[0].name, action: "matter.grant.updated", resource: matters[0].reference, outcome: "success", createdAt: at(7, 52), correlationId: "req_92DLA" },
  { id: "a3", actor: "Unknown session", action: "matter.view", resource: matters[0].reference, outcome: "denied", createdAt: at(7, 48), correlationId: "req_T8Q21" },
  { id: "a4", actor: people[3].name, action: "ocr.correction", resource: documents[1].title, outcome: "success", createdAt: at(7, 30), correlationId: "req_H31YC" },
];
