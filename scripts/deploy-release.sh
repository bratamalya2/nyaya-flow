#!/usr/bin/env bash
# Builds and activates a release from a clean checkout of the release commit. Run as root on the VPS.
# Requires DATABASE_ADMIN_URL for the schema owner role (WITH BYPASSRLS); it is used only for migrations
# and must not be placed in /etc/nyayaflow/nyayaflow.env.
set -euo pipefail

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL (schema owner) is required to apply migrations}"

release_id="${1:-$(date -u +%Y%m%d%H%M%S)}"
release_dir="/opt/nyayaflow/releases/${release_id}"

if grep -qs '^DEMO_MODE=true' /etc/nyayaflow/nyayaflow.env; then
  echo "Refusing to deploy: DEMO_MODE=true in /etc/nyayaflow/nyayaflow.env." >&2
  exit 1
fi

npm ci
npm run typecheck
npm run lint
npm test
NODE_ENV=production npm run build
npm run build:worker

DATABASE_ADMIN_URL="${DATABASE_ADMIN_URL}" MIGRATIONS_DIR="$(pwd)/db/migrations" node .worker-build/scripts/migrate.cjs

install -d -o nyayaflow -g nyayaflow -m 0750 "${release_dir}"
cp -a .next/standalone/. "${release_dir}/"
install -d -o nyayaflow -g nyayaflow "${release_dir}/.next/static" "${release_dir}/public" "${release_dir}/worker" "${release_dir}/scripts" "${release_dir}/db"
cp -a .next/static/. "${release_dir}/.next/static/"
cp -a public/. "${release_dir}/public/"
cp -a db/migrations "${release_dir}/db/"
install -m 0640 .worker-build/worker.cjs "${release_dir}/worker/worker.cjs"
install -m 0640 .worker-build/scripts/migrate.cjs .worker-build/scripts/provision-operator.cjs .worker-build/scripts/research-graph-setup.cjs .worker-build/scripts/seed-research-fixtures.cjs .worker-build/scripts/requeue-research-graph.cjs .worker-build/scripts/seed-transition-fixtures.cjs .worker-build/scripts/seed-filing-contract-fixtures.cjs "${release_dir}/scripts/"
install -m 0750 scripts/backup.sh scripts/restore-drill.sh "${release_dir}/scripts/"
chown -R nyayaflow:nyayaflow "${release_dir}"

ln -sfn "${release_dir}" /opt/nyayaflow/current.next
mv -Tf /opt/nyayaflow/current.next /opt/nyayaflow/current
systemctl restart nyayaflow-web nyayaflow-worker
systemctl --no-pager --full status nyayaflow-web nyayaflow-worker
