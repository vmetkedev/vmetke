const TIMEOUT_MS = 5000;
const MAX_LEN = 4000; // лимит Telegram 4096

export function telegramConfigured() {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

/**
 * Отправляет текстовое уведомление. Никогда не бросает исключений:
 * алерт не должен ломать основное действие. Токен и URL не логируются.
 */
export async function sendTelegramAlert(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const prefix = process.env.NODE_ENV === "production" ? "" : "[dev] ";
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: (prefix + text).slice(0, MAX_LEN),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[telegram] sendMessage failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] sendMessage error: ${err instanceof Error ? err.name : "unknown"}`);
    return false;
  }
}