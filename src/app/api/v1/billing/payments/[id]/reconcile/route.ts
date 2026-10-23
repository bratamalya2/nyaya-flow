import { NextResponse } from "next/server";
import { apiRoute, ApiError, assertUuid, readJson } from "@/lib/api";
import { isFinanceRole } from "@/lib/finance";
import { billingPaymentReconciliationInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const paymentId = assertUuid(params.id, "payment"); const input = await readJson(request, billingPaymentReconciliationInput);
  await db(async (client) => {
    const payment = await client.query<{ id: string; invoice_id: string; amount_paise: string; status: string; total_paise: string; paid_paise: string }>(`select p.id,p.invoice_id,p.amount_paise,p.status,i.total_paise,i.paid_paise
      from billing_payments p join billing_invoices i on i.id=p.invoice_id where p.id=$1 and p.organization_id=$2 for update`, [paymentId, workspace.organizationId]);
    if (!payment.rows[0]) throw new ApiError(404, "Payment not found or access denied.");
    if (payment.rows[0].status === "reconciled") throw new ApiError(409, "This payment has already been reconciled.");
    if (payment.rows[0].status !== "recorded") throw new ApiError(409, "Only recorded manual payments may be reconciled.");
    const nextPaid = Number(payment.rows[0].paid_paise) + Number(payment.rows[0].amount_paise);
    if (nextPaid > Number(payment.rows[0].total_paise)) throw new ApiError(409, "This payment would exceed the invoice balance.");
    await client.query("insert into billing_payment_reconciliations(organization_id,payment_id,reconciliation_note,reconciled_by) values($1,$2,$3,$4)", [workspace.organizationId, paymentId, input.reconciliationNote, workspace.userId]);
    await client.query("update billing_payments set status='reconciled' where id=$1", [paymentId]);
    await client.query("update billing_invoices set paid_paise=$1,status=$2 where id=$3", [nextPaid, nextPaid === Number(payment.rows[0].total_paise) ? "paid" : "partially_paid", payment.rows[0].invoice_id]);
    await audit(client, { action: "billing.payment.reconcile", resourceType: "billing_payment", resourceId: paymentId, outcome: "success", metadata: { invoiceId: payment.rows[0].invoice_id, externalProvider: false } });
  });
  return NextResponse.json({ data: { id: paymentId, status: "reconciled" } });
});
