import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import PlansPage from "../pages/PlansPage";

type AuthStoreShape = {
  user: { id: string; email: string; expand: { role_id: { can_manage: boolean; view_scope: string } } };
  isAuthenticated: boolean;
};

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((sel?: (s: AuthStoreShape) => unknown) => {
    const store = {
      user: { id: "1", email: "admin@mbs.com", expand: { role_id: { can_manage: true, view_scope: "all" } } },
      isAuthenticated: true,
    };
    return sel ? sel(store) : store;
  }),
}));

vi.mock("../hooks/usePlans", () => ({
  usePlans: () => ({
    data: [
      { id: "1", name: "KH-2026-Q3", status: "in_progress", progress: 50, start_date: "2026-07-01", end_date: "2026-09-30" },
      { id: "2", name: "KH-2026-Q4", status: "not_started", progress: 0, start_date: "2026-10-01", end_date: "2026-12-31" },
    ],
    isLoading: false,
  }),
  useBulkSoftDeletePlans: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatePlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSoftDeletePlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../hooks/useTasks", () => ({
  useTasks: () => ({ data: [], isLoading: false }),
  useBulkSoftDeleteTasks: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../hooks/useDepartments", () => ({
  useDepartments: () => ({ data: [], isLoading: false }),
  useUsers: () => ({ data: [], isLoading: false }),
}));

vi.mock("../utils/importExport", () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToJSON: vi.fn(),
  PLAN_EXPORT_COLUMNS: [],
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PlansPage", () => {
  it("renders plan names", () => {
    render(<PlansPage />, { wrapper: Wrapper });
    expect(screen.getByText("KH-2026-Q3")).toBeInTheDocument();
    expect(screen.getByText("KH-2026-Q4")).toBeInTheDocument();
  });

  it("shows Kế hoạch heading in left panel", () => {
    render(<PlansPage />, { wrapper: Wrapper });
    expect(screen.getAllByText("Kế hoạch").length).toBeGreaterThan(0);
  });
});
