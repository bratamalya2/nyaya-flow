import { NextResponse } from "next/server";
import { apiRoute, ApiError, assertUuid } from "@/lib/api";
import { contentDisposition } from "@/lib/http";

const pdfText = (value: string) => value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
function draftPdf(lines: string[]) {
  const body = lines.map((line, index) => `BT /F1 11 Tf 50 ${780 - index * 18} Td (${pdfText(line)}) Tj ET`).join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${body.length} >>\nstream\n${body}\nendstream`];
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(output.length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = output.length; output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return output;
}

export const GET = apiRoute<{ id: string }>({}, async (_request, { params, workspace, db, audit }) => {
  const invoiceId = assertUuid(params.id, "invoice");
  const invoice = await db(async (client) => {
    const result = await client.query<{ invoice_number: string; issue_date: string; total_paise: string; display_name: string; matter_title: string; lines: { description: string; amount: number }[] }>(`select i.invoice_number,i.issue_date::text,i.total_paise,a.display_name,m.title matter_title,
      coalesce((select json_agg(json_build_object('description',l.description_snapshot,'amount',l.amount_paise)) from billing_invoice_lines l where l.invoice_id=i.id),'[]'::json) lines
      from billing_invoices i join billing_accounts a on a.id=i.billing_account_id join matters m on m.id=i.matter_id where i.id=$1 and i.organization_id=$2`, [invoiceId, workspace.organizationId]);
    if (!result.rows[0]) throw new ApiError(404, "Invoice not found or access denied.");
    await audit(client, { action: "billing.invoice_draft.download", resourceType: "billing_invoice", resourceId: invoiceId, outcome: "success", metadata: { taxInvoice: false } });
    return result.rows[0];
  });
  const amount = (paise: number | string) => `INR ${(Number(paise) / 100).toFixed(2)}`;
  const lines = ["NYAYAFLOW — INVOICE DRAFT / STATEMENT", "DRAFT — VERIFY TAX AND ACCOUNTING PARTICULARS BEFORE ISSUE", `Number: ${invoice.invoice_number}`, `Date: ${invoice.issue_date}`, `Billing account: ${invoice.display_name}`, `Matter: ${invoice.matter_title}`, "", ...invoice.lines.map((line) => `${line.description}: ${amount(line.amount)}`), "", `Total: ${amount(invoice.total_paise)}`, "No payment link, UPI handle, gateway, or tax filing action is included."];
  return new NextResponse(draftPdf(lines), { headers: { "content-type": "application/pdf", "content-disposition": contentDisposition(`${invoice.invoice_number}-draft.pdf`), "cache-control": "no-store" } });
});
