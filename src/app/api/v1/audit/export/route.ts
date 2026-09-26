import { apiRoute } from "@/lib/api";
import { csvCell } from "@/lib/http";
import { LEADERSHIP_ROLES } from "@/lib/permissions";

type Row = { chain_index: string; created_at: Date; actor: string | null; action: string; resource_type: string; resource_id: string | null; outcome: string; correlation_id: string; previous_hash: string | null; chain_hash: string };

export const GET = apiRoute({ roles: LEADERSHIP_ROLES }, async (_request, { workspace, db, audit }) => {
  const rows = await db(async (client) => {
    const result = await client.query<Row>(
      `select a.chain_index, a.created_at, u.email actor, a.action, a.resource_type, a.resource_id, a.outcome, a.correlation_id, a.previous_hash, a.chain_hash
       from audit_events a left join app_users u on u.id = a.actor_id where a.organization_id = $1 order by a.chain_index`,
      [workspace.organizationId],
    );
    await audit(client, { action: "audit.export", resourceType: "organization", resourceId: workspace.organizationId, outcome: "success", metadata: { rows: result.rowCount } });
    return result.rows;
  });
  const header = ["chain_index", "created_at_utc", "actor", "action", "resource_type", "resource_id", "outcome", "correlation_id", "previous_hash", "chain_hash"];
  const lines = rows.map((row) => [row.chain_index, row.created_at.toISOString(), row.actor ?? "system", row.action, row.resource_type, row.resource_id, row.outcome, row.correlation_id, row.previous_hash, row.chain_hash].map(csvCell).join(","));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response([header.join(","), ...lines].join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nyayaflow-audit-${stamp}.csv"`, "cache-control": "private, no-store" },
  });
});
