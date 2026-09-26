import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDatabase, ownerPool, seed } from "./fixtures";

const failure = async (operation: Promise<unknown>) => {
  try {
    await operation;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
  return null;
};

describe.skipIf(!hasDatabase)("platform administration functions", () => {
  let owner: Pool;
  let app: Pool;

  beforeAll(async () => {
    owner = ownerPool();
    app = new Pool({ connectionString: process.env.TEST_DATABASE_APP_URL, max: 2 });
    await seed(owner);
  });

  afterAll(async () => {
    await owner?.end();
    await app?.end();
  });

  it("creates a tenant only through the platform function, with an owner invitation and an audit chain", async () => {
    expect(await failure(app.query("insert into organizations(name, slug) values ('Direct', 'direct-insert')"))).toBe("42501");

    const created = await app.query<{ organization_id: string; invitation_id: string }>(
      "select * from platform_create_organization('Harbor & Vale Chambers', 'harbor-vale', 'Owner@Harbor.test', 'token-hash-1', 7)",
    );
    const { organization_id: organizationId } = created.rows[0];
    const invitation = await owner.query<{ email: string; role: string; invited_by: string | null }>("select email, role, invited_by from invitations where organization_id = $1", [organizationId]);
    expect(invitation.rows).toEqual([{ email: "owner@harbor.test", role: "owner", invited_by: null }]);
    const audit = await owner.query<{ action: string; actor_id: string | null }>("select action, actor_id from audit_events where organization_id = $1", [organizationId]);
    expect(audit.rows).toEqual([{ action: "organization.provision", actor_id: null }]);
    expect((await owner.query<{ ok: boolean }>("select ok from verify_audit_chain($1)", [organizationId])).rows[0].ok).toBe(true);

    expect(await failure(app.query("select * from platform_create_organization('Copy', 'harbor-vale', 'x@harbor.test', 'token-hash-2', 7)"))).toBe("23505");
    expect(await failure(app.query("select * from platform_create_organization('Long link', 'long-link', 'x@harbor.test', 'token-hash-3', 30)"))).toBe("P0001");
  });

  it("replaces pending owner links and lets the invitee become owner", async () => {
    const organizationId = (await owner.query<{ id: string }>("select id from organizations where slug = 'harbor-vale'")).rows[0].id;
    await app.query("select * from platform_issue_owner_invitation($1, 'owner@harbor.test', 'token-hash-4', 3)", [organizationId]);
    const pending = await owner.query<{ token_hash: string }>("select token_hash from invitations where organization_id = $1 and revoked_at is null", [organizationId]);
    expect(pending.rows.map((row) => row.token_hash)).toEqual(["token-hash-4"]);

    const user = await owner.query<{ id: string }>("insert into app_users(email, display_name, password_hash) values ('owner@harbor.test', 'Adv. Harbor Owner', 'x') returning id");
    expect(await failure(app.query("select accept_invitation('token-hash-1', $1)", [user.rows[0].id]))).toBe("P0002");
    await app.query("select accept_invitation('token-hash-4', $1)", [user.rows[0].id]);
    const membership = await owner.query<{ role: string }>("select role from memberships where organization_id = $1 and user_id = $2", [organizationId, user.rows[0].id]);
    expect(membership.rows[0].role).toBe("owner");
  });

  it("lists organization metadata for the console and records platform audit events", async () => {
    const listed = await app.query<{ slug: string; active_members: string; owner_emails: string | null }>("select slug, active_members, owner_emails from platform_organizations() where slug = 'harbor-vale'");
    expect(listed.rows[0]).toEqual({ slug: "harbor-vale", active_members: "1", owner_emails: "owner@harbor.test" });
    await app.query("insert into platform_audit_events (action, resource_type, outcome) values ('platform.sign_in', 'platform', 'denied')");
    expect(await failure(app.query("delete from platform_audit_events"))).toBe("42501");
  });
});
