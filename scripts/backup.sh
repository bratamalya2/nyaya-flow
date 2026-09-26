#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_BACKUP_URL:?DATABASE_BACKUP_URL is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

backup_dir="/var/backups/nyayaflow"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_file="${backup_dir}/${stamp}-postgres.dump.age"
documents_file="${backup_dir}/${stamp}-documents.tar.age"

umask 077
pg_dump --format=custom --no-owner --no-acl "${DATABASE_BACKUP_URL}" | age -r "${BACKUP_AGE_RECIPIENT}" -o "${database_file}"
tar -C /var/lib/nyayaflow -cf - documents | age -r "${BACKUP_AGE_RECIPIENT}" -o "${documents_file}"
sha256sum "${database_file}" "${documents_file}" > "${backup_dir}/${stamp}.sha256"
echo "Encrypted backup completed: ${stamp}"
