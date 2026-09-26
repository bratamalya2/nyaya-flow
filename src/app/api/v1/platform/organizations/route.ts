import { NextResponse } from "next/server";
import { readJson } from "@/lib/api";
import { createOpaqueToken, hashToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { recordPlatformAudit } from "@/lib/platform";
import { invitationLink, platformRoute } from "@/lib/platform-api";
import { listPlatformOrganizations } from "@/lib/repositories/platform";
import { operatorInput } from "@/lib/validation";

export const GET = platformRoute(async () => NextResponse.json({ data: await listPlatformOrganizations() }));

// Creates a tenant organization and a one-time owner invitation. The owner chooses their own password
// and enrols MFA through the invitation, so the platform administrator never knows tenant credentials.
export const POST = platformRoute(async (request, { session }) => {
  const input = await readJson(request, operatorInput);
  const token = createOpaqueToken();
  const created = await query<{ organization_id: string; invitation_id: string; expires_at: Date }>(
    "select * from platform_create_organization($1, $2, $3, $4, $5)",
    [input.organizationName, input.slug, input.ownerEmail, hashToken(token), input.expiresInDays],
  );
  const row = created.rows[0];
  await recordPlatformAudit({ action: "platform.organization.create", resourceType: "organization", resourceId: row.organization_id, outcome: "success", actorEmail: session.email, metadata: { slug: input.slug } });
  return NextResponse.json({ data: { organizationId: row.organization_id, invitationLink: invitationLink(request, token), expiresAt: row.expires_at.toISOString() } }, { status: 201 });
});
