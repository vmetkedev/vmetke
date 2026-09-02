#!/bin/bash
set -uo pipefail

TELEGRAM_TOKEN="___SET_ON_SERVER___"
TELEGRAM_CHAT_ID="___SET_ON_SERVER___"
HEALTH_URL="http://127.0.0.1:3000/health"
STATE_FILE="/var/run/vmetke-healthcheck.state"

send_telegram() {
  local message="$1"
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="${message}" > /dev/null
}

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL")
PREV_STATE=$(cat "$STATE_FILE" 2>/dev/null || echo "ok")

if [ "$HTTP_CODE" != "200" ]; then
  if [ "$PREV_STATE" != "down" ]; then
    send_telegram "🔴 vmetke.ru: backend недоступен (HTTP ${HTTP_CODE}). $(date '+%Y-%m-%d %H:%M:%S')"
    echo "down" > "$STATE_FILE"
  fi
else
  if [ "$PREV_STATE" = "down" ]; then
    send_telegram "🟢 vmetke.ru: backend снова работает. $(date '+%Y-%m-%d %H:%M:%S')"
  fi
  echo "ok" > "$STATE_FILE"
fi