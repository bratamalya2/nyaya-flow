#!/usr/bin/env bash
# Nightly encrypted backup of PostgreSQL and private documents.
# DATABASE_BACKUP_URL must use a read-only role WITH BYPASSRLS (see README); pg_dump refuses to dump
# tables whose row-level security would hide rows.
set -euo pipefail

: "${DATABASE_BACKUP_URL:?DATABASE_BACKUP_URL is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

backup_dir="${BACKUP_DIR:-/var/backups/nyayaflow}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_file="${backup_dir}/${stamp}-postgres.dump.age"
documents_file="${backup_dir}/${stamp}-documents.tar.age"

umask 077
pg_dump --format=custom --no-owner --no-acl "${DATABASE_BACKUP_URL}" | age -r "${BACKUP_AGE_RECIPIENT}" -o "${database_file}"
tar -C /var/lib/nyayaflow -cf - documents | age -r "${BACKUP_AGE_RECIPIENT}" -o "${documents_file}"
(cd "${backup_dir}" && sha256sum "$(basename "${database_file}")" "$(basename "${documents_file}")" > "${stamp}.sha256")

find "${backup_dir}" -maxdepth 1 -type f \( -name '*.age' -o -name '*.sha256' \) -mtime "+${retention_days}" -delete
echo "Encrypted backup completed: ${stamp}. Copy it to the separate India-hosted failure domain."
