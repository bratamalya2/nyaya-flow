import { query } from "@/lib/db";

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  activeMembers: number;
  ownerEmails: string[];
  pendingOwnerEmail?: string;
  pendingOwnerExpiresAt?: string;
}

/** Organization metadata only — the platform console never reads matters, documents, or audit contents. */
export async function listPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const result = await query<{ id: string; name: string; slug: string; created_at: Date; active_members: string; owner_emails: string | null; pending_owner_email: string | null; pending_owner_expires_at: Date | null }>(
    "select * from platform_organizations()",
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at.toISOString(),
    activeMembers: Number(row.active_members),
    ownerEmails: row.owner_emails ? row.owner_emails.split(", ") : [],
    pendingOwnerEmail: row.pending_owner_email ?? undefined,
    pendingOwnerExpiresAt: row.pending_owner_expires_at?.toISOString(),
  }));
}
