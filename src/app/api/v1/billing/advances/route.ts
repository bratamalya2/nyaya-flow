import { NextResponse } from "next/server";
import { apiRoute, ApiError, readJson } from "@/lib/api";
import { isFinanceRole } from "@/lib/finance";
import { billingAdvanceInput } from "@/lib/validation";

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const input = await readJson(request, billingAdvanceInput);
  const id = await db(async (client) => {
    const account = await client.query<{ id: string }>("select id from billing_accounts where organization_id=$1 and lower(display_name)=lower($2)", [workspace.organizationId, input.accountName]);
    if (!account.rows[0]) throw new ApiError(400, "Create a charge for this billing account before recording an advance.");
    const inserted = await client.query<{ id: string }>("insert into billing_advances(organization_id,billing_account_id,received_on,amount_paise,reference_note,created_by) values($1,$2,$3,$4,$5,$6) returning id", [workspace.organizationId, account.rows[0].id, input.receivedOn, input.amountPaise, input.referenceNote ?? null, workspace.userId]);
    await audit(client, { action: "billing.advance.record", resourceType: "billing_advance", resourceId: inserted.rows[0].id, outcome: "success", metadata: { amountPaise: input.amountPaise } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
