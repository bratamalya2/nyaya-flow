import { ChartNoAxesCombined } from "lucide-react";
import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { getAnalyticsDashboard } from "@/lib/finance";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Portfolio Analytics" };
type Search = { period?: string };
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const workspace = await requireWorkspace(); const search = await searchParams; const period = Number(search.period ?? "7"); const live = !isDemoMode(); const dashboard = live ? await getAnalyticsDashboard(workspace, period) : null;
  return <div className="page"><header className="page-heading"><div><p className="eyebrow"><ChartNoAxesCombined size={13} /> Permission-safe portfolio view</p><h1>Portfolio Analytics</h1><p className="lede">Operational insight from canonical firm records. Financial data is limited to leadership and finance, with restricted matters aggregated safely.</p></div></header>{live && dashboard ? <><form action="/analytics" className="card analytics-filter" method="get"><label className="field"><span>Reporting period</span><select defaultValue={String(dashboard.periodDays)} name="period"><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option></select></label><button className="button small" type="submit">Update view</button></form><AnalyticsWorkspace dashboard={dashboard} /></> : <section className="card empty-state"><ChartNoAxesCombined size={24} /><strong>Analytics is available in a firm workspace only.</strong><p>Demo mode does not present synthetic firm performance as live data.</p></section>}</div>;
}
