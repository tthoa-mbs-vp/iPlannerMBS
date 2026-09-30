import { describe, it, expect, vi, beforeAll } from "vitest";
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

vi.mock("../hooks/usePlans", () => ({
  usePlans: () => ({
    data: [
      { id: "1", name: "KH-2026-Q3", status: "in_progress", progress: 50, start_date: "2026-01-01", end_date: "2026-12-31", host_dept_id: "dept-1", expand: { host_dept_id: { id: "dept-1", name: "Phòng CNTT" } } },
    ],
    isLoading: false,
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
  useProfessionalGroups: () => ({
    data: [],
  }),
}));

vi.mock("../hooks/useTasks", () => ({
  useTasks: () => ({
    data: [
      { id: "1", name: "Task A", status: "in_progress", deadline: "2026-08-15", host_dept_id: "dept-1", expand: { host_dept_id: { id: "dept-1", name: "Phòng CNTT" } } },
      { id: "2", name: "Task B", status: "completed", deadline: "2026-07-01", host_dept_id: "dept-1", expand: { host_dept_id: { id: "dept-1", name: "Phòng CNTT" } } },
    ],
    isLoading: false,
  }),
}));

vi.mock("../hooks/useKpiScores", () => ({
  useKpiScores: () => ({
    data: [],
    isLoading: false,
  }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  it("renders summary cards", () => {
    localStorage.setItem("dash_statsMode", JSON.stringify("all"));
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(screen.getAllByText("Đang làm").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Hoàn thành").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Chưa làm").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Trễ hạn").length).toBeGreaterThanOrEqual(1);
  });

  it("renders plan list", () => {
    localStorage.setItem("dash_statsMode", JSON.stringify("all"));
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(screen.getByText("KH-2026-Q3")).toBeInTheDocument();
  });

  it("renders alert section", () => {
    localStorage.setItem("dash_statsMode", JSON.stringify("all"));
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(screen.getByText("Cảnh báo")).toBeInTheDocument();
  });

  it("renders department stats section", () => {
    localStorage.setItem("dash_statsMode", JSON.stringify("all"));
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(screen.getByText("Thống kê theo phòng ban")).toBeInTheDocument();
    expect(screen.getByText("Phòng CNTT")).toBeInTheDocument();
  });

  it("defaults to month mode", () => {
    localStorage.clear();
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(screen.getByRole("tab", { name: "Tháng" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox", { name: "Chọn tháng" })).toBeInTheDocument();
  });

  it("shows stats mode control and year picker", () => {
    localStorage.clear();
    render(<DashboardPage />, { wrapper: Wrapper });
    expect(screen.getByRole("tab", { name: "Tất cả" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tháng" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Năm"));
    expect(screen.getByRole("combobox", { name: "Chọn năm" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2026" })).toBeInTheDocument();
  });

  it("filters plans by selected period", () => {
    localStorage.clear();
    render(<DashboardPage />, { wrapper: Wrapper });
    // Plan KH-2026-Q3 has start_date 2026-01 -> visible in year 2026.
    fireEvent.click(screen.getByText("Năm"));
    expect(screen.getByText("KH-2026-Q3")).toBeInTheDocument();
    // Month mode defaults to the current month (08/2026) -> plan (01/2026) is excluded.
    fireEvent.click(screen.getByText("Tháng"));
    expect(screen.getByText("Chưa có kế hoạch")).toBeInTheDocument();
  });
});
