import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { createOpaqueToken, hashPassword, hashToken } from "@/lib/auth";
import { hasMatterPermission, requireMatter } from "@/lib/matters";
import { EDITOR_ROLES } from "@/lib/permissions";
import { portalDocumentShareInput, portalEvidenceInput, portalInvitationInput, portalMilestoneInput } from "@/lib/validation";

export const POST = apiRoute({ roles: EDITOR_ROLES }, async (request, { workspace, db, audit }) => {
  const action = new URL(request.url).searchParams.get("action");
  if (action === "invite") {
    const input = await readJson(request, portalInvitationInput); const token = createOpaqueToken();
    const data = await db(async (client) => {
      await requireMatter(client, workspace, input.matterId); if (!await hasMatterPermission(client, input.matterId, "manage")) throw new ApiError(403, "Matter manage permission is required.");
      const staff = await client.query("select 1 from app_users u join memberships m on m.user_id=u.id where lower(u.email)=lower($1) and m.active", [input.email]);
      if (staff.rowCount) throw new ApiError(409, "A firm staff email cannot be added as a portal client.");
      let portalClient = await client.query<{ id: string }>("select pc.id from portal_clients pc join app_users u on u.id=pc.user_id where pc.organization_id=$1 and lower(u.email)=lower($2) and pc.disabled_at is null", [workspace.organizationId, input.email]);
      if (!portalClient.rows[0]) {
        const user = await client.query<{ id: string }>("insert into app_users(email,display_name,password_hash,is_portal_client) values($1,$2,$3,true) returning id", [input.email, input.displayName, await hashPassword(createOpaqueToken())]);
        portalClient = await client.query<{ id: string }>("insert into portal_clients(organization_id,user_id,display_name) values($1,$2,$3) returning id", [workspace.organizationId, user.rows[0].id, input.displayName]);
      }
      const grant = await client.query<{ id: string }>("insert into portal_matter_grants(organization_id,matter_id,client_id,expires_at,granted_by) values($1,$2,$3,now()+interval '90 days',$4) on conflict (matter_id,client_id) where revoked_at is null do update set expires_at=excluded.expires_at returning id", [workspace.organizationId, input.matterId, portalClient.rows[0].id, workspace.userId]);
      await client.query("insert into portal_invitations(organization_id,matter_id,client_id,token_hash,expires_at,created_by) values($1,$2,$3,$4,now()+interval '7 days',$5)", [workspace.organizationId, input.matterId, portalClient.rows[0].id, hashToken(token), workspace.userId]);
      await audit(client, { action: "portal.client.invite.issue", resourceType: "portal_grant", resourceId: grant.rows[0].id, outcome: "success", metadata: { matterId: input.matterId, delivery: "manual_link_only", emailDelivery: false } });
      return { clientId: portalClient.rows[0].id, grantId: grant.rows[0].id };
    });
    return NextResponse.json({ data: { ...data, activationLink: `/portal/activate/${token}`, expiresInDays: 7, delivery: "manual" } }, { status: 201 });
  }
  if (action === "milestone") {
    const input = await readJson(request, portalMilestoneInput);
    const id = await db(async (client) => { await requireMatter(client, workspace, input.matterId); if (!await hasMatterPermission(client, input.matterId, "manage")) throw new ApiError(403, "Matter manage permission is required.");
      const milestone = await client.query<{ id: string }>("insert into portal_milestones(organization_id,matter_id,title,body,occurred_at,status,published_by,published_at,created_by) values($1,$2,$3,$4,$5,'published',$6,now(),$6) returning id", [workspace.organizationId, input.matterId, input.title, input.body, input.occurredAt ?? new Date().toISOString(), workspace.userId]);
      for (const clientId of input.clientIds) { const allowed = await client.query("select 1 from portal_matter_grants where client_id=$1 and matter_id=$2 and revoked_at is null and expires_at>now()", [clientId, input.matterId]); if (!allowed.rowCount) throw new ApiError(400, "Every selected client needs an active grant for this matter."); await client.query("insert into portal_milestone_audiences(organization_id,milestone_id,client_id) values($1,$2,$3)", [workspace.organizationId, milestone.rows[0].id, clientId]); }
      await audit(client, { action: "portal.milestone.publish", resourceType: "portal_milestone", resourceId: milestone.rows[0].id, outcome: "success", metadata: { recipients: input.clientIds.length, notification: "in_app_only" } }); return milestone.rows[0].id;
    }); return NextResponse.json({ data: { id, status: "published" } }, { status: 201 });
  }
  if (action === "evidence-request") {
    const input = await readJson(request, portalEvidenceInput); const id = await db(async (client) => { await requireMatter(client, workspace, input.matterId); if (!await hasMatterPermission(client, input.matterId, "edit")) throw new ApiError(403, "Matter edit permission is required."); const valid = await client.query("select 1 from portal_matter_grants where client_id=$1 and matter_id=$2 and revoked_at is null and expires_at>now()", [input.clientId, input.matterId]); if (!valid.rowCount) throw new ApiError(400, "Client access is no longer active."); const row = await client.query<{ id: string }>("insert into portal_evidence_requests(organization_id,matter_id,client_id,title,instructions,due_at,created_by) values($1,$2,$3,$4,$5,$6,$7) returning id", [workspace.organizationId, input.matterId, input.clientId, input.title, input.instructions ?? null, input.dueAt ?? null, workspace.userId]); await audit(client, { action: "portal.evidence_request.create", resourceType: "portal_evidence_request", resourceId: row.rows[0].id, outcome: "success", metadata: { matterId: input.matterId } }); return row.rows[0].id; }); return NextResponse.json({ data: { id } }, { status: 201 });
  }
  if (action === "share-document") {
    const input = await readJson(request, portalDocumentShareInput); const id = await db(async (client) => { await requireMatter(client, workspace, input.matterId); if (!await hasMatterPermission(client, input.matterId, "manage")) throw new ApiError(403, "Matter manage permission is required."); const version = await client.query("select 1 from document_versions v join documents d on d.id=v.document_id where v.id=$1 and d.matter_id=$2 and v.status='ready'", [input.documentVersionId, input.matterId]); if (!version.rowCount) throw new ApiError(400, "Only ready Vault versions from this matter can be shared."); const grant = await client.query("select 1 from portal_matter_grants where client_id=$1 and matter_id=$2 and revoked_at is null and expires_at>now()", [input.clientId, input.matterId]); if (!grant.rowCount) throw new ApiError(400, "Client access is inactive."); const row = await client.query<{ id: string }>("insert into portal_document_shares(organization_id,matter_id,document_version_id,client_id,shared_by) values($1,$2,$3,$4,$5) on conflict (document_version_id,client_id) where revoked_at is null do update set shared_at=now(),shared_by=excluded.shared_by returning id", [workspace.organizationId, input.matterId, input.documentVersionId, input.clientId, workspace.userId]); await audit(client, { action: "portal.document.share", resourceType: "document_version", resourceId: input.documentVersionId, outcome: "success", metadata: { clientId: input.clientId } }); return row.rows[0].id; }); return NextResponse.json({ data: { id } }, { status: 201 });
  }
  return NextResponse.json({ error: "Choose invite, milestone, or evidence-request." }, { status: 400 });
});
