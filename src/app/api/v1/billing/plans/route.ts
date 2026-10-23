import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";

export const GET = apiRoute({}, async (_request, { db }) => {
  const data = await db(async (client) => (await client.query(
    `select p.id,p.code,p.display_name,p.description,p.limits,p.features,json_agg(json_build_object('id',pp.id,'interval',pp.interval,'amountPaise',pp.amount_paise,'currency',pp.currency,'gstInclusive',pp.gst_inclusive) order by pp.amount_paise) as prices
     from plan_catalog p join plan_prices pp on pp.plan_id=p.id where p.active_to is null and pp.active_to is null group by p.id order by case p.code when 'trial' then 0 when 'solo' then 1 when 'firm' then 2 when 'professional' then 3 else 4 end`,
  )).rows);
  return NextResponse.json({ data });
});
