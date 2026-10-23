import { NextResponse } from "next/server";
import { ApiError, publicRoute, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { withPortalClient } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { portalDataRequestInput } from "@/lib/validation";
export const POST = publicRoute(async (request) => { const session = await getPortalSession(); if (!session) throw new ApiError(401, "Client portal sign-in required."); const input = await readJson(request, portalDataRequestInput); const id = await withPortalClient(session.clientId, async (client) => { const row = await client.query<{ id: string }>("insert into data_requests(organization_id,requester_reference,request_type,portal_client_id,created_by) values($1,$2,$3,$4,$5) returning id", [session.organizationId, `Portal client ${session.clientId}`, input.requestType, session.clientId, session.userId]); await recordAudit(client, { organizationId: session.organizationId, actorId: session.userId, action: "portal.data_request.create", resourceType: "data_request", resourceId: row.rows[0].id, outcome: "success" }); return row.rows[0].id; }); return NextResponse.json({ data: { id } }, { status: 201 }); });
