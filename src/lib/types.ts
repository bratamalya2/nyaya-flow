export type AppRole =
  | "owner"
  | "managing_partner"
  | "advocate"
  | "associate"
  | "paralegal"
  | "admin"
  | "finance";

export type MatterPermission = "view" | "edit" | "manage" | "export";
export type MatterStatus = "draft" | "active" | "stayed" | "closed";
export type HearingStatus = "proposed" | "confirmed" | "adjourned" | "completed" | "cancelled";
export type SourceState = "manual" | "unverified" | "verified" | "stale";
export type DocumentStatus =
  | "uploaded"
  | "quarantined"
  | "scanning"
  | "ocr_pending"
  | "processing"
  | "ready"
  | "failed"
  | "blocked";

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: AppRole;
}

export interface Matter {
  id: string;
  title: string;
  reference: string;
  cnr?: string;
  forum: string;
  courtRoom?: string;
  stage: string;
  status: MatterStatus;
  sourceState: SourceState;
  lastCheckedAt?: string;
  client: string;
  lead: Person;
  nextListingAt?: string;
  restricted?: boolean;
  tags: string[];
}

export interface Hearing {
  id: string;
  matterId: string;
  matterTitle: string;
  reference: string;
  forum: string;
  courtRoom: string;
  startsAt: string;
  endsAt: string;
  itemNumber?: number;
  advocate: Person;
  status: HearingStatus;
  sourceState: SourceState;
  note?: string;
}

export interface Task {
  id: string;
  matterId: string;
  title: string;
  dueAt: string;
  assignee: Person;
  state: "open" | "in_progress" | "done" | "cancelled";
  priority: "normal" | "urgent";
}

export interface VaultDocument {
  id: string;
  matterId: string;
  title: string;
  version: string;
  pages: number;
  size: string;
  status: DocumentStatus;
  classification: string;
  language: "English" | "Hindi" | "Mixed";
  ocrConfidence?: number;
  uploadedAt: string;
  uploadedBy: string;
  hash: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  resource: string;
  outcome: "success" | "denied" | "error";
  createdAt: string;
  correlationId: string;
}

export interface HearingConflict {
  first: Hearing;
  second: Hearing;
  overlapMinutes: number;
  travelMinutes: number;
}
