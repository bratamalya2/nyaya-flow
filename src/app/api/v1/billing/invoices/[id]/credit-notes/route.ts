import { NextResponse } from "next/server";
import { apiRoute, ApiError, assertUuid, readJson } from "@/lib/api";
import { isFinanceRole } from "@/lib/finance";
import { billingCreditNoteInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const invoiceId = assertUuid(params.id, "invoice"); const input = await readJson(request, billingCreditNoteInput);
  const result = await db(async (client) => {
    const invoice = await client.query<{ id: string; invoice_number: string; total_paise: string; paid_paise: string; status: string }>("select id,invoice_number,total_paise,paid_paise,status from billing_invoices where id=$1 and organization_id=$2 for update", [invoiceId, workspace.organizationId]);
    if (!invoice.rows[0]) throw new ApiError(404, "Invoice not found or access denied.");
    if (invoice.rows[0].status === "void") throw new ApiError(409, "A void invoice cannot receive a credit note.");
    const used = await client.query<{ amount: string }>("select coalesce(sum(amount_paise),0) amount from billing_credit_notes where invoice_id=$1", [invoiceId]);
    const balance = Number(invoice.rows[0].total_paise) - Number(invoice.rows[0].paid_paise) - Number(used.rows[0].amount);
    if (input.amountPaise > balance) throw new ApiError(400, "A credit note cannot exceed the remaining invoice balance.");
    const sequence = await client.query<{ last_value: number }>(`insert into billing_invoice_sequences(organization_id,last_value) values($1,1) on conflict(organization_id) do update set last_value=billing_invoice_sequences.last_value+1 returning last_value`, [workspace.organizationId]);
    const creditNumber = `CN-${new Date().getUTCFullYear()}-${String(sequence.rows[0].last_value).padStart(5, "0")}`;
    const snapshot = { label: "Credit note draft", warning: "Verify tax and accounting particulars before issue.", creditNumber, invoiceNumber: invoice.rows[0].invoice_number, amountPaise: input.amountPaise, reason: input.reason };
    const created = await client.query<{ id: string }>("insert into billing_credit_notes(organization_id,invoice_id,credit_number,amount_paise,reason,snapshot,created_by) values($1,$2,$3,$4,$5,$6,$7) returning id", [workspace.organizationId, invoiceId, creditNumber, input.amountPaise, input.reason, snapshot, workspace.userId]);
    if (input.amountPaise === balance) await client.query("update billing_invoices set status='credited' where id=$1", [invoiceId]);
    await audit(client, { action: "billing.credit_note.create", resourceType: "billing_credit_note", resourceId: created.rows[0].id, outcome: "success", metadata: { invoiceId, creditNumber, amountPaise: input.amountPaise } });
    return { id: created.rows[0].id, creditNumber };
  });
  return NextResponse.json({ data: result }, { status: 201 });
});
