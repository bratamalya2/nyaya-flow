import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const search = new URL(request.url).searchParams.get("q")?.trim();
  if (!search || search.length < 2 || search.length > 200) return NextResponse.json({ error: "Search query must contain 2–200 characters." }, { status: 400 });
  const result = await withActor(session.userId, (client) => client.query("select * from document_search($1)", [search]));
  return NextResponse.json({ data: result.rows });
}
