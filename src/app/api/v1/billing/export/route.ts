import { NextResponse } from "next/server";
import { apiRoute, ApiError } from "@/lib/api";
import { formatInr, isFinanceRole, listBillingInvoices } from "@/lib/finance";
import { contentDisposition, csvCell } from "@/lib/http";

export const GET = apiRoute({}, async (_request, { workspace, db, audit }) => {
  if (!isFinanceRole(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const invoices = await listBillingInvoices(workspace);
  const csv = [["Invoice draft", "Matter", "Billing account", "Issue date", "Status", "Total", "Paid", "Balance"], ...invoices.map((invoice) => [invoice.number, invoice.matterTitle, invoice.accountName, invoice.issueDate, invoice.status, formatInr(invoice.totalPaise), formatInr(invoice.paidPaise), formatInr(invoice.balancePaise)])].map((row) => row.map(csvCell).join(",")).join("\n");
  await db((client) => audit(client, { action: "billing.export.csv", resourceType: "billing_export", outcome: "success", metadata: { invoiceCount: invoices.length } }));
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": contentDisposition("nyayaflow-billing-drafts.csv"), "cache-control": "no-store" } });
});
