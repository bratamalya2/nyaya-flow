import { z } from "zod";

export const matterInput = z.object({
  organizationId: z.uuid(),
  title: z.string().trim().min(3).max(240),
  reference: z.string().trim().min(2).max(100),
  cnr: z.string().trim().max(32).optional(),
  forum: z.string().trim().min(2).max(160),
  client: z.string().trim().min(2).max(200),
});

export const uploadIntentInput = z.object({
  organizationId: z.uuid(),
  matterId: z.uuid(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/tiff"]),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
  expectedPages: z.number().int().positive().max(500).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
