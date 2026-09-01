# Бэкапы БД

Ежедневный дамп PostgreSQL через systemd timer, хранится 7 дней.

## Установка на сервере

```bash
cp vmetke-backup.sh /usr/local/bin/vmetke-backup.sh
chmod +x /usr/local/bin/vmetke-backup.sh
cp vmetke-backup.service vmetke-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vmetke-backup.timer
```

## Восстановление из дампа

```bash
pg_restore -U vmetke_app -d vmetke -h 127.0.0.1 --clean --if-exists /var/backups/vmetke/vmetke-<дата>.dump
```

## Проверка

```bash
systemctl list-timers | grep vmetke
journalctl -u vmetke-backup.service -n 20 --no-pager
```