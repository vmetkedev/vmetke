# Nginx-конфиг vmetke.ru

Канонический домен — `vmetke.ru` (без www). `www.vmetke.ru` редиректит на него по HTTPS. HTTP→HTTPS редирект настроен через certbot.

## Установка на сервере

```bash
cp vmetke.ru.conf /etc/nginx/sites-available/vmetke.ru
nginx -t
systemctl reload nginx
```

SSL-сертификаты выпускаются и обновляются certbot'ом отдельно — сам конфиг только ссылается на пути `/etc/letsencrypt/live/vmetke.ru/...`, не создаёт их.

## Проверка

```bash
curl -I https://www.vmetke.ru   # должен 301 на https://vmetke.ru/
curl -I http://vmetke.ru        # должен 301 на https://vmetke.ru/
curl -I https://vmetke.ru       # 200
```