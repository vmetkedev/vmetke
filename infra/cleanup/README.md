# Очистка истёкших refresh-токенов

Ежедневно (03:00, до бэкапа в 04:00) удаляет из `refresh_tokens` записи с `revoked = true` или истёкшим `expires_at`.

Читает `DATABASE_URL` из `/var/www/vmetke/backend/.env` и разбирает его вручную (без URI-парсера `psql`), чтобы корректно работать даже если пароль содержит `@`.

## Установка на сервере

```bash
cp vmetke-cleanup-tokens.sh /usr/local/bin/vmetke-cleanup-tokens.sh
chmod +x /usr/local/bin/vmetke-cleanup-tokens.sh
cp vmetke-cleanup-tokens.service vmetke-cleanup-tokens.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vmetke-cleanup-tokens.timer
```

## Проверка

```bash
systemctl list-timers | grep vmetke
journalctl -u vmetke-cleanup-tokens.service -n 10 --no-pager
```