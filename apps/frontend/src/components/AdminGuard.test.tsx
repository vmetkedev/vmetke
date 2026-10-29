import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AdminGuard } from "./AdminGuard";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

function renderAt() {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route index element={<div>admin area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminGuard", () => {
  it("ничего не рендерит пока идёт загрузка", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAt();
    expect(screen.queryByText("home")).not.toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("анонима редиректит на /", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAt();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("обычного пользователя редиректит на /", () => {
    mockUseAuth.mockReturnValue({ user: { id: "1", username: "u", avatarColor: null, role: "user" }, loading: false });
    renderAt();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it.each(["moderator", "admin"] as const)("пускает роль %s", (role) => {
    mockUseAuth.mockReturnValue({ user: { id: "1", username: "u", avatarColor: null, role }, loading: false });
    renderAt();
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });
});