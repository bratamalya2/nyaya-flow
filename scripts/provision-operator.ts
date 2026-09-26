import argon2 from "argon2";
import { Client } from "pg";

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const email = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
const password = process.env.OPERATOR_PASSWORD;
const displayName = process.env.OPERATOR_NAME?.trim();
const organizationName = process.env.ORGANIZATION_NAME?.trim();
const organizationSlug = process.env.ORGANIZATION_SLUG?.trim();
if (!connectionString || !email || !password || !displayName || !organizationName || !organizationSlug) {
  throw new Error("DATABASE_ADMIN_URL, OPERATOR_EMAIL, OPERATOR_PASSWORD, OPERATOR_NAME, ORGANIZATION_NAME, and ORGANIZATION_SLUG are required.");
}
if (password.length < 14) throw new Error("OPERATOR_PASSWORD must contain at least 14 characters.");

const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
await client.connect();
try {
  await client.query("begin");
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  const organization = await client.query<{ id: string }>(
    `insert into organizations(name,slug) values($1,$2) on conflict(slug) do update set name=excluded.name returning id`,
    [organizationName, organizationSlug],
  );
  const user = await client.query<{ id: string }>(
    `insert into app_users(email,display_name,password_hash) values($1,$2,$3)
     on conflict(email) do update set display_name=excluded.display_name,password_hash=excluded.password_hash,disabled_at=null returning id`,
    [email, displayName, passwordHash],
  );
  await client.query(
    `insert into memberships(organization_id,user_id,role,active,mfa_required) values($1,$2,'owner',true,true)
     on conflict(organization_id,user_id) do update set role='owner',active=true,mfa_required=true`,
    [organization.rows[0].id, user.rows[0].id],
  );
  await client.query("commit");
  process.stdout.write(`Provisioned owner ${email} for ${organizationName}. MFA enrollment is required at first sign-in.\n`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
