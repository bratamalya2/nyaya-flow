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

export interface Member extends Person {
  email: string;
  active: boolean;
  mfaEnabled: boolean;
}

export interface Party {
  id: string;
  name: string;
  partyType: "petitioner" | "respondent" | "appellant" | "defendant" | "other";
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
  updatedAt: string;
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
  updatedAt: string;
  note?: string;
}

export interface Task {
  id: string;
  matterId: string;
  matterTitle?: string;
  title: string;
  dueAt: string;
  assignee?: Person;
  state: "open" | "in_progress" | "done" | "cancelled";
  priority: "normal" | "urgent";
}

export interface VaultDocument {
  id: string;
  documentId: string;
  matterId: string;
  title: string;
  version: string;
  versionNumber: number;
  pages: number;
  size: string;
  status: DocumentStatus;
  classification: string;
  language: "English" | "Hindi" | "Mixed" | "Unknown";
  ocrConfidence?: number;
  uploadedAt: string;
  uploadedBy: string;
  hash: string;
}

export interface OcrPage {
  id: string;
  pageNumber: number;
  language: string;
  confidence?: number;
  extractedText: string;
  correctedText?: string;
}

export interface SearchHit {
  documentId: string;
  versionId: string;
  matterId: string;
  pageNumber: number;
  title: string;
  snippet: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  resource: string;
  outcome: "success" | "denied" | "error";
  createdAt: string;
  correlationId: string;
  chainIndex?: number;
}

export interface AuditVerification {
  verifiedAt: string;
  ok: boolean;
  checkedCount: number;
  firstBadIndex?: number;
}

export interface HearingConflict {
  first: Hearing;
  second: Hearing;
  overlapMinutes: number;
  travelMinutes: number;
}

export interface MatterGrant {
  id: string;
  userId: string;
  userName: string;
  permission: MatterPermission;
  expiresAt?: string;
  grantedBy: string;
}

export interface Revision {
  id: string;
  resourceType: "matter" | "hearing" | "task";
  resourceId: string;
  previous: Record<string, unknown>;
  changes: Record<string, unknown>;
  reason: string;
  changedBy: string;
  changedAt: string;
}

export interface LegalHold {
  id: string;
  matterId: string;
  matterTitle: string;
  reason: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  releasedAt?: string;
}

export interface MatterDetail {
  matter: Matter;
  parties: Party[];
  hearings: Hearing[];
  tasks: Task[];
  documents: VaultDocument[];
  grants: MatterGrant[];
  revisions: Revision[];
  legalHolds: LegalHold[];
  permissions: { edit: boolean; manage: boolean };
}

export interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  expiresAt: string;
  invitedBy: string;
}

export interface ConsentRecord {
  id: string;
  subjectReference: string;
  purpose: string;
  legalBasis: string;
  noticeVersion: string;
  status: "recorded" | "withdrawn" | "not_required";
  recordedAt: string;
  withdrawnAt?: string;
}

export interface DataRequest {
  id: string;
  requesterReference: string;
  requestType: "access" | "correction" | "erasure" | "export";
  status: "received" | "identity_review" | "legal_hold_review" | "processing" | "fulfilled" | "denied";
  matterId?: string;
  matterTitle?: string;
  decisionReason?: string;
  holdReviewNote?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RetentionClass {
  id: string;
  name: string;
  retentionDays?: number;
  automaticDeletion: boolean;
}

export interface OrganizationPolicies {
  externalAiEnabled: boolean;
  automaticDeletionEnabled: boolean;
  timezone: string;
}
