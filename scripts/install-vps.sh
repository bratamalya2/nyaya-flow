#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root on Ubuntu 24.04 LTS." >&2
  exit 1
fi

apt-get update
apt-get install -y nginx postgresql postgresql-contrib clamav-daemon clamav-freshclam poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin certbot python3-certbot-nginx age

getent group nyayaflow >/dev/null || groupadd --system nyayaflow
id nyayaflow >/dev/null 2>&1 || useradd --system --gid nyayaflow --home-dir /opt/nyayaflow --shell /usr/sbin/nologin nyayaflow
id nyayaflow-worker >/dev/null 2>&1 || useradd --system --gid nyayaflow --home-dir /var/lib/nyayaflow --shell /usr/sbin/nologin nyayaflow-worker
id nyayaflow-backup >/dev/null 2>&1 || useradd --system --gid nyayaflow --home-dir /var/backups/nyayaflow --shell /usr/sbin/nologin nyayaflow-backup

install -d -o nyayaflow -g nyayaflow -m 0750 /opt/nyayaflow/releases
install -d -o root -g nyayaflow -m 0750 /etc/nyayaflow
install -d -o nyayaflow-worker -g nyayaflow -m 0750 /var/lib/nyayaflow/documents
install -d -o nyayaflow -g nyayaflow -m 0750 /var/log/nyayaflow
install -d -o nyayaflow-backup -g nyayaflow -m 0750 /var/backups/nyayaflow

install -o root -g root -m 0644 deploy/nyayaflow-web.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/nyayaflow-worker.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/nyayaflow-backup.service /etc/systemd/system/
install -o root -g root -m 0644 deploy/nyayaflow-backup.timer /etc/systemd/system/
systemctl daemon-reload

echo "Base packages and service accounts are ready. Install Node.js 24 LTS, configure PostgreSQL roles, and place environment files before enabling services."
