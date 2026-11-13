import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportsBadge } from "./ReportsBadge";

const { mockCount } = vi.hoisted(() => ({ mockCount: vi.fn() }));
vi.mock("@/pages/admin/api/admin", () => ({ fetchAdminOpenReportsCount: mockCount }));

function renderBadge() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportsBadge />
    </QueryClientProvider>,
  );
}

beforeEach(() => mockCount.mockReset());

describe("ReportsBadge", () => {
  it("показывает число открытых жалоб", async () => {
    mockCount.mockResolvedValue(3);
    renderBadge();
    expect(await screen.findByLabelText("Открытых жалоб: 3")).toHaveTextContent("3");
  });

  it("больше 99 показывает «99+»", async () => {
    mockCount.mockResolvedValue(150);
    renderBadge();
    expect(await screen.findByLabelText("Открытых жалоб: 150")).toHaveTextContent("99+");
  });

  it("при нуле бейджа нет", async () => {
    mockCount.mockResolvedValue(0);
    const { container } = renderBadge();
    await vi.waitFor(() => expect(mockCount).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});