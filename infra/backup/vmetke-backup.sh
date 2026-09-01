#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/vmetke"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

sudo -u postgres pg_dump -Fc vmetke > "$BACKUP_DIR/vmetke-$TIMESTAMP.dump"

find "$BACKUP_DIR" -name "vmetke-*.dump" -mtime +$KEEP_DAYS -delete

echo "Backup completed: vmetke-$TIMESTAMP.dump"