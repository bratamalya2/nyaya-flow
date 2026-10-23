import { NextResponse } from "next/server";
import { apiRoute, ApiError, readJson } from "@/lib/api";
import { isFinanceRole } from "@/lib/finance";
import { billingInvoiceInput } from "@/lib/validation";

async function nextNumber(client: import("pg").PoolClient, organizationId: string, prefix: "NF" | "CN") {
  const sequence = await client.query<{ last_value: number }>(`insert into billing_invoice_sequences(organization_id,last_value) values($1,1)
    on conflict(organization_id) do update set last_value=billing_invoice_sequences.last_value+1 returning last_value`, [organizationId]);
  return `${prefix}-${new Date().getUTCFullYear()}-${String(sequence.rows[0].last_value).padStart(5, "0")}`;
}

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const input = await readJson(request, billingInvoiceInput);
  const data = await db(async (client) => {
    const charges = await client.query<{ id: string; matter_id: string; billing_account_id: string; description: string; amount_paise: string; status: string }>("select id,matter_id,billing_account_id,description,amount_paise,status from billing_charges where organization_id=$1 and id=any($2::uuid[]) for update", [workspace.organizationId, input.chargeIds]);
    if (charges.rows.length !== new Set(input.chargeIds).size || charges.rows.some((charge) => charge.status !== "approved")) throw new ApiError(400, "Choose only approved, uninvoiced charges you may access.");
    const first = charges.rows[0];
    if (charges.rows.some((charge) => charge.matter_id !== first.matter_id || charge.billing_account_id !== first.billing_account_id)) throw new ApiError(400, "An invoice may contain charges from one matter and billing account only.");
    const totalPaise = charges.rows.reduce((total, charge) => total + Number(charge.amount_paise), 0);
    const invoiceNumber = await nextNumber(client, workspace.organizationId, "NF");
    const snapshot = { label: "Invoice draft / statement", warning: "Verify tax and accounting particulars before issue.", invoiceNumber, issuedAt: new Date().toISOString(), lines: charges.rows.map((charge) => ({ chargeId: charge.id, description: charge.description, amountPaise: Number(charge.amount_paise) })) };
    const invoice = await client.query<{ id: string }>("insert into billing_invoices(organization_id,matter_id,billing_account_id,invoice_number,issue_date,total_paise,snapshot,created_by) values($1,$2,$3,$4,current_date,$5,$6,$7) returning id", [workspace.organizationId, first.matter_id, first.billing_account_id, invoiceNumber, totalPaise, snapshot, workspace.userId]);
    for (const charge of charges.rows) await client.query("insert into billing_invoice_lines(organization_id,invoice_id,charge_id,description_snapshot,amount_paise) values($1,$2,$3,$4,$5)", [workspace.organizationId, invoice.rows[0].id, charge.id, charge.description, charge.amount_paise]);
    await client.query("update billing_charges set status='invoiced' where id=any($1::uuid[])", [input.chargeIds]);
    await audit(client, { action: "billing.invoice_draft.issue", resourceType: "billing_invoice", resourceId: invoice.rows[0].id, outcome: "success", metadata: { invoiceNumber, matterId: first.matter_id, chargeCount: charges.rows.length, totalPaise, taxInvoice: false } });
    return { id: invoice.rows[0].id, invoiceNumber };
  });
  return NextResponse.json({ data }, { status: 201 });
});
