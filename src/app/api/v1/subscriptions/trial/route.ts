import { NextResponse } from "next/server";
import { apiRoute, ApiError } from "@/lib/api";
import { requireAppPermission } from "@/lib/operations";
import { createTrial } from "@/lib/subscriptions";
export const POST = apiRoute({},async(_request,{workspace,db,audit})=>{const id=await db(async client=>{await requireAppPermission(client,workspace.organizationId,"manage_subscription");const existing=await client.query(`select 1 from organization_subscriptions where organization_id=$1`,[workspace.organizationId]);if(existing.rowCount)throw new ApiError(409,"This organization already has a subscription history.");const subscriptionId=await createTrial(client,{organizationId:workspace.organizationId,userId:workspace.userId});await audit(client,{action:"subscription.trial_started",resourceType:"organization_subscription",resourceId:subscriptionId,outcome:"success",metadata:{days:14}});return subscriptionId;});return NextResponse.json({data:{id}}, {status:201});});
