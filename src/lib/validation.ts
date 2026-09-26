import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

/** eCourts CNR: four-letter establishment code followed by twelve digits, e.g. DLHC010012342026. */
export const CNR_PATTERN = /^[A-Z]{4}\d{12}$/;

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const reason = z.string().trim().min(3, "Give a reason of at least 3 characters.").max(500);
const isoDateTime = z.iso.datetime({ offset: true });

export const cnrInput = z.preprocess(
  blankToUndefined,
  z.string().trim().toUpperCase().regex(CNR_PATTERN, "CNR must be 4 letters followed by 12 digits.").optional(),
);

export const partyTypes = ["petitioner", "respondent", "appellant", "defendant", "other"] as const;

export const matterInput = z.object({
  title: z.string().trim().min(3).max(240),
  reference: z.string().trim().min(2).max(100),
  cnr: cnrInput,
  forum: z.string().trim().min(2).max(160),
  courtRoom: optionalText(80),
  client: z.string().trim().min(2).max(200),
  leadId: z.uuid().optional(),
  restricted: z.boolean().default(false),
  parties: z.array(z.object({ name: z.string().trim().min(2).max(200), partyType: z.enum(partyTypes) })).max(20).default([]),
});

export const matterUpdate = z.object({
  title: z.string().trim().min(3).max(240).optional(),
  stage: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["draft", "active", "stayed", "closed"]).optional(),
  restricted: z.boolean().optional(),
  leadId: z.uuid().optional(),
  courtRoom: optionalText(80),
  reason,
});

export const hearingInput = z.object({
  advocateId: z.uuid(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  forum: optionalText(160),
  courtRoom: optionalText(80),
  itemNumber: z.number().int().positive().max(9999).optional(),
  status: z.enum(["proposed", "confirmed"]).default("proposed"),
  notes: optionalText(2000),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { message: "End time must be after start time.", path: ["endsAt"] });

export const hearingUpdate = z.object({
  advocateId: z.uuid().optional(),
  startsAt: isoDateTime.optional(),
  endsAt: isoDateTime.optional(),
  courtRoom: optionalText(80),
  itemNumber: z.number().int().positive().max(9999).nullable().optional(),
  status: z.enum(["proposed", "confirmed", "adjourned", "completed", "cancelled"]).optional(),
  notes: optionalText(2000),
  reason,
});

export const taskInput = z.object({
  title: z.string().trim().min(3).max(240),
  dueAt: isoDateTime,
  assigneeId: z.uuid().optional(),
  priority: z.enum(["normal", "urgent"]).default("normal"),
});

export const taskUpdate = z.object({
  state: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  title: z.string().trim().min(3).max(240).optional(),
  dueAt: isoDateTime.optional(),
  assigneeId: z.uuid().nullable().optional(),
  priority: z.enum(["normal", "urgent"]).optional(),
  reason: reason.optional(),
}).refine((value) => (value.dueAt === undefined && value.assigneeId === undefined) || value.reason !== undefined, {
  message: "Changing a deadline or assignee requires a reason.",
  path: ["reason"],
});

export const conflictDismissalInput = z.object({ firstHearingId: z.uuid(), secondHearingId: z.uuid(), reason });

export const grantInput = z.object({
  userId: z.uuid(),
  permission: z.enum(["view", "edit", "manage", "export"]),
  expiresAt: isoDateTime.optional(),
});

export const legalHoldInput = z.object({ reason });

export const invitationInput = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["owner", "managing_partner", "advocate", "associate", "paralegal", "admin", "finance"]),
  expiresInDays: z.number().int().min(1).max(14).default(7),
});

export const memberUpdate = z.object({
  role: z.enum(["owner", "managing_partner", "advocate", "associate", "paralegal", "admin", "finance"]).optional(),
  active: z.boolean().optional(),
});

export const passwordInput = z.string().min(14, "Use at least 14 characters.").max(256);

export const uploadIntentInput = z.object({
  matterId: z.uuid(),
  documentId: z.uuid().optional(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/tiff"]),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
  expectedPages: z.number().int().positive().max(500).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const consentInput = z.object({
  subjectReference: z.string().trim().min(2).max(200),
  purpose: z.string().trim().min(3).max(300),
  legalBasis: z.enum(["consent", "legitimate_use", "legal_obligation", "court_order", "other"]),
  noticeVersion: z.string().trim().min(1).max(40),
  status: z.enum(["recorded", "not_required"]).default("recorded"),
});

export const dataRequestInput = z.object({
  requesterReference: z.string().trim().min(2).max(200),
  requestType: z.enum(["access", "correction", "erasure", "export"]),
  matterId: z.uuid().optional(),
});

export const dataRequestStatuses = ["received", "identity_review", "legal_hold_review", "processing", "fulfilled", "denied"] as const;
export const dataRequestUpdate = z.object({
  status: z.enum(dataRequestStatuses),
  decisionReason: optionalText(1000),
  holdReviewNote: optionalText(1000),
});

export const retentionClassInput = z.object({
  name: z.string().trim().min(2).max(120),
  retentionDays: z.number().int().positive().max(36_500).optional(),
});

export const organizationPolicyUpdate = z.object({ externalAiEnabled: z.boolean() });

const email = z.email().max(254).transform((value) => value.trim().toLowerCase());
const inviteDays = z.number().int().min(1).max(14).default(7);

export const platformSignInInput = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  code: z.string().regex(/^\d{6}$/),
});

export const operatorInput = z.object({
  organizationName: z.string().trim().min(2).max(200),
  slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, "Use 2–63 lowercase letters, digits, or hyphens, starting with a letter or digit."),
  ownerEmail: email,
  expiresInDays: inviteDays,
});

export const ownerInvitationInput = z.object({ ownerEmail: email, expiresInDays: inviteDays });
