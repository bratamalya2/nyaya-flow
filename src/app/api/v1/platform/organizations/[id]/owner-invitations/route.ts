import { NextResponse } from "next/server";
import { assertUuid, readJson } from "@/lib/api";
import { createOpaqueToken, hashToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { recordPlatformAudit } from "@/lib/platform";
import { invitationLink, platformRoute } from "@/lib/platform-api";
import { ownerInvitationInput } from "@/lib/validation";

// Issues a fresh owner link (revoking any pending one), e.g. when the first link was lost or expired.
export const POST = platformRoute<{ id: string }>(async (request, { params, session }) => {
  const organizationId = assertUuid(params.id, "organization");
  const input = await readJson(request, ownerInvitationInput);
  const token = createOpaqueToken();
  const issued = await query<{ invitation_id: string; expires_at: Date }>(
    "select * from platform_issue_owner_invitation($1, $2, $3, $4)",
    [organizationId, input.ownerEmail, hashToken(token), input.expiresInDays],
  );
  await recordPlatformAudit({ action: "platform.owner_invitation.issue", resourceType: "organization", resourceId: organizationId, outcome: "success", actorEmail: session.email });
  return NextResponse.json({ data: { invitationLink: invitationLink(request, token), expiresAt: issued.rows[0].expires_at.toISOString() } }, { status: 201 });
});
