import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ProfileMenu } from "./ProfileMenu";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("../lib/messages", () => ({
  fetchConversations: vi.fn().mockResolvedValue({ conversations: [] }),
  MESSAGES_CHANGED_EVENT: "messages-changed",
}));

async function openMenu(role: "user" | "moderator" | "admin") {
  mockUseAuth.mockReturnValue({
    user: { id: "1", username: "u", avatarColor: null, role },
    logout: vi.fn(),
  });
  render(<MemoryRouter><ProfileMenu /></MemoryRouter>);
  await userEvent.click(screen.getByLabelText("Меню профиля"));
}

describe("ProfileMenu: пункт «Админка»", () => {
  it("скрыт для обычного пользователя", async () => {
    await openMenu("user");
    expect(screen.queryByText("Админка")).not.toBeInTheDocument();
  });

  it.each(["moderator", "admin"] as const)("виден для %s", async (role) => {
    await openMenu(role);
    expect(screen.getByText("Админка")).toBeInTheDocument();
  });
});