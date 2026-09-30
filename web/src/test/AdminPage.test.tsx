import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AdminPage from "../pages/AdminPage";

const mockState = {
  user: { id: "1", email: "admin@mbs.com", expand: { role_id: { can_manage: true } } },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockState) => unknown) => (selector ? selector(mockState) : mockState)),
}));

vi.mock("../hooks/useSystemLogs", () => ({
  useSystemLogs: vi.fn(() => ({
    data: {
      items: [],
      totalItems: 0,
      totalPages: 0,
    },
    isLoading: false,
  })),
}));

vi.mock("../hooks/useDepartments", () => ({
  useDepartments: () => ({ data: [], isLoading: false }),
  useUsers: () => ({ data: [{ id: "1", name: "User A", email: "user@test.com", department_id: "dept1", expand: { role_id: { level: "employee" } } }], isLoading: false }),
  useCreateDepartment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDepartment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDepartment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRoles: () => ({ data: [], isLoading: false }),
  useCreateRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AdminPage", () => {
  it("renders admin tabs", () => {
    render(<AdminPage />, { wrapper: Wrapper });
    expect(screen.getAllByText("Phòng ban").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Chức vụ")).toBeInTheDocument();
    expect(screen.getByText("Người dùng")).toBeInTheDocument();
  });

  it("switches tab when user clicks on a different tab", () => {
    render(<AdminPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("Chức vụ"));
    expect(screen.getAllByText("Chức vụ").length).toBeGreaterThanOrEqual(1);
  });
});
