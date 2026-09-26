import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";

const schema = z.object({ correctedText: z.string().min(1).max(200_000) });

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const pageId = assertUuid(params.id, "OCR page");
  const { correctedText } = await readJson(request, schema);
  const data = await db(async (client) => {
    const page = await client.query<{ organization_id: string; extracted_text: string; corrected_text: string | null }>(
      "select organization_id, extracted_text, corrected_text from ocr_pages where id = $1 and organization_id = $2 for update",
      [pageId, workspace.organizationId],
    );
    if (!page.rows[0]) throw new ApiError(404, "OCR page not found, or you need edit access to the matter.");
    const previous = page.rows[0].corrected_text ?? page.rows[0].extracted_text;
    if (previous === correctedText) throw new ApiError(400, "The text is unchanged.");
    await client.query("insert into ocr_corrections (organization_id, ocr_page_id, previous_text, corrected_text, corrected_by) values ($1,$2,$3,$4,$5)", [page.rows[0].organization_id, pageId, previous, correctedText, workspace.userId]);
    await client.query("update ocr_pages set corrected_text = $2 where id = $1", [pageId, correctedText]);
    await audit(client, { action: "ocr.correct", resourceType: "ocr_page", resourceId: pageId, outcome: "success", metadata: { length: correctedText.length } });
    return { id: pageId, correctedText };
  });
  return NextResponse.json({ data });
});
