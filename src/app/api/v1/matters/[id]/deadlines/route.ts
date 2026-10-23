import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson, ApiError } from "@/lib/api";
import { calculateDeadline } from "@/lib/deadlines";
import { requireMatter } from "@/lib/matters";
import { requireAppPermission } from "@/lib/operations";
import { matterDeadlineInput } from "@/lib/validation";

export const GET = apiRoute<{ id: string }>({}, async (_request, { params, workspace, db }) => {
  const matterId = assertUuid(params.id, "matter");
  const data = await db(async (client) => {
    await requireMatter(client, workspace, matterId);
    return (await client.query(`select d.*,v.version as rule_version,r.name as rule_name from matter_deadlines d left join deadline_rule_versions v on v.id=d.deadline_rule_version_id left join deadline_rules r on r.id=v.deadline_rule_id where d.matter_id=$1 order by d.due_on`, [matterId])).rows;
  });
  return NextResponse.json({ data });
});

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const input = await readJson(request, matterDeadlineInput);
  const id = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId);
    await requireAppPermission(client, matter.organization_id, "manage_deadlines");
    let dueOn = input.dueOn;
    let calculation: Record<string, unknown> = { assumptions: input.assumptions, source: input.deadlineRuleVersionId ? "configured_rule" : "manual" };
    if (!dueOn && input.deadlineRuleVersionId && input.triggerOn) {
      const rule = await client.query<{ days_after: number; business_days: boolean; excluded_weekdays: number[]; version: number; deadline_rule_id: string }>(`select days_after,business_days,excluded_weekdays,version,deadline_rule_id from deadline_rule_versions where id=$1 and organization_id=$2`, [input.deadlineRuleVersionId,matter.organization_id]);
      if (!rule.rows[0]) throw new ApiError(404, "Deadline rule version not found.");
      dueOn = calculateDeadline(input.triggerOn, { daysAfter: rule.rows[0].days_after, businessDays: rule.rows[0].business_days, excludedWeekdays: rule.rows[0].excluded_weekdays });
      calculation = { ...calculation, triggerOn: input.triggerOn, ruleVersion: rule.rows[0].version, daysAfter: rule.rows[0].days_after, businessDays: rule.rows[0].business_days, excludedWeekdays: rule.rows[0].excluded_weekdays };
    }
    if (!dueOn) throw new ApiError(400, "A due date could not be calculated.");
    const deadline = await client.query<{ id: string }>(`insert into matter_deadlines(organization_id,matter_id,deadline_rule_version_id,title,trigger_on,due_on,calculation,risk_level,assigned_to,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`, [matter.organization_id,matterId,input.deadlineRuleVersionId ?? null,input.title,input.triggerOn ?? null,dueOn,JSON.stringify(calculation),input.riskLevel,input.assignedTo ?? null,workspace.userId]);
    await client.query(`insert into deadline_revisions(organization_id,matter_deadline_id,version,snapshot,reason,changed_by) values($1,$2,1,$3,'created',$4)`, [matter.organization_id,deadline.rows[0].id,JSON.stringify({ ...input, dueOn, calculation }),workspace.userId]);
    await audit(client, { action: "deadline.create", resourceType: "matter_deadline", resourceId: deadline.rows[0].id, outcome: "success", metadata: { matterId, dueOn, source: calculation.source } });
    return deadline.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
