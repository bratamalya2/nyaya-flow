import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { findDuplicateMatters } from "@/lib/repositories/workspace";
import { matters as demoMatters } from "@/lib/sample-data";
import { cnrInput } from "@/lib/validation";
import type { Matter } from "@/lib/types";

function criteria(request: Request) {
  const params = new URL(request.url).searchParams;
  const cnr = cnrInput.safeParse(params.get("cnr") ?? undefined);
  return { cnr: cnr.success ? cnr.data : undefined, reference: params.get("reference")?.trim() || undefined, forum: params.get("forum")?.trim() || undefined };
}
const summary = (matter: Matter) => ({ id: matter.id, title: matter.title, reference: matter.reference, cnr: matter.cnr, forum: matter.forum });

export const GET = apiRoute({
  demo: async (request) => {
    const { cnr, reference } = criteria(request);
    const found = demoMatters.filter((matter) => (cnr && matter.cnr === cnr) || (reference && matter.reference.toLowerCase() === reference.toLowerCase()));
    return NextResponse.json({ data: found.map(summary), mode: "demo" });
  },
}, async (request, { workspace }) => {
  const input = criteria(request);
  if (!input.cnr && !input.reference) return NextResponse.json({ data: [] });
  return NextResponse.json({ data: (await findDuplicateMatters(workspace, input)).map(summary) });
});
