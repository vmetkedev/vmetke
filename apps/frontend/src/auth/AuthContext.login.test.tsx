import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("../lib/api", () => ({
  api: { post: mockPost, get: vi.fn() },
  setAccessToken: vi.fn(),
}));

const respond = (status: number, body?: unknown, jsonFails = false) => ({
  ok: status < 400,
  status,
  json: async () => {
    if (jsonFails) throw new Error("not json");
    return body;
  },
});

async function setup(loginResponse: ReturnType<typeof respond>) {
  mockPost.mockImplementation(async (path: string) =>
    path === "/auth/refresh" ? respond(401, {}) : loginResponse,
  );
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => mockPost.mockReset());

describe("AuthContext.login: заблокированный аккаунт", () => {
  it("403 с причиной показывает причину", async () => {
    const { result } = await setup(respond(403, { error: "Аккаунт заблокирован", reason: "спам" }));
    await expect(result.current.login("bob", "pw")).rejects.toThrow("Аккаунт заблокирован. Причина: спам");
  });

  it("403 без причины и с не-JSON телом показывает общий текст", async () => {
    const withoutReason = await setup(respond(403, { error: "Аккаунт заблокирован", reason: null }));
    await expect(withoutReason.result.current.login("bob", "pw")).rejects.toThrow(/^Аккаунт заблокирован$/);

    const notJson = await setup(respond(403, undefined, true));
    await expect(notJson.result.current.login("bob", "pw")).rejects.toThrow(/^Аккаунт заблокирован$/);
  });

  it("401 по-прежнему «Неверные данные для входа»", async () => {
    const { result } = await setup(respond(401, { error: "Неверные данные для входа" }));
    await expect(result.current.login("bob", "pw")).rejects.toThrow("Неверные данные для входа");
  });
});