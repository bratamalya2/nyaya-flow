import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordAudit } from "@/lib/audit";
import { withActor } from "@/lib/db";
import { hasDatabase, ids, ownerPool, seed, workerPool } from "./fixtures";

const failure = async (operation: Promise<unknown>) => {
  try {
    await operation;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
  return null;
};

const visibleMatters = async (userId: string) =>
  (await withActor(userId, (client) => client.query<{ id: string }>("select id from matters"))).rows.map((row) => row.id);

describe.skipIf(!hasDatabase)("PostgreSQL row-level security", () => {
  let owner: Pool;
  let worker: Pool;

  beforeAll(async () => {
    owner = ownerPool();
    worker = workerPool();
    await seed(owner);
  });

  afterAll(async () => {
    await owner?.end();
    await worker?.end();
    await (await import("@/lib/db")).dbPool().end();
  });

  it("isolates tenants", async () => {
    expect(await visibleMatters(ids.advocateA)).not.toContain(ids.openMatterB);
    expect(await visibleMatters(ids.ownerB)).toEqual([ids.openMatterB]);
  });

  it("limits restricted matters to leadership and unexpired grants", async () => {
    for (const user of [ids.ownerA, ids.partnerA, ids.adminA, ids.granteeA]) expect(await visibleMatters(user)).toContain(ids.restrictedMatterA);
    for (const user of [ids.advocateA, ids.associateA, ids.paralegalA, ids.financeA, ids.expiredGranteeA]) expect(await visibleMatters(user)).not.toContain(ids.restrictedMatterA);
  });

  it("applies the role matrix to non-restricted matters", async () => {
    const rename = (user: string) => withActor(user, (client) => client.query("update matters set stage='Arguments' where id=$1", [ids.openMatterA]));
    expect((await rename(ids.paralegalA)).rowCount).toBe(1);
    expect((await rename(ids.financeA)).rowCount).toBe(0);

    const hold = (user: string) => withActor(user, (client) => client.query("insert into legal_holds(organization_id,matter_id,reason,created_by) values ($1,$2,'Pending appeal',$3)", [ids.orgA, ids.openMatterA, user]));
    expect(await failure(hold(ids.paralegalA))).toBe("42501");
    expect(await failure(hold(ids.partnerA))).toBeNull();
    const release = await withActor(ids.advocateA, (client) => client.query("update legal_holds set active=false where matter_id=$1", [ids.openMatterA]));
    expect(release.rowCount).toBe(0);

    const grant = (user: string) => withActor(user, (client) => client.query("insert into matter_grants(organization_id,matter_id,user_id,permission,granted_by) values ($1,$2,$3,'manage',$4)", [ids.orgA, ids.openMatterA, user, user]));
    expect(await failure(grant(ids.associateA))).toBe("42501");
  });

  it("lets editors create matters and read them back in the same statement", async () => {
    const created = await withActor(ids.associateA, (client) => client.query<{ id: string }>(
      "insert into matters(organization_id,title,reference,forum,client_name,created_by,lead_id) values ($1,'Associate matter','A/1','Forum','Client',$2,$2) returning id",
      [ids.orgA, ids.associateA],
    ));
    expect(created.rows[0].id).toBeTruthy();
    const restricted = await withActor(ids.partnerA, (client) => client.query<{ id: string }>(
      "insert into matters(organization_id,title,reference,forum,client_name,restricted,created_by,lead_id) values ($1,'Partner restricted','R/9','Forum','Client',true,$2,$2) returning id",
      [ids.orgA, ids.partnerA],
    ));
    expect(await visibleMatters(ids.associateA)).not.toContain(restricted.rows[0].id);
  });

  it("stops finance from creating matters and rejects cross-organization rows", async () => {
    const create = withActor(ids.financeA, (client) => client.query("insert into matters(organization_id,title,reference,forum,client_name,created_by) values ($1,'Finance matter','X/1','Forum','Client',$2)", [ids.orgA, ids.financeA]));
    expect(await failure(create)).toBe("42501");
    const crossOrg = withActor(ids.ownerB, (client) => client.query("insert into tasks(organization_id,matter_id,title,created_by) values ($1,$2,'Cross org',$3)", [ids.orgB, ids.openMatterA, ids.ownerB]));
    expect(await failure(crossOrg)).not.toBeNull();
    const nonMemberAdvocate = withActor(ids.partnerA, (client) => client.query("insert into hearings(organization_id,matter_id,advocate_id,forum,starts_at,ends_at,created_by) values ($1,$2,$3,'Forum',now(),now()+interval '1 hour',$4)", [ids.orgA, ids.openMatterA, ids.ownerB, ids.partnerA]));
    expect(await failure(nonMemberAdvocate)).toBe("42501");
  });

  it("requires manage permission to change a matter's restriction", async () => {
    await owner.query("insert into matter_grants(organization_id,matter_id,user_id,permission,granted_by) values ($1,$2,$3,'edit',$4) on conflict do nothing", [ids.orgA, ids.restrictedMatterA, ids.granteeA, ids.partnerA]);
    const unrestrict = withActor(ids.granteeA, (client) => client.query("update matters set restricted=false where id=$1", [ids.restrictedMatterA]));
    expect(await failure(unrestrict)).toBe("42501");
    const rename = await withActor(ids.granteeA, (client) => client.query("update matters set stage='Evidence' where id=$1", [ids.restrictedMatterA]));
    expect(rename.rowCount).toBe(1);
    const move = withActor(ids.partnerA, (client) => client.query("update matters set organization_id=$2 where id=$1", [ids.openMatterA, ids.orgB]));
    expect(await failure(move)).not.toBeNull();
    await owner.query("delete from matter_grants where user_id=$1 and permission='edit'", [ids.granteeA]);
  });

  it("prevents admins from creating or promoting owners", async () => {
    const promote = withActor(ids.adminA, (client) => client.query("update memberships set role='owner' where user_id=$1 and organization_id=$2", [ids.adminA, ids.orgA]));
    expect(await failure(promote)).toBe("42501");
    const demoteOwner = await withActor(ids.adminA, (client) => client.query("update memberships set role='paralegal' where user_id=$1", [ids.ownerA]));
    expect(demoteOwner.rowCount).toBe(0);
    const ownerPromotes = await withActor(ids.ownerA, (client) => client.query("update memberships set role='managing_partner' where user_id=$1", [ids.adminA]));
    expect(ownerPromotes.rowCount).toBe(1);
    await withActor(ids.ownerA, (client) => client.query("update memberships set role='admin' where user_id=$1", [ids.adminA]));
  });

  it("scopes OCR corrections and search to the matter", async () => {
    const corrections = (user: string) => withActor(user, (client) => client.query("select corrected_text from ocr_corrections"));
    expect((await corrections(ids.advocateA)).rowCount).toBe(0);
    expect((await corrections(ids.partnerA)).rowCount).toBe(1);
    const search = (user: string) => withActor(user, (client) => client.query<{ version_id: string }>("select version_id from document_search($1,$2)", ["arbitration", ids.orgA]));
    expect((await search(ids.advocateA)).rows.map((row) => row.version_id)).toEqual([ids.openVersionA]);
    expect((await search(ids.partnerA)).rowCount).toBe(2);
  });

  it("lets the web role enqueue but never read jobs", async () => {
    const enqueue = withActor(ids.advocateA, (client) => client.query("insert into background_jobs(organization_id,job_type,payload) values ($1,'malware_scan','{}')", [ids.orgA]));
    expect(await failure(enqueue)).toBeNull();
    expect(await failure(withActor(ids.advocateA, (client) => client.query("select * from background_jobs")))).toBe("42501");
    expect(await failure(withActor(ids.advocateA, (client) => client.query("select * from claim_background_job('web')")))).toBe("42501");
    const claimed = await worker.query("select * from claim_background_job('test-worker')");
    expect(claimed.rowCount).toBe(1);
    expect(await failure(worker.query("delete from ocr_pages where false"))).toBeNull();
  });

  it("chains audit events from any member and detects tampering", async () => {
    await withActor(ids.paralegalA, async (client) => {
      await recordAudit(client, { organizationId: ids.orgA, actorId: ids.paralegalA, action: "test.one", resourceType: "matter", outcome: "success" });
      await recordAudit(client, { organizationId: ids.orgA, actorId: ids.paralegalA, action: "test.two", resourceType: "matter", outcome: "success" });
    });
    await withActor(ids.advocateA, (client) => recordAudit(client, { organizationId: ids.orgA, actorId: ids.advocateA, action: "test.three", resourceType: "matter", outcome: "success", metadata: { note: "हिंदी" } }));
    const spoofed = withActor(ids.advocateA, (client) => recordAudit(client, { organizationId: ids.orgA, actorId: ids.partnerA, action: "spoof", resourceType: "matter", outcome: "success" }));
    expect(await failure(spoofed)).toBe("42501");
    expect(await failure(withActor(ids.ownerA, (client) => client.query("delete from audit_events")))).not.toBeNull();

    const verified = await owner.query<{ ok: boolean; checked: string }>("select * from verify_audit_chain($1)", [ids.orgA]);
    expect(verified.rows[0]).toMatchObject({ ok: true, checked: "3" });

    const client = await owner.connect();
    try {
      await client.query("alter table audit_events disable trigger audit_append_only");
      await client.query("update audit_events set metadata='{\"note\":\"edited\"}' where action='test.three'");
      await client.query("alter table audit_events enable trigger audit_append_only");
    } finally {
      client.release();
    }
    const tampered = await owner.query<{ ok: boolean; first_bad_index: string }>("select * from verify_audit_chain($1)", [ids.orgA]);
    expect(tampered.rows[0]).toMatchObject({ ok: false, first_bad_index: "3" });
  });
});
