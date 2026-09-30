import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import KpiPage from "../pages/KpiPage";

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector?: (s: { user: unknown; isAuthenticated: boolean }) => unknown) => {
    const state = {
      user: { id: "1", email: "admin@mbs.com", expand: { role_id: { can_manage: true } } },
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../hooks/useKpiScores", () => ({
  useKpiScores: vi.fn(() => ({
    data: [
      { id: "k1", task_id: "t1", base_score: 50, difficulty_coeff: 1.0, progress_score: 100, final_score: 50, result_rating: 3, expand: { task_id: { executor_id: "u1" } } },
      { id: "k2", task_id: "t2", base_score: 80, difficulty_coeff: 1.3, progress_score: 80, final_score: 83.2, result_rating: 4, expand: { task_id: { executor_id: "u2" } } },
    ],
    isLoading: false,
  })),
  useBatchCalculateKpi: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({ created: 1, failed: 0 }), isPending: false })),
}));

vi.mock("../hooks/useTasks", () => ({
  useTasks: vi.fn(() => ({
    data: [
      { id: "t1", name: "Task A", executor_id: "u1", status: "completed", category: "normal", deadline: new Date().toISOString() },
      { id: "t2", name: "Task B", executor_id: "u2", status: "completed", category: "important", deadline: new Date().toISOString() },
      { id: "t3", name: "Task C", executor_id: "u1", status: "completed", category: "normal", deadline: new Date().toISOString() },
    ],
    isLoading: false,
  })),
}));

vi.mock("../hooks/useDepartments", () => ({
  useUsers: vi.fn(() => ({
    data: [
      { id: "u1", name: "Nguyen Van A", email: "a@test.com", disabled: false, verified: true, reminder_days: 2 },
      { id: "u2", name: "Tran Thi B", email: "b@test.com", disabled: false, verified: true, reminder_days: 2 },
    ],
    isLoading: false,
  })),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("KpiPage", () => {
  it("renders summary stat cards", () => {
    render(<KpiPage />, { wrapper: Wrapper });
    expect(screen.getAllByText("NV hoàn thành").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tổng nhiệm vụ")).toBeInTheDocument();
  });

  it("renders user KPI table", () => {
    render(<KpiPage />, { wrapper: Wrapper });
    expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByText("Tran Thi B")).toBeInTheDocument();
  });

  it("renders recalculate button when unscored tasks exist", () => {
    render(<KpiPage />, { wrapper: Wrapper });
    expect(screen.getByText("Tính KPI (1)")).toBeInTheDocument();
  });
});
