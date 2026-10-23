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

  it("keeps firm research history tenant-scoped while exposing only enabled authority sources", async () => {
    const source = await owner.query<{ id: string }>(
      `insert into research_sources(slug,name,rights_basis,rights_reference,source_state,rights_verified_at,enabled)
       values('rls-fixture','RLS fixture source','permission','Test-only permission record','verified',now(),true) returning id`,
    );
    const document = await owner.query<{ id: string }>(
      `insert into research_documents(source_id,external_id,title,citation,jurisdiction,court,document_type,content_sha256,source_state)
       values($1,'RLS-1','RLS fixture authority','[SYN] RLS 1','Fixture jurisdiction','Fixture court','judgment',$2,'verified') returning id`,
      [source.rows[0].id, "b".repeat(64)],
    );
    await owner.query("insert into research_passages(document_id,ordinal,locator,body,checksum) values($1,1,'¶ 1','fixture research provenance',$2)", [document.rows[0].id, "c".repeat(64)]);

    const search = await withActor(ids.advocateA, (client) => client.query<{ document_id: string }>("select document_id from research_search($1)", ["provenance"]));
    expect(search.rows.map((row) => row.document_id)).toContain(document.rows[0].id);
    expect((await withActor(ids.advocateA, (client) => client.query("select * from research_sources"))).rowCount).toBe(1);
    expect((await withActor(ids.ownerB, (client) => client.query("select * from research_sources"))).rowCount).toBe(1);

    const note = await withActor(ids.advocateA, (client) => client.query<{ id: string }>(
      "insert into research_notes(organization_id,title,body,created_by) values($1,'Fixture note','Needs independent review.',$2) returning id", [ids.orgA, ids.advocateA],
    ));
    expect(note.rows[0].id).toBeTruthy();
    expect((await withActor(ids.ownerB, (client) => client.query("select * from research_notes"))).rowCount).toBe(0);
    expect(await failure(withActor(ids.ownerB, (client) => client.query("insert into research_notes(organization_id,title,body,created_by) values($1,'Cross tenant','Denied',$2)", [ids.orgA, ids.ownerB])))).toBe("42501");
  });

  it("applies restricted-matter isolation to filing bundles and contracts", async () => {
    const pack = await withActor(ids.ownerA, (client) => client.query<{ id: string }>(
      "insert into filing_rule_packs(organization_id,forum,name,version,source_reference,enabled,created_by) values($1,'Fixture Forum','Fixture Pack','1.0','Fixture source',true,$2) returning id", [ids.orgA, ids.ownerA],
    ));
    const bundle = await withActor(ids.ownerA, (client) => client.query<{ id: string }>(
      "insert into filing_bundles(organization_id,matter_id,rule_pack_id,title,created_by) values($1,$2,$3,'Restricted fixture bundle',$4) returning id", [ids.orgA, ids.restrictedMatterA, pack.rows[0].id, ids.ownerA],
    ));
    await withActor(ids.ownerA, (client) => client.query("insert into filing_bundle_entries(organization_id,bundle_id,document_version_id,label,sort_order,document_sha256) values($1,$2,$3,'Fixture annexure',0,$4)", [ids.orgA, bundle.rows[0].id, ids.restrictedVersionA, "a".repeat(64)]));
    const contract = await withActor(ids.ownerA, (client) => client.query<{ id: string }>(
      "insert into contracts(organization_id,matter_id,title,counterparty,template_snapshot,created_by) values($1,$2,'Restricted fixture contract','Fixture counterparty','{}',$3) returning id", [ids.orgA, ids.restrictedMatterA, ids.ownerA],
    ));
    expect((await withActor(ids.partnerA, (client) => client.query("select id from filing_bundles where id=$1", [bundle.rows[0].id]))).rowCount).toBe(1);
    expect((await withActor(ids.advocateA, (client) => client.query("select id from filing_bundles where id=$1", [bundle.rows[0].id]))).rowCount).toBe(0);
    expect((await withActor(ids.advocateA, (client) => client.query("select id from contracts where id=$1", [contract.rows[0].id]))).rowCount).toBe(0);
  });

  it("keeps restricted finance records aggregate-only for the finance role", async () => {
    const account = await withActor(ids.ownerA, (client) => client.query<{ id: string }>(
      "insert into billing_accounts(organization_id,display_name,created_by) values($1,'Restricted finance account',$2) returning id", [ids.orgA, ids.ownerA],
    ));
    const charge = await withActor(ids.ownerA, (client) => client.query<{ id: string }>(
      `insert into billing_charges(organization_id,matter_id,billing_account_id,charge_kind,description,occurred_on,quantity,unit_amount_paise,amount_paise,status,submitted_at,created_by)
       values($1,$2,$3,'fixed_fee','Restricted finance fixture',current_date,1,250000,250000,'submitted',now(),$4) returning id`, [ids.orgA, ids.restrictedMatterA, account.rows[0].id, ids.ownerA],
    ));
    await withActor(ids.ownerA, (client) => client.query("update billing_charges set status='approved',approved_at=now(),approved_by=$2 where id=$1", [charge.rows[0].id, ids.ownerA]));
    expect((await withActor(ids.financeA, (client) => client.query("select id from billing_charges"))).rowCount).toBe(0);
    expect((await withActor(ids.financeA, (client) => client.query("select id from billing_accounts"))).rowCount).toBe(0);
    const aggregate = await withActor(ids.financeA, (client) => client.query<{ approved_paise: string }>("select approved_paise from finance_aggregate_summary($1)", [ids.orgA]));
    expect(Number(aggregate.rows[0].approved_paise)).toBeGreaterThanOrEqual(250000);
    expect((await withActor(ids.financeA, (client) => client.query("update billing_charges set status='void' where id=$1", [charge.rows[0].id]))).rowCount).toBe(0);
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
