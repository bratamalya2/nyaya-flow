import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { canTransitionContract, isContractsEnabled } from "@/lib/filing-contracts";
import { hasMatterPermission } from "@/lib/matters";
import { clauseReviewUpdate, contractApprovalInput, contractExecutionInput } from "@/lib/validation";

async function load(client: import("pg").PoolClient, organizationId: string, id: string) {
  const contract = await client.query<{ id: string; matter_id: string | null; status: "draft" | "review_required" | "approved" | "executed" | "blocked" }>("select id,matter_id,status from contracts where id=$1 and organization_id=$2 for update", [id, organizationId]);
  if (!contract.rows[0]) throw new ApiError(404, "Contract not found.");
  return contract.rows[0];
}
async function editable(client: import("pg").PoolClient, matterId: string | null) {
  return !matterId || await hasMatterPermission(client, matterId, "edit");
}

export const PATCH = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  if (!isContractsEnabled()) return NextResponse.json({ error: "Contracts & CLM Beta is disabled." }, { status: 503 });
  const id = assertUuid(params.id, "contract"); const input = await readJson(request, clauseReviewUpdate.extend({ clauseId: z.uuid() }));
  await db(async (client) => {
    const contract = await load(client, workspace.organizationId, id); if (!await editable(client, contract.matter_id)) throw new ApiError(403, "Matter edit permission is required.");
    const clause = await client.query("update contract_clause_reviews set review_state=$1,note=coalesce($2,note),assigned_to=$3,reviewed_by=case when $1 in ('reviewed','dismissed') then $4 else reviewed_by end,reviewed_at=case when $1 in ('reviewed','dismissed') then now() else reviewed_at end where id=$5 and contract_id=$6 and organization_id=$7 returning id", [input.reviewState, input.note ?? null, input.assignedTo ?? null, workspace.userId, input.clauseId, id, workspace.organizationId]);
    if (!clause.rowCount) throw new ApiError(404, "Clause review not found.");
    await audit(client, { action: "contract.clause_review.update", resourceType: "contract", resourceId: id, outcome: "success", metadata: { clauseId: input.clauseId, reviewState: input.reviewState } });
  });
  return NextResponse.json({ data: { ok: true } });
});

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  if (!isContractsEnabled()) return NextResponse.json({ error: "Contracts & CLM Beta is disabled." }, { status: 503 });
  const id = assertUuid(params.id, "contract"); const action = new URL(request.url).searchParams.get("action");
  if (action === "approve") {
    const input = await readJson(request, contractApprovalInput);
    await db(async (client) => {
      const contract = await load(client, workspace.organizationId, id);
      if (contract.matter_id ? !(await hasMatterPermission(client, contract.matter_id, "manage")) : !["owner", "managing_partner", "admin"].includes(workspace.role)) throw new ApiError(403, "Managing authority is required to approve a contract.");
      const openHigh = await client.query("select 1 from contract_clause_reviews where contract_id=$1 and finding='high_risk' and review_state not in ('reviewed','dismissed')", [id]);
      if (input.decision === "approved" && openHigh.rowCount) throw new ApiError(409, "Resolve or dismiss high-risk review items before approval.");
      const next = input.decision === "approved" ? "approved" : "blocked"; if (!canTransitionContract(contract.status, next)) throw new ApiError(409, "This contract cannot transition from its current state.");
      await client.query("insert into contract_approvals(organization_id,contract_id,decision,note,decided_by) values($1,$2,$3,$4,$5)", [workspace.organizationId, id, input.decision, input.note ?? null, workspace.userId]);
      await client.query("update contracts set status=$1 where id=$2", [next, id]);
      await audit(client, { action: `contract.${input.decision}`, resourceType: "contract", resourceId: id, outcome: "success", metadata: { externalSigning: false } });
    });
    return NextResponse.json({ data: { ok: true } });
  }
  if (action === "execution") {
    const input = await readJson(request, contractExecutionInput);
    await db(async (client) => {
      const contract = await load(client, workspace.organizationId, id); if (!await editable(client, contract.matter_id)) throw new ApiError(403, "Matter edit permission is required.");
      if (!canTransitionContract(contract.status, "executed")) throw new ApiError(409, "Only an approved contract can receive a manual execution record.");
      await client.query("insert into contract_executions(organization_id,contract_id,method,status,reference_note,recorded_by) values($1,$2,'manual',$3,$4,$5) on conflict(contract_id) do update set status=excluded.status,reference_note=excluded.reference_note,recorded_by=excluded.recorded_by,recorded_at=now()", [workspace.organizationId, id, input.status, input.referenceNote ?? null, workspace.userId]);
      await client.query("update contracts set status='executed' where id=$1", [id]);
      await audit(client, { action: "contract.execution.manual_record", resourceType: "contract", resourceId: id, outcome: "success", metadata: { status: input.status, externalProvider: false } });
    });
    return NextResponse.json({ data: { ok: true, method: "manual" } });
  }
  return NextResponse.json({ error: "External signing, e-stamping, and provider actions are unavailable in this internal beta." }, { status: 409 });
});
