import "./env.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTelegramAlert, telegramConfigured } from "../services/telegram.service.js";

const TOKEN = "123456:SECRET-TOKEN";
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

function configure() {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_CHAT_ID = "42";
}

describe("sendTelegramAlert", () => {
  it("без настроек ничего не отправляет и не падает", async () => {
    expect(telegramConfigured()).toBe(false);
    expect(await sendTelegramAlert("текст")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отправляет текст в нужный чат, без parse_mode", async () => {
    configure();
    expect(telegramConfigured()).toBe(true);
    expect(await sendTelegramAlert("Привет")).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe("42");
    expect(body.text).toContain("Привет");
    expect(body).not.toHaveProperty("parse_mode");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("длинный текст обрезается до лимита Telegram", async () => {
    configure();
    await sendTelegramAlert("я".repeat(10000));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text.length).toBeLessThanOrEqual(4000);
  });

  it("HTTP-ошибка Telegram: false, без исключения, токена в логе нет", async () => {
    configure();
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendTelegramAlert("текст")).toBe(false);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET-TOKEN");
  });

  it("сетевая ошибка и таймаут: false, без исключения, токена в логе нет", async () => {
    configure();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`));
    expect(await sendTelegramAlert("текст")).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET-TOKEN");

    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await sendTelegramAlert("текст")).toBe(false);
  });
});