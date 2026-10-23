import { NextResponse } from "next/server";
import { apiRoute, ApiError, readJson } from "@/lib/api";
import { isFinanceRole } from "@/lib/finance";
import { billingPaymentInput } from "@/lib/validation";

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const input = await readJson(request, billingPaymentInput);
  const id = await db(async (client) => {
    const invoice = await client.query<{ id: string; status: string }>("select id,status from billing_invoices where id=$1 and organization_id=$2", [input.invoiceId, workspace.organizationId]);
    if (!invoice.rows[0]) throw new ApiError(404, "Invoice not found or access denied.");
    if (["void", "credited", "paid"].includes(invoice.rows[0].status)) throw new ApiError(409, "This invoice cannot receive a manual payment.");
    const payment = await client.query<{ id: string }>("insert into billing_payments(organization_id,invoice_id,amount_paise,received_on,method,reference_note,recorded_by) values($1,$2,$3,$4,$5,$6,$7) returning id", [workspace.organizationId, input.invoiceId, input.amountPaise, input.receivedOn, input.method, input.referenceNote ?? null, workspace.userId]);
    await audit(client, { action: "billing.payment.record", resourceType: "billing_payment", resourceId: payment.rows[0].id, outcome: "success", metadata: { invoiceId: input.invoiceId, amountPaise: input.amountPaise, method: input.method, externalProvider: false } });
    return payment.rows[0].id;
  });
  return NextResponse.json({ data: { id, status: "recorded" } }, { status: 201 });
});
