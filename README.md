# NyayaFlow

NyayaFlow is a self-hosted litigation operations MVP for small Indian law firms. In one responsive application it combines:
- matters, and manual hearing and task tracking with a reasoned edit history;
- conflict detection;
- restricted document storage with English/Hindi OCR and full-text search;
- invitations, roles, and matter grants;
- DPDP privacy workflows;
- tamper-evident audit events.

The Stitch HTML and screens in `stitch_indian_legaltech_platform/` are visual references. The Research, BNS, E-Filing, Client Portal, Billing, Contracts, and Analytics screens are static, clearly labelled synthetic previews: fictional data, disabled controls, no external actions.

## Runtime architecture

- **Web:** Next.js/Node.js process behind Nginx.
- **Database:** self-hosted PostgreSQL 16 on the same Mumbai VPS. PostgreSQL row-level security enforces tenant and restricted-matter access for every query.
- **Documents:** private bytes under `DOCUMENT_STORAGE_ROOT`, outside the web root, served only after a per-request database authorization check.
- **Worker:** a separate systemd worker runs ClamAV, Poppler, and Tesseract `eng+hin` jobs from the PostgreSQL job queue, and verifies each organization's audit chain daily.
- **Authentication:** local Argon2id passwords, mandatory TOTP MFA with replay protection, opaque sessions (12 h absolute, 60 min idle), sign-in throttling, and invitation links. The operator provisions each firm and its first owner.
- **AI:** an optional OpenAI adapter, off by default, that blocks `internal` and `privileged` data before any request. MVP OCR never calls OpenAI.

No Supabase, hosted authentication, hosted object storage, Docker, live court connector, or Neo4j service is used. `Architecture (2).md` describes the design in detail.

## Local setup

Requirements:
- Node.js 24 and PostgreSQL 16+.
- For document processing: ClamAV, Poppler, and Tesseract English/Hindi.

1. Copy `.env.example` to `.env.local` and create strong, independent PostgreSQL credentials.
2. Generate the MFA encryption key with `openssl rand -base64 32` and a session secret with `openssl rand -base64 48`.
3. Create the database roles as a PostgreSQL superuser, each with its own password:

   ```sql
   -- Schema owner: used only to run migrations. BYPASSRLS is required, because the
   -- security-definer RLS helpers read forced-RLS tables. Migration 002 refuses to run without it.
   create role nyayaflow_owner login noinherit bypassrls password 'OWNER_PASSWORD';
   create role nyayaflow_app login noinherit password 'APP_PASSWORD';
   create role nyayaflow_worker login noinherit bypassrls password 'WORKER_PASSWORD';
   -- Read-only role for pg_dump backups.
   create role nyayaflow_backup login noinherit bypassrls password 'BACKUP_PASSWORD';
   create database nyayaflow owner nyayaflow_owner;
   ```

   After the migrations have run, give the backup role read access:

   ```sql
   grant usage on schema public to nyayaflow_backup;
   grant select on all tables in schema public to nyayaflow_backup;
   grant select on all sequences in schema public to nyayaflow_backup;
   ```

4. Install and initialize:

   ```bash
   npm install
   DATABASE_ADMIN_URL=postgresql://nyayaflow_owner:…@127.0.0.1:5432/nyayaflow npm run db:migrate
   OPERATOR_EMAIL=owner@example.in \
   OPERATOR_PASSWORD='a-long-unique-password' \
   OPERATOR_NAME='Adv. Firm Owner' \
   ORGANIZATION_NAME='Example Chambers' \
   ORGANIZATION_SLUG='example-chambers' \
   DATABASE_ADMIN_URL=… npm run db:provision
   npm run dev
   npm run worker   # in a second terminal, to process uploads
   ```

The owner enrols TOTP MFA at first sign-in and can then invite members from **Firm Admin**. Each invitation is a one-time link, and invitees also enrol MFA before they see firm data.

### Demo mode

`DEMO_MODE=true` serves synthetic data without authentication or persistence, for UI review only.
- It is a server-only runtime flag.
- Never use a `NEXT_PUBLIC_` variable for it: Next.js inlines those into the server build, which would freeze an authentication bypass into production.
- The server refuses to start with it when `NODE_ENV=production`, and `deploy-release.sh` refuses to deploy with it.

If an older `.env` still sets `NEXT_PUBLIC_DEMO_MODE`, remove it; the flag is ignored.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test                   # unit tests
npm run test:integration   # RLS, audit-chain, and worker tests against a throwaway PostgreSQL
npm run test:e2e           # browser tests in demo mode (desktop + mobile)
npm run test:e2e:db        # full browser flow against a real database, RLS, and the OCR worker
npm run build && npm run build:worker
```

**Database-backed suites:** `test:integration` and `test:e2e:db` start an ephemeral PostgreSQL cluster using `initdb` and `pg_ctl` from your `PATH`, and delete it afterwards. To use an existing server instead, set `TEST_PG_SUPERUSER_URL`; a temporary database is created there and dropped on exit.

**Local tools:**
- The worker tests need `tesseract`.
- ClamAV is not required locally; the e2e flow marks the scan clean and runs the real OCR step.

**Parallel dev servers:** the e2e servers use their own build directories (`.next-e2e`, `.next-e2e-db`), so they can run while your own `npm run dev` is running.

## Native OVH VPS deployment

Target: Ubuntu 24.04 LTS on the OVH Mumbai VPS.

1. **Install.** Review `scripts/install-vps.sh`, then run it as root. It installs packages, creates the service accounts, and creates the setgid document root owned by the web user and readable by the worker and backup accounts. Install Node.js 24 LTS separately from its trusted distribution channel.
2. **Database.** Create the PostgreSQL roles above.
3. **Secrets.** Put the application secrets in `/etc/nyayaflow/nyayaflow.env`, owned by `root:nyayaflow` with mode `0640`. Do not put `DATABASE_ADMIN_URL` or `OPERATOR_PASSWORD` there.
4. **Nginx.**
   - Replace `__DOMAIN__` in `deploy/nginx.conf` and install it under `/etc/nginx/sites-available/nyayaflow`.
   - Enable the site, validate with `nginx -t`, and obtain TLS with Certbot.
   - The configuration rate-limits `/api/v1/auth/` and overwrites `X-Forwarded-For`.
5. **Deploy.** From a clean checkout of the release commit, run `DATABASE_ADMIN_URL=… scripts/deploy-release.sh`. The script:
   - runs the type check, lint, and tests;
   - builds the web app and the bundled worker;
   - applies migrations;
   - creates an atomic release and restarts the web and worker units.
6. **Backups.** Configure `/etc/nyayaflow/backup.env` with `DATABASE_BACKUP_URL` (the `nyayaflow_backup` role) and an `age` recipient, then enable `nyayaflow-backup.timer`. Backups older than `BACKUP_RETENTION_DAYS` (default 30) are pruned. Copy them to a separate India-hosted location.
7. **Restore drill.** Prove backups can be restored with `RESTORE_ADMIN_URL=… BACKUP_AGE_IDENTITY=… scripts/restore-drill.sh`. It restores into a scratch database, then verifies checksums, audit chains, and every document hash. Run it before the pilot and on a schedule.

The Mumbai OVH region is a single availability zone. Keep the encrypted off-site copy and perform restore drills before pilot use.

## Document lifecycle

1. The web app creates a short-lived, single-use upload intent after a matter check, either for a new document or as the next version of an existing one.
2. The browser streams the bytes to a non-public route. Size and SHA-256 must match the declared values before an atomic move into private storage.
3. The worker:
   - scans the file with ClamAV;
   - enforces the 500-page limit;
   - renders PDF pages with Poppler;
   - extracts English/Hindi text with a single Tesseract pass per page;
   - writes the pages and the ready status in one short transaction.
4. Search returns only `ready` versions in the active organization that the user's RLS permits. Human OCR corrections preserve both the original extraction and every correction.
5. Downloads are streamed only after a fresh session and matter-permission check, so revocation applies to new requests immediately. Every download is audited.

## Production cautions

- Keep the PostgreSQL owner credential out of the web and worker services. The web uses `nyayaflow_app`; the worker uses `nyayaflow_worker`.
- Back the document root with encrypted storage, restrict it to the `nyayaflow` group, and never expose it through Nginx aliases.
- Treat “manual”, “unverified”, “verified”, and “stale” as distinct source states. No interface may claim live court status without an approved connector.
- Automatic deletion remains disabled until a reviewed retention policy is configured; active legal holds always block erasure requests on the linked matter.
- Compliance badges are not legal conclusions. Complete legal, privacy, accounting, and source-rights review before external pilot use.
