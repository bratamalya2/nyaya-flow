#!/usr/bin/env bash
set -euo pipefail

release_id="${1:-$(date -u +%Y%m%d%H%M%S)}"
release_dir="/opt/nyayaflow/releases/${release_id}"
install -d -o nyayaflow -g nyayaflow -m 0750 "${release_dir}"

npm ci
npm run typecheck
npm test
npm run build
npx tsc worker/index.ts --outDir .worker-build --module nodenext --moduleResolution nodenext --target es2022 --esModuleInterop --skipLibCheck

cp -a .next/standalone/. "${release_dir}/"
install -d -o nyayaflow -g nyayaflow "${release_dir}/.next/static" "${release_dir}/public" "${release_dir}/worker"
cp -a .next/static/. "${release_dir}/.next/static/"
cp -a public/. "${release_dir}/public/"
cp -a .worker-build/worker/. "${release_dir}/worker/"
cp -a scripts "${release_dir}/scripts"
chown -R nyayaflow:nyayaflow "${release_dir}"

ln -sfn "${release_dir}" /opt/nyayaflow/current.next
mv -Tf /opt/nyayaflow/current.next /opt/nyayaflow/current
systemctl restart nyayaflow-web nyayaflow-worker
systemctl --no-pager --full status nyayaflow-web nyayaflow-worker
