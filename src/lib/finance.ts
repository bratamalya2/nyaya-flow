import { withActor } from "@/lib/db";
import { availableAdvance, invoiceBalance } from "@/lib/finance-format";
import type { AppRole, Matter } from "@/lib/types";
import type { Workspace } from "@/lib/workspace";

export const chargeKinds = ["time", "hearing", "fixed_fee", "expense"] as const;
export const chargeStates = ["draft", "submitted", "approved", "rejected", "invoiced", "void"] as const;
export const invoiceStates = ["draft_issued", "partially_paid", "paid", "credited", "void"] as const;
export type ChargeKind = typeof chargeKinds[number];
export type ChargeState = typeof chargeStates[number];
export type InvoiceState = typeof invoiceStates[number];

export const isFinanceRole = (role: AppRole) => ["owner", "managing_partner", "admin", "finance"].includes(role);
export const canApproveCharges = isFinanceRole;

export function canTransitionCharge(from: ChargeState, to: ChargeState) {
  return ({
    draft: ["submitted", "void"], submitted: ["approved", "rejected", "void"], approved: ["invoiced", "void"],
    rejected: ["draft", "void"], invoiced: [], void: [],
  } as Record<ChargeState, ChargeState[]>)[from].includes(to);
}

export { availableAdvance, formatInr, inrToPaise, invoiceBalance, paiseToInr } from "@/lib/finance-format";

export type BillingCharge = {
  id: string; matterId: string; matterTitle: string; matterReference: string; accountName: string; kind: ChargeKind; description: string;
  occurredOn: string; quantity: number; unitAmountPaise: number; amountPaise: number; status: ChargeState; rejectionReason: string | null;
};
export type BillingAdvance = { id: string; accountId: string; accountName: string; receivedOn: string; amountPaise: number; allocatedPaise: number; availablePaise: number; referenceNote: string | null };
export type BillingInvoice = {
  id: string; number: string; matterId: string; matterTitle: string; accountName: string; issueDate: string; status: InvoiceState; totalPaise: number; paidPaise: number; creditedPaise: number; balancePaise: number;
  lines: { id: string; description: string; amountPaise: number }[]; payments: { id: string; amountPaise: number; receivedOn: string; method: "cash" | "bank"; status: string; referenceNote: string | null }[];
};
export type FinanceSummary = { approvedPaise: number; invoicedPaise: number; collectedPaise: number; outstandingPaise: number; advancePaise: number };
export type AnalyticsDashboard = {
  periodDays: number;
  operations: { activeMatters: number; nextPeriodHearings: number; overdueTasks: number; staleSources: number; matterStates: { label: string; count: number }[]; forums: { label: string; count: number }[]; workload: { name: string; role: string; openTasks: number; upcomingHearings: number }[] };
  finance: FinanceSummary | null;
};

export async function listBillingCharges(workspace: Workspace): Promise<BillingCharge[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{
    id: string; matter_id: string; title: string; reference: string; display_name: string; charge_kind: ChargeKind; description: string; occurred_on: string; quantity: string; unit_amount_paise: string; amount_paise: string; status: ChargeState; rejection_reason: string | null;
  }>(`select c.id,c.matter_id,m.title,m.reference,a.display_name,c.charge_kind,c.description,c.occurred_on::text,c.quantity,c.unit_amount_paise,c.amount_paise,c.status,c.rejection_reason
      from billing_charges c join matters m on m.id=c.matter_id join billing_accounts a on a.id=c.billing_account_id
      where c.organization_id=$1 order by c.occurred_on desc,c.created_at desc limit 200`, [workspace.organizationId]));
  return result.rows.map((row) => ({ id: row.id, matterId: row.matter_id, matterTitle: row.title, matterReference: row.reference, accountName: row.display_name, kind: row.charge_kind, description: row.description, occurredOn: row.occurred_on, quantity: Number(row.quantity), unitAmountPaise: Number(row.unit_amount_paise), amountPaise: Number(row.amount_paise), status: row.status, rejectionReason: row.rejection_reason }));
}

export async function listBillingAdvances(workspace: Workspace): Promise<BillingAdvance[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{
    id: string; billing_account_id: string; display_name: string; received_on: string; amount_paise: string; allocated_paise: string; reference_note: string | null;
  }>(`select a.id,a.billing_account_id,b.display_name,a.received_on::text,a.amount_paise,coalesce(sum(x.amount_paise),0) allocated_paise,a.reference_note
      from billing_advances a join billing_accounts b on b.id=a.billing_account_id left join billing_advance_allocations x on x.advance_id=a.id
      where a.organization_id=$1 group by a.id,b.display_name order by a.received_on desc,a.created_at desc limit 200`, [workspace.organizationId]));
  return result.rows.map((row) => ({ id: row.id, accountId: row.billing_account_id, accountName: row.display_name, receivedOn: row.received_on, amountPaise: Number(row.amount_paise), allocatedPaise: Number(row.allocated_paise), availablePaise: availableAdvance(Number(row.amount_paise), Number(row.allocated_paise)), referenceNote: row.reference_note }));
}

export async function listBillingInvoices(workspace: Workspace): Promise<BillingInvoice[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{
    id: string; invoice_number: string; matter_id: string; matter_title: string; display_name: string; issue_date: string; status: InvoiceState; total_paise: string; paid_paise: string; credited_paise: string;
    lines: { id: string; description: string; amountPaise: number }[] | null; payments: { id: string; amountPaise: number; receivedOn: string; method: "cash" | "bank"; status: string; referenceNote: string | null }[] | null;
  }>(`select i.id,i.invoice_number,i.matter_id,m.title matter_title,a.display_name,i.issue_date::text,i.status,i.total_paise,i.paid_paise,
      coalesce((select sum(n.amount_paise) from billing_credit_notes n where n.invoice_id=i.id),0) credited_paise,
      coalesce((select json_agg(json_build_object('id',l.id,'description',l.description_snapshot,'amountPaise',l.amount_paise) order by l.id) from billing_invoice_lines l where l.invoice_id=i.id),'[]'::json) lines,
      coalesce((select json_agg(json_build_object('id',p.id,'amountPaise',p.amount_paise,'receivedOn',p.received_on::text,'method',p.method,'status',p.status,'referenceNote',p.reference_note) order by p.created_at desc) from billing_payments p where p.invoice_id=i.id),'[]'::json) payments
      from billing_invoices i join matters m on m.id=i.matter_id join billing_accounts a on a.id=i.billing_account_id
      where i.organization_id=$1 order by i.issue_date desc,i.created_at desc limit 200`, [workspace.organizationId]));
  return result.rows.map((row) => { const totalPaise = Number(row.total_paise); const paidPaise = Number(row.paid_paise); const creditedPaise = Number(row.credited_paise); return { id: row.id, number: row.invoice_number, matterId: row.matter_id, matterTitle: row.matter_title, accountName: row.display_name, issueDate: row.issue_date, status: row.status, totalPaise, paidPaise, creditedPaise, balancePaise: invoiceBalance(totalPaise, paidPaise, creditedPaise), lines: row.lines ?? [], payments: row.payments ?? [] }; });
}

export async function getFinanceSummary(workspace: Workspace): Promise<FinanceSummary | null> {
  if (!isFinanceRole(workspace.role)) return null;
  const result = await withActor(workspace.userId, (client) => client.query<{ approved_paise: string; invoiced_paise: string; collected_paise: string; outstanding_paise: string; advance_paise: string }>("select * from finance_aggregate_summary($1)", [workspace.organizationId]));
  const row = result.rows[0];
  return row ? { approvedPaise: Number(row.approved_paise), invoicedPaise: Number(row.invoiced_paise), collectedPaise: Number(row.collected_paise), outstandingPaise: Number(row.outstanding_paise), advancePaise: Number(row.advance_paise) } : null;
}

export async function getAnalyticsDashboard(workspace: Workspace, requestedPeriodDays = 7): Promise<AnalyticsDashboard> {
  const periodDays = [7, 30, 90].includes(requestedPeriodDays) ? requestedPeriodDays : 7;
  const [counts, states, forums, workload, finance] = await Promise.all([
    withActor(workspace.userId, (client) => client.query<{ active_matters: string; next_period_hearings: string; overdue_tasks: string; stale_sources: string }>(`select
      (select count(*) from matters where organization_id=$1 and status='active') active_matters,
      (select count(*) from hearings where organization_id=$1 and starts_at>=now() and starts_at<now()+($2::int * interval '1 day') and status in ('proposed','confirmed')) next_period_hearings,
      (select count(*) from tasks where organization_id=$1 and state in ('open','in_progress') and due_at<now()) overdue_tasks,
      (select count(*) from matters where organization_id=$1 and source_state='stale') stale_sources`, [workspace.organizationId, periodDays])),
    withActor(workspace.userId, (client) => client.query<{ label: string; count: string }>("select status label,count(*) count from matters where organization_id=$1 group by status order by status", [workspace.organizationId])),
    withActor(workspace.userId, (client) => client.query<{ label: string; count: string }>("select forum label,count(*) count from matters where organization_id=$1 group by forum order by count(*) desc,forum limit 8", [workspace.organizationId])),
    withActor(workspace.userId, (client) => client.query<{ name: string; role: AppRole; open_tasks: string; upcoming_hearings: string }>(`select u.display_name name,ms.role,
      count(distinct t.id) filter(where t.state in ('open','in_progress')) open_tasks,
      count(distinct h.id) upcoming_hearings
      from memberships ms join app_users u on u.id=ms.user_id
      left join tasks t on t.assignee_id=u.id and t.organization_id=ms.organization_id
      left join hearings h on h.advocate_id=u.id and h.organization_id=ms.organization_id and h.starts_at>=now() and h.starts_at<now()+($2::int * interval '1 day') and h.status in ('proposed','confirmed')
      where ms.organization_id=$1 and ms.active group by u.display_name,ms.role order by open_tasks desc,upcoming_hearings desc,u.display_name limit 12`, [workspace.organizationId, periodDays])),
    getFinanceSummary(workspace),
  ]);
  const row = counts.rows[0] ?? { active_matters: "0", next_period_hearings: "0", overdue_tasks: "0", stale_sources: "0" };
  return { periodDays, operations: { activeMatters: Number(row.active_matters), nextPeriodHearings: Number(row.next_period_hearings), overdueTasks: Number(row.overdue_tasks), staleSources: Number(row.stale_sources), matterStates: states.rows.map((item) => ({ label: item.label, count: Number(item.count) })), forums: forums.rows.map((item) => ({ label: item.label, count: Number(item.count) })), workload: workload.rows.map((item) => ({ name: item.name, role: item.role, openTasks: Number(item.open_tasks), upcomingHearings: Number(item.upcoming_hearings) })) }, finance };
}

export type BillingMatter = Pick<Matter, "id" | "title" | "reference" | "client">;
