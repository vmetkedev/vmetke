import { config } from "dotenv";

config({ path: ".env.test", override: true });

// Админский rate-limit в тестах не мешает; специальный тест задаёт малые значения сам
process.env.ADMIN_RATE_LIMIT_READ ??= "100000";
process.env.ADMIN_RATE_LIMIT_WRITE ??= "100000";
process.env.ADMIN_RATE_LIMIT_SENSITIVE ??= "100000";

// Тесты никогда не должны слать настоящие сообщения, даже если токен попал в .env.test
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;