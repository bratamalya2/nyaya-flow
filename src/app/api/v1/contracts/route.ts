import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { isContractsEnabled } from "@/lib/filing-contracts";
import { requireMatter } from "@/lib/matters";
import { EDITOR_ROLES } from "@/lib/permissions";
import { contractInput } from "@/lib/validation";

export const POST = apiRoute({ roles: EDITOR_ROLES }, async (request, { workspace, db, audit }) => {
  if (!isContractsEnabled()) return NextResponse.json({ error: "Contracts & CLM Beta is disabled." }, { status: 503 });
  const input = await readJson(request, contractInput);
  const id = await db(async (client) => {
    if (input.matterId) await requireMatter(client, workspace, input.matterId);
    const template = await client.query<{ id: string; title: string; version: string; body: string; source_reference: string; source_state: string; is_fixture: boolean }>("select id,title,version,body,source_reference,source_state,is_fixture from contract_templates where id=$1 and organization_id=$2 and status='approved'", [input.templateId, workspace.organizationId]);
    if (!template.rows[0]) throw new ApiError(400, "Choose an approved template with a recorded source.");
    const snapshot = { title: template.rows[0].title, version: template.rows[0].version, body: template.rows[0].body, sourceReference: template.rows[0].source_reference, sourceState: template.rows[0].source_state, isFixture: template.rows[0].is_fixture };
    const contract = await client.query<{ id: string }>("insert into contracts(organization_id,matter_id,title,counterparty,status,template_snapshot,created_by) values($1,$2,$3,$4,'review_required',$5,$6) returning id", [workspace.organizationId, input.matterId ?? null, input.title, input.counterparty, snapshot, workspace.userId]);
    const clauses = [
      ["Template provenance", "Template snapshot", "review_required", "Confirm the template version and source are suitable for this internal review. No automated legal conclusion is made."],
      ["Commercial terms", "Terms review", "review_required", "Assign a reviewer to assess the commercial terms and counterparties against firm instructions."],
      ["Execution boundary", "Execution", "no_issue", "Execution remains manual and unverified until an approved signing provider is integrated."],
    ] as const;
    for (const [label, locator, finding, note] of clauses) await client.query("insert into contract_clause_reviews(organization_id,contract_id,clause_label,source_locator,finding,note) values($1,$2,$3,$4,$5,$6)", [workspace.organizationId, contract.rows[0].id, label, locator, finding, note]);
    await audit(client, { action: "contract.create", resourceType: "contract", resourceId: contract.rows[0].id, outcome: "success", metadata: { templateId: input.templateId, matterId: input.matterId ?? null, providerAction: false } });
    return contract.rows[0].id;
  });
  return NextResponse.json({ data: { id, status: "review_required" } }, { status: 201 });
});
