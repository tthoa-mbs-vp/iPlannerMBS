import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "../pages/DashboardPage";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const mockUserState = {
  user: {
    id: "1",
    email: "admin@mbs.com",
    department_id: "dept-1",
    expand: {
      department_id: { id: "dept-1", name: "Phòng CNTT", code: "CNTT" },
      role_id: { can_manage: true, view_scope: "all", level: "management" },
    },
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockUserState) => unknown) => (selector ? selector(mockUserState) : mockUserState)),
}));

vi.mock("../hooks/usePlans", () => {
  const plans = Array.from({ length: 20 }, (_, i) => ({
    id: String(i + 1),
    name: `KH-${String(i + 1).padStart(2, "0")}`,
    status: "in_progress",
    progress: 50,
    start_date: "2026-08-01",
    end_date: "2026-12-31",
    host_dept_id: "dept-1",
    expand: { host_dept_id: { id: "dept-1", name: "Phòng CNTT" } },
  }));
  return {
    usePlans: () => ({ data: plans, isLoading: false, isError: false }),
  };
});

vi.mock("../hooks/useTasks", () => ({
  useTasks: () => ({
    data: [
      { id: "1", name: "Task A", status: "in_progress", deadline: "2026-08-15", host_dept_id: "dept-1", expand: { host_dept_id: { id: "dept-1", name: "Phòng CNTT" } } },
      { id: "2", name: "Task B", status: "completed", deadline: "2026-07-01", host_dept_id: "dept-1", expand: { host_dept_id: { id: "dept-1", name: "Phòng CNTT" } } },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../hooks/useDepartments", () => ({
  useDepartments: () => ({
    data: [
      { id: "dept-1", name: "Phòng CNTT", code: "CNTT", is_counted: true },
    ],
  }),
  useUsers: () => ({
    data: [
      { id: "1", name: "Admin", email: "admin@mbs.com", department_id: "dept-1", disabled: false, expand: { department_id: { id: "dept-1", name: "Phòng CNTT" } } },
    ],
  }),
}));

vi.mock("../hooks/useProfessionalGroups", () => ({
  useProfessionalGroups: () => ({ data: [] }),
}));

vi.mock("../hooks/useKpiScores", () => ({
  useKpiScores: () => ({ data: [], isLoading: false }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DashboardPage — pagination reset (render-time reset)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resets the plan page to 1 when the page size changes", () => {
    localStorage.setItem("dash_statsMode", JSON.stringify("all"));
    render(<DashboardPage />, { wrapper: Wrapper });

    // default page size 8 with 20 plans -> 3 pages, currently page 1
    expect(screen.getByText("1-8 / 20")).toBeInTheDocument();

    // move to page 2
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("9-16 / 20")).toBeInTheDocument();

    // changing the page size must reset back to page 1
    fireEvent.change(screen.getByTitle("Số dòng/trang"), { target: { value: "10" } });
    expect(screen.getByText("1-10 / 20")).toBeInTheDocument();
  });

  it("keeps the current page when the data count is unchanged", () => {
    localStorage.setItem("dash_statsMode", JSON.stringify("all"));
    render(<DashboardPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("9-16 / 20")).toBeInTheDocument();

    // same page size + same data -> no reset (range stays on page 2)
    expect(screen.getByText("9-16 / 20")).toBeInTheDocument();
  });
});
