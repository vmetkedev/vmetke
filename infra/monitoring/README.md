# Мониторинг здоровья backend

Проверка `/health` каждую минуту через systemd timer. При падении/восстановлении — уведомление в Telegram (алерт шлётся один раз на смену состояния, не спамит каждую минуту).

## Установка на сервере

```bash
cp vmetke-healthcheck.sh /usr/local/bin/vmetke-healthcheck.sh
chmod +x /usr/local/bin/vmetke-healthcheck.sh
# отредактировать TELEGRAM_TOKEN и TELEGRAM_CHAT_ID внутри скрипта на сервере
cp vmetke-healthcheck.service vmetke-healthcheck.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vmetke-healthcheck.timer
```

## Получение токена и chat_id

1. Создать бота через [@BotFather](https://t.me/BotFather), команда `/newbot`
2. Написать боту любое сообщение
3. Открыть `https://api.telegram.org/bot<ТОКЕН>/getUpdates`, найти `chat.id` в ответе

## Проверка

```bash
systemctl list-timers | grep vmetke
/usr/local/bin/vmetke-healthcheck.sh
```