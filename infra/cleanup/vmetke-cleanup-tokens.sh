#!/bin/bash
set -euo pipefail

ENV_FILE="/var/www/vmetke/backend/.env"
DATABASE_URL=$(grep -m1 -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\r\n')

# postgres://user:password@host:port/db
# разбираем вручную, а не через URI-парсер psql — устойчиво к спецсимволам (в т.ч. @) в пароле
REST="${DATABASE_URL#postgres://}"
USERPASS="${REST%@*}"
HOSTDB="${REST##*@}"

DB_USER="${USERPASS%%:*}"
DB_PASSWORD="${USERPASS#*:}"

HOSTPORT="${HOSTDB%%/*}"
DB_NAME="${HOSTDB#*/}"

DB_HOST="${HOSTPORT%%:*}"
DB_PORT="${HOSTPORT##*:}"

export PGPASSWORD="$DB_PASSWORD"

DELETED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
  DELETE FROM refresh_tokens
  WHERE revoked = true OR expires_at < now()
  RETURNING id;
" | grep -c . || true)

echo "Cleaned up $DELETED expired/revoked refresh tokens"