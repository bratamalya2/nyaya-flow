import { NextResponse } from "next/server";
import { apiRoute, ApiError, readJson } from "@/lib/api";
import { EDITOR_ROLES } from "@/lib/permissions";
import { billingChargeInput } from "@/lib/validation";

export const POST = apiRoute({ roles: [...EDITOR_ROLES, "finance"] }, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, billingChargeInput);
  const id = await db(async (client) => {
    const access = await client.query<{ allowed: boolean }>("select can_access_billing_matter($1,'edit') allowed", [input.matterId]);
    if (!access.rows[0]?.allowed) throw new ApiError(404, "Matter not found or access denied.");
    let account = await client.query<{ id: string }>("select id from billing_accounts where organization_id=$1 and lower(display_name)=lower($2)", [workspace.organizationId, input.accountName]);
    if (!account.rows[0]) account = await client.query<{ id: string }>("insert into billing_accounts(organization_id,display_name,created_by) values($1,$2,$3) returning id", [workspace.organizationId, input.accountName, workspace.userId]);
    const amountPaise = Math.round(input.quantity * input.unitAmountPaise);
    const charge = await client.query<{ id: string }>(`insert into billing_charges(organization_id,matter_id,billing_account_id,charge_kind,description,occurred_on,quantity,unit_amount_paise,amount_paise,status,submitted_at,created_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted',now(),$10) returning id`, [workspace.organizationId, input.matterId, account.rows[0].id, input.kind, input.description, input.occurredOn, input.quantity, input.unitAmountPaise, amountPaise, workspace.userId]);
    await audit(client, { action: "billing.charge.submit", resourceType: "billing_charge", resourceId: charge.rows[0].id, outcome: "success", metadata: { matterId: input.matterId, kind: input.kind, amountPaise } });
    return charge.rows[0].id;
  });
  return NextResponse.json({ data: { id, status: "submitted" } }, { status: 201 });
});
