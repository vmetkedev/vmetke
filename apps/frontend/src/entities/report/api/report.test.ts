import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitReport } from "./report";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ api: { post: mockPost } }));

const base = { targetType: "post" as const, targetId: "p1", reason: "spam" as const };
const fail = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });

beforeEach(() => mockPost.mockReset());

describe("submitReport", () => {
  it("отправляет данные, пустой комментарий опускает, непустой обрезает", async () => {
    mockPost.mockResolvedValue({ ok: true, status: 201 });
    await submitReport({ ...base, comment: "   " });
    expect(mockPost).toHaveBeenLastCalledWith("/reports", { ...base, comment: undefined });

    await submitReport({ ...base, reason: "other", comment: "  нарушение  " });
    expect(mockPost).toHaveBeenLastCalledWith("/reports", { ...base, reason: "other", comment: "нарушение" });
  });

  it("показывает текст ошибки сервера", async () => {
    mockPost.mockResolvedValue(fail(409, { error: "Вы уже отправили жалобу, она на рассмотрении" }));
    await expect(submitReport(base)).rejects.toThrow("Вы уже отправили жалобу, она на рассмотрении");
  });

  it("401 просит войти", async () => {
    mockPost.mockResolvedValue(fail(401, { error: "Unauthorized" }));
    await expect(submitReport(base)).rejects.toThrow("Войдите, чтобы отправить жалобу");
  });

  it("нестроковая ошибка и не-JSON дают общий текст", async () => {
    mockPost.mockResolvedValue(fail(400, { error: { fieldErrors: {} } }));
    await expect(submitReport(base)).rejects.toThrow("Не удалось отправить жалобу");

    mockPost.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(submitReport(base)).rejects.toThrow("Не удалось отправить жалобу");
  });
});