import { config } from "dotenv";

config({ path: ".env.test", override: true });

// Админский rate-limit в тестах не мешает; специальный тест задаёт малые значения сам
process.env.ADMIN_RATE_LIMIT_READ ??= "100000";
process.env.ADMIN_RATE_LIMIT_WRITE ??= "100000";