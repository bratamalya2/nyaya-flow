import { Pool } from "pg";

export const hasDatabase = Boolean(process.env.TEST_DATABASE_ADMIN_URL && process.env.TEST_DATABASE_APP_URL && process.env.TEST_DATABASE_WORKER_URL);
if (hasDatabase) process.env.DATABASE_URL = process.env.TEST_DATABASE_APP_URL;

export const ownerPool = () => new Pool({ connectionString: process.env.TEST_DATABASE_ADMIN_URL, max: 2 });
export const workerPool = () => new Pool({ connectionString: process.env.TEST_DATABASE_WORKER_URL, max: 2 });

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const ids = {
  orgA: id(1),
  orgB: id(2),
  ownerA: id(101),
  partnerA: id(102),
  adminA: id(103),
  advocateA: id(104),
  associateA: id(105),
  paralegalA: id(106),
  financeA: id(107),
  granteeA: id(108),
  expiredGranteeA: id(109),
  ownerB: id(201),
  openMatterA: id(1001),
  restrictedMatterA: id(1002),
  openMatterB: id(2001),
  restrictedDocA: id(3001),
  restrictedVersionA: id(3002),
  restrictedPageA: id(3003),
  openDocA: id(3011),
  openVersionA: id(3012),
  openPageA: id(3013),
  hearingOne: id(4001),
  hearingTwo: id(4002),
};

const members: [string, string, string][] = [
  [ids.ownerA, ids.orgA, "owner"],
  [ids.partnerA, ids.orgA, "managing_partner"],
  [ids.adminA, ids.orgA, "admin"],
  [ids.advocateA, ids.orgA, "advocate"],
  [ids.associateA, ids.orgA, "associate"],
  [ids.paralegalA, ids.orgA, "paralegal"],
  [ids.financeA, ids.orgA, "finance"],
  [ids.granteeA, ids.orgA, "paralegal"],
  [ids.expiredGranteeA, ids.orgA, "paralegal"],
  [ids.ownerB, ids.orgB, "owner"],
];

export async function seed(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "truncate organizations, app_users, audit_chain_heads, auth_throttle, security_events cascade",
    );
    await client.query("insert into organizations(id,name,slug) values ($1,'Chambers A','chambers-a'),($2,'Chambers B','chambers-b')", [ids.orgA, ids.orgB]);
    for (const [user, org, role] of members) {
      await client.query("insert into app_users(id,email,display_name,password_hash) values ($1,$2,$3,'x')", [user, `${role}-${user.slice(-4)}@example.in`, `User ${role} ${user.slice(-3)}`]);
      await client.query("insert into memberships(organization_id,user_id,role) values ($1,$2,$3)", [org, user, role]);
    }
    const matter = "insert into matters(id,organization_id,title,reference,forum,client_name,restricted,created_by,lead_id) values ($1,$2,$3,$4,'Delhi High Court','Client',$5,$6,$6)";
    await client.query(matter, [ids.openMatterA, ids.orgA, "Open matter A", "W.P.(C) 1/2026", false, ids.advocateA]);
    await client.query(matter, [ids.restrictedMatterA, ids.orgA, "Restricted matter A", "W.P.(C) 2/2026", true, ids.partnerA]);
    await client.query(matter, [ids.openMatterB, ids.orgB, "Open matter B", "W.P.(C) 3/2026", false, ids.ownerB]);
    await client.query("insert into matter_grants(organization_id,matter_id,user_id,permission,granted_by) values ($1,$2,$3,'view',$4)", [ids.orgA, ids.restrictedMatterA, ids.granteeA, ids.partnerA]);
    await client.query("insert into matter_grants(organization_id,matter_id,user_id,permission,granted_by,expires_at) values ($1,$2,$3,'edit',$4,now()-interval '1 day')", [ids.orgA, ids.restrictedMatterA, ids.expiredGranteeA, ids.partnerA]);

    for (const [doc, version, page, matterId, text] of [
      [ids.restrictedDocA, ids.restrictedVersionA, ids.restrictedPageA, ids.restrictedMatterA, "confidential settlement figure arbitration"],
      [ids.openDocA, ids.openVersionA, ids.openPageA, ids.openMatterA, "ordinary arbitration petition annexure"],
    ]) {
      await client.query("insert into documents(id,organization_id,matter_id,title,status,created_by) values ($1,$2,$3,'Doc','ready',$4)", [doc, ids.orgA, matterId, ids.partnerA]);
      await client.query("insert into document_versions(id,organization_id,document_id,storage_path,mime_type,size_bytes,sha256,status,uploaded_by) values ($1,$2,$3,$4,'application/pdf',10,$5,'ready',$6)", [version, ids.orgA, doc, `${ids.orgA}/${matterId}/${version}/original`, "a".repeat(64), ids.partnerA]);
      await client.query("insert into ocr_pages(id,organization_id,document_version_id,page_number,language,confidence,extracted_text) values ($1,$2,$3,1,'eng',90,$4)", [page, ids.orgA, version, text]);
    }
    await client.query("insert into ocr_corrections(organization_id,ocr_page_id,previous_text,corrected_text,corrected_by) values ($1,$2,'a','privileged correction',$3)", [ids.orgA, ids.restrictedPageA, ids.partnerA]);

    const hearing = "insert into hearings(id,organization_id,matter_id,advocate_id,forum,court_room,starts_at,ends_at,status,created_by) values ($1,$2,$3,$4,'Delhi High Court',$5,$6,$7,'confirmed',$4)";
    await client.query(hearing, [ids.hearingOne, ids.orgA, ids.openMatterA, ids.advocateA, "Court 12", "2026-10-01T05:00:00Z", "2026-10-01T06:00:00Z"]);
    await client.query(hearing, [ids.hearingTwo, ids.orgA, ids.openMatterA, ids.advocateA, "Court 4", "2026-10-01T05:30:00Z", "2026-10-01T06:30:00Z"]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
