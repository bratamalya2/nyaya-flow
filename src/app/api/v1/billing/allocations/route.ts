import { NextResponse } from "next/server";
import { apiRoute, ApiError, readJson } from "@/lib/api";
import { isFinanceRole } from "@/lib/finance";
import { billingAllocationInput } from "@/lib/validation";

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const input = await readJson(request, billingAllocationInput);
  const id = await db(async (client) => {
    const invoice = await client.query<{ total_paise: string; paid_paise: string; status: string }>("select total_paise,paid_paise,status from billing_invoices where id=$1 and organization_id=$2 for update", [input.invoiceId, workspace.organizationId]);
    if (!invoice.rows[0]) throw new ApiError(404, "Invoice not found or access denied.");
    if (["void", "credited", "paid"].includes(invoice.rows[0].status)) throw new ApiError(409, "This invoice cannot receive an advance allocation.");
    const allocation = await client.query<{ id: string }>("insert into billing_advance_allocations(organization_id,advance_id,invoice_id,amount_paise,allocated_by) values($1,$2,$3,$4,$5) returning id", [workspace.organizationId, input.advanceId, input.invoiceId, input.amountPaise, workspace.userId]);
    const paid = Number(invoice.rows[0].paid_paise) + input.amountPaise;
    const status = paid >= Number(invoice.rows[0].total_paise) ? "paid" : "partially_paid";
    await client.query("update billing_invoices set paid_paise=$1,status=$2 where id=$3", [paid, status, input.invoiceId]);
    await audit(client, { action: "billing.advance.allocate", resourceType: "billing_advance_allocation", resourceId: allocation.rows[0].id, outcome: "success", metadata: { invoiceId: input.invoiceId, advanceId: input.advanceId, amountPaise: input.amountPaise } });
    return allocation.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
