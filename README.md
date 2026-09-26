# NyayaFlow

NyayaFlow is a self-hosted litigation operations MVP for small Indian law firms. It combines matters, manual hearing and task tracking, restricted document storage, English/Hindi OCR, privacy administration, and tamper-evident audit events in one responsive application.

The supplied Stitch HTML/screens are visual references only. Research, filing, client, billing, contracts, and analytics screens are explicitly labeled synthetic previews and do not perform external actions.

## Runtime architecture

- Next.js/Node.js web process behind Nginx.
- Self-hosted PostgreSQL on the same Mumbai VPS; tenant and restricted-matter access is enforced with PostgreSQL RLS.
- Private document bytes under `DOCUMENT_STORAGE_ROOT`, outside the web root and served only after an authenticated database authorization check.
- A separate systemd worker runs ClamAV, Poppler, and Tesseract `eng+hin` jobs from the PostgreSQL durable queue.
- Local Argon2id credentials, opaque revocable sessions, and mandatory TOTP MFA. Firms and their first owner are operator-provisioned.
- Optional OpenAI adapter is off by default and blocks `internal` and `privileged` data before any request. MVP OCR never calls OpenAI.

No Supabase, hosted authentication, hosted object storage, Docker, live court connector, or Neo4j service is used.

## Local setup

Requirements: Node.js 24, PostgreSQL 16+, and (for document processing) ClamAV, Poppler, Tesseract English/Hindi.

1. Copy `.env.example` to `.env.local` and create strong, independent PostgreSQL credentials.
2. Generate the MFA encryption key with `openssl rand -base64 32` and a session secret with `openssl rand -base64 48`.
3. Create database roles using separate passwords:

   ```sql
   create role nyayaflow_owner login noinherit password 'OWNER_PASSWORD';
   create role nyayaflow_app login noinherit password 'APP_PASSWORD';
   create role nyayaflow_worker login noinherit bypassrls password 'WORKER_PASSWORD';
   create database nyayaflow owner nyayaflow_owner;
   ```

4. Install and initialize:

   ```bash
   npm install
   npm run db:migrate
   OPERATOR_EMAIL=owner@example.in \
   OPERATOR_PASSWORD='a-long-unique-password' \
   OPERATOR_NAME='Adv. Firm Owner' \
   ORGANIZATION_NAME='Example Chambers' \
   ORGANIZATION_SLUG='example-chambers' \
   npm run db:provision
   npm run dev
   ```

The owner must enroll TOTP MFA during the first sign-in. `NEXT_PUBLIC_DEMO_MODE=true` bypasses persistence and authentication only for UI review; it must be `false` in production.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Database RLS checks require a temporary PostgreSQL database and are documented in `tests/sql/rls.sql`.

## Native OVH VPS deployment

Target: Ubuntu 24.04 LTS on the OVH Mumbai VPS.

1. Review and run `scripts/install-vps.sh` as root. Install Node.js 24 LTS separately from its trusted distribution channel.
2. Create the PostgreSQL roles above, run migrations with `DATABASE_ADMIN_URL`, then provision the operator.
3. Put application secrets in `/etc/nyayaflow/nyayaflow.env` owned by `root:nyayaflow` with mode `0640`. Never place `OPERATOR_PASSWORD` there.
4. Replace `__DOMAIN__` in `deploy/nginx.conf`, install it under `/etc/nginx/sites-available/nyayaflow`, enable the site, validate with `nginx -t`, and obtain TLS with Certbot.
5. Run `scripts/deploy-release.sh`. It builds, tests, creates an atomic release, and restarts the web and worker units.
6. Configure `/etc/nyayaflow/backup.env` with `DATABASE_BACKUP_URL` and an `age` recipient, then enable `nyayaflow-backup.timer`.

The Mumbai OVH region is a single availability zone. Keep an encrypted, access-controlled backup in a separate India-hosted failure domain and perform restore drills before pilot use.

## Document lifecycle

1. The web app creates a short-lived, single-use upload intent after a matter grant check.
2. The browser streams bytes to a non-public route. Size and SHA-256 must match the declared values before an atomic move into private storage.
3. The worker scans with ClamAV, enforces the 500-page limit, renders pages with Poppler, and extracts English/Hindi text with Tesseract.
4. Search returns only `ready` versions authorized by RLS. Human OCR corrections preserve both the original extraction and every correction event.
5. Downloads are streamed only after a fresh session and matter permission check, so revocation applies to new requests immediately.

## Production cautions

- Keep the PostgreSQL owner credential out of web and worker services. The web uses `nyayaflow_app`; the worker uses `nyayaflow_worker`.
- Back the document root with encrypted storage, restrict it to the worker/web Unix group, and never expose it through Nginx aliases.
- Treat “manual”, “unverified”, “verified”, and “stale” as distinct source states. No interface may claim live court status without an approved connector.
- Automatic deletion remains disabled until a reviewed retention policy is configured; active legal holds always block deletion.
- Compliance badges are not legal conclusions. Complete legal, privacy, accounting, and source-rights review before external pilot use.
