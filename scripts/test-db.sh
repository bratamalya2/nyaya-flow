#!/usr/bin/env bash
# Creates a throwaway PostgreSQL database with the production role layout, applies every migration,
# and runs the integration suite against it.
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
npx vitest run --config vitest.integration.config.mts "$@"
