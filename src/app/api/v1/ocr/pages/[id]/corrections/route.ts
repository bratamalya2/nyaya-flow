import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";

const schema = z.object({ correctedText: z.string().min(1).max(200_000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Correction text is invalid." }, { status: 400 });
  const { id } = await params;
  try {
    const data = await withActor(session.userId, async (client) => {
      const page = await client.query<{ organization_id: string; extracted_text: string; corrected_text: string | null }>("select organization_id,extracted_text,corrected_text from ocr_pages where id=$1 for update", [id]);
      if (!page.rows[0]) throw new Error("OCR page not found or access denied.");
      const previous = page.rows[0].corrected_text ?? page.rows[0].extracted_text;
      await client.query("insert into ocr_corrections(organization_id,ocr_page_id,previous_text,corrected_text,corrected_by) values($1,$2,$3,$4,$5)", [page.rows[0].organization_id, id, previous, parsed.data.correctedText, session.userId]);
      await client.query("update ocr_pages set corrected_text=$2 where id=$1", [id, parsed.data.correctedText]);
      await recordAudit(client, { organizationId: page.rows[0].organization_id, actorId: session.userId, action: "ocr.correct", resourceType: "ocr_page", resourceId: id, outcome: "success" });
      return { id, correctedText: parsed.data.correctedText };
    });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Correction failed." }, { status: 400 }); }
}
