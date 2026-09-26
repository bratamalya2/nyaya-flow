#!/usr/bin/env bash
# Creates a throwaway PostgreSQL database with the production role layout, applies every migration,
# and runs the integration suite against it. With "e2e" as the first argument it instead provisions an
# owner account and runs the database-backed Playwright suite (tests/e2e-db) against a real server.
#
# Default: starts an ephemeral local cluster (initdb/pg_ctl from PATH) on 127.0.0.1:${TEST_PG_PORT:-54330}
# and deletes it afterwards. Set TEST_PG_SUPERUSER_URL to use an existing server instead; a database
# named nyayaflow_test_<random> is created there and dropped on exit.
set -euo pipefail

cd "$(dirname "$0")/.."
suffix="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
owner_password="owner-${suffix}"
app_password="app-${suffix}"
worker_password="worker-${suffix}"
cluster_dir=""

cleanup() {
  if [[ -n "${cluster_dir}" ]]; then
    pg_ctl -D "${cluster_dir}/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "${cluster_dir}"
  elif [[ -n "${TEST_PG_SUPERUSER_URL:-}" && -n "${database:-}" ]]; then
    psql "${TEST_PG_SUPERUSER_URL}" -qc "drop database if exists ${database} with (force)" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -z "${TEST_PG_SUPERUSER_URL:-}" ]]; then
  port="${TEST_PG_PORT:-54330}"
  cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/nyayaflow-pg.XXXXXX")"
  initdb -D "${cluster_dir}/data" -U postgres --auth=trust -E UTF8 >/dev/null
  pg_ctl -D "${cluster_dir}/data" -l "${cluster_dir}/postgres.log" \
    -o "-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -w start >/dev/null
  superuser_url="postgresql://postgres@127.0.0.1:${port}/postgres"
  host="127.0.0.1:${port}"
  database="nyayaflow_test"
else
  superuser_url="${TEST_PG_SUPERUSER_URL}"
  # The suite (re)sets passwords on the nyayaflow_* roles, which are cluster-wide. Never touch a server
  # that already has them — that would break a real DATABASE_URL.
  existing="$(psql "${superuser_url}" -Atc "select count(*) from pg_roles where rolname in ('nyayaflow_owner','nyayaflow_app','nyayaflow_worker')")"
  if [[ "${existing}" != "0" ]]; then
    echo "Refusing to run: this server already has nyayaflow_* roles. Unset TEST_PG_SUPERUSER_URL to use an ephemeral cluster." >&2
    exit 1
  fi
  host="$(psql "${superuser_url}" -Atc "select coalesce(inet_server_addr()::text,'127.0.0.1') || ':' || current_setting('port')")"
  host="${host%/32}"
  database="nyayaflow_test_${suffix}"
fi

psql "${superuser_url}" -v ON_ERROR_STOP=1 -q <<SQL
do \$\$ begin
  if not exists(select 1 from pg_roles where rolname='nyayaflow_owner') then create role nyayaflow_owner login noinherit bypassrls; end if;
  if not exists(select 1 from pg_roles where rolname='nyayaflow_app') then create role nyayaflow_app login noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='nyayaflow_worker') then create role nyayaflow_worker login noinherit bypassrls; end if;
end \$\$;
alter role nyayaflow_owner password '${owner_password}';
alter role nyayaflow_app password '${app_password}';
alter role nyayaflow_worker password '${worker_password}';
create database ${database} owner nyayaflow_owner;
SQL

export TEST_DATABASE_ADMIN_URL="postgresql://nyayaflow_owner:${owner_password}@${host}/${database}"
export TEST_DATABASE_APP_URL="postgresql://nyayaflow_app:${app_password}@${host}/${database}"
export TEST_DATABASE_WORKER_URL="postgresql://nyayaflow_worker:${worker_password}@${host}/${database}"

DATABASE_ADMIN_URL="${TEST_DATABASE_ADMIN_URL}" npx tsx scripts/migrate.ts
npm run --silent build:worker >/dev/null

if [[ "${1:-}" == "e2e" ]]; then
  shift
  storage_dir="$(mktemp -d "${TMPDIR:-/tmp}/nyayaflow-docs.XXXXXX")"
  trap 'rm -rf "${storage_dir}"; cleanup' EXIT
  export E2E_OWNER_EMAIL="owner@e2e.nyayaflow.test"
  export E2E_OWNER_PASSWORD="e2e-owner-passphrase-${suffix}"
  DATABASE_ADMIN_URL="${TEST_DATABASE_ADMIN_URL}" OPERATOR_EMAIL="${E2E_OWNER_EMAIL}" OPERATOR_PASSWORD="${E2E_OWNER_PASSWORD}" \
    OPERATOR_NAME="Adv. E2E Owner" ORGANIZATION_NAME="E2E Chambers" ORGANIZATION_SLUG="e2e-chambers" npx tsx scripts/provision-operator.ts
  export SUPERADMIN_EMAIL="superadmin@e2e.nyayaflow.test"
  export SUPERADMIN_PASSWORD="superadmin-e2e-passphrase-${suffix}"
  SUPERADMIN_PASSWORD_HASH="$(node -e 'require("argon2").hash(process.env.SUPERADMIN_PASSWORD, { type: 2 }).then((h) => process.stdout.write(Buffer.from(h).toString("base64url")))')"
  SUPERADMIN_TOTP_SECRET="$(node -e 'process.stdout.write(require("otplib").authenticator.generateSecret(20))')"
  export SUPERADMIN_PASSWORD_HASH SUPERADMIN_TOTP_SECRET
  export DOCUMENT_STORAGE_ROOT="${storage_dir}"
  export MFA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
  export SESSION_SECRET="$(openssl rand -base64 48)"
  npx playwright test --config playwright.db.config.ts "$@"
else
  npx vitest run --config vitest.integration.config.mts "$@"
fi
