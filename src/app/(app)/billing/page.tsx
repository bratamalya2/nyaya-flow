import { ReceiptIndianRupee } from "lucide-react";
import { BillingWorkspace } from "@/components/billing-workspace";
import { isFinanceRole, listBillingAdvances, listBillingCharges, listBillingInvoices } from "@/lib/finance";
import { listMatters } from "@/lib/repositories/workspace";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Finance & Billing" };

export default async function BillingPage() {
  const workspace = await requireWorkspace();
  const live = !isDemoMode();
  const [matters, charges, advances, invoices] = live ? await Promise.all([listMatters(workspace), listBillingCharges(workspace), listBillingAdvances(workspace), listBillingInvoices(workspace)]) : [[], [], [], []];
  return <div className="page"><header className="page-heading"><div><p className="eyebrow"><ReceiptIndianRupee size={13} /> Internal manual ledger</p><h1>Finance & Billing</h1><p className="lede">Record, approve, reconcile, and export a defensible internal fee ledger. Payment providers, tax filing, and compliance claims are intentionally unavailable.</p></div><span className={`policy-state ${live ? "" : "warning"}`}>{live ? "Manual-only beta" : "Firm workspace required"}</span></header>{live ? <BillingWorkspace advances={advances} canManageFinance={isFinanceRole(workspace.role)} charges={charges} invoices={invoices} matters={matters.map(({ id, title, reference, client }) => ({ id, title, reference, client }))} /> : <section className="card empty-state"><ReceiptIndianRupee size={24} /><strong>Finance is available in a firm workspace only.</strong><p>Demo mode does not generate fictional billing data or financial records.</p></section>}</div>;
}
