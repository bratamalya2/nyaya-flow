#!/usr/bin/env bash
# Restores a backup into a scratch database and directory, then proves it is usable:
#   checksums match, key tables have rows, every organization's audit chain verifies,
#   and every stored document matches its recorded SHA-256.
#
# Required: RESTORE_ADMIN_URL   superuser URL on a scratch PostgreSQL server (NOT production)
#           BACKUP_AGE_IDENTITY path to the age identity (private key) file
# Optional: first argument = backup stamp (e.g. 20261001T201500Z); defaults to the newest backup.
set -euo pipefail

: "${RESTORE_ADMIN_URL:?RESTORE_ADMIN_URL is required}"
: "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY is required}"
backup_dir="${BACKUP_DIR:-/var/backups/nyayaflow}"

stamp="${1:-}"
if [[ -z "${stamp}" ]]; then
  stamp="$(find "${backup_dir}" -maxdepth 1 -name '*-postgres.dump.age' -printf '%f\n' | sort | tail -1 | sed 's/-postgres.dump.age$//')"
fi
[[ -n "${stamp}" ]] || { echo "No backups found in ${backup_dir}." >&2; exit 1; }

scratch_db="nyayaflow_restore_$(date -u +%Y%m%d%H%M%S)"
scratch_dir="$(mktemp -d)"
cleanup() {
  psql "${RESTORE_ADMIN_URL}" -qc "drop database if exists ${scratch_db} with (force)" >/dev/null 2>&1 || true
  rm -rf "${scratch_dir}"
}
trap cleanup EXIT

echo "Verifying checksums for ${stamp}…"
(cd "${backup_dir}" && sha256sum -c "${stamp}.sha256")

echo "Restoring database into ${scratch_db}…"
psql "${RESTORE_ADMIN_URL}" -v ON_ERROR_STOP=1 -qc "create database ${scratch_db}"
restore_url="${RESTORE_ADMIN_URL%/*}/${scratch_db}"
age -d -i "${BACKUP_AGE_IDENTITY}" "${backup_dir}/${stamp}-postgres.dump.age" | pg_restore --no-owner --no-acl --exit-on-error -d "${restore_url}"

echo "Restoring documents into ${scratch_dir}…"
age -d -i "${BACKUP_AGE_IDENTITY}" "${backup_dir}/${stamp}-documents.tar.age" | tar -C "${scratch_dir}" -xf -

echo "Row counts:"
psql "${restore_url}" -At -F ' ' -c "select 'organizations', count(*) from organizations union all select 'matters', count(*) from matters union all select 'document_versions', count(*) from document_versions union all select 'audit_events', count(*) from audit_events"

failed=0
echo "Audit chains:"
while IFS='|' read -r org ok checked bad; do
  echo "  ${org}: ok=${ok} checked=${checked}${bad:+ first_bad=${bad}}"
  [[ "${ok}" == "t" ]] || failed=1
done < <(psql "${restore_url}" -At -c "select o.id, v.ok, v.checked, v.first_bad_index from organizations o cross join lateral verify_audit_chain(o.id) v")

echo "Document integrity:"
checked_files=0
while IFS='|' read -r storage_path expected; do
  file="${scratch_dir}/documents/${storage_path}"
  if [[ ! -f "${file}" ]]; then echo "  MISSING ${storage_path}"; failed=1; continue; fi
  actual="$(sha256sum "${file}" | cut -d' ' -f1)"
  if [[ "${actual}" != "${expected,,}" ]]; then echo "  HASH MISMATCH ${storage_path}"; failed=1; fi
  checked_files=$((checked_files + 1))
done < <(psql "${restore_url}" -At -c "select storage_path, sha256 from document_versions where status not in ('uploaded','failed')")
echo "  ${checked_files} files checked"

if [[ "${failed}" -ne 0 ]]; then echo "RESTORE DRILL FAILED for ${stamp}." >&2; exit 1; fi
echo "Restore drill passed for ${stamp}."
