import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import { useAuthStore } from "../stores/authStore";

const mockUserState = {
  user: {
    id: "1",
    email: "admin@mbs.com",
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
  useAuthStore: vi.fn((selector: any) => (selector ? selector(mockUserState) : mockUserState)),
}));

describe("Sidebar", () => {
  it("renders the Thông tin section with a Hướng dẫn link", () => {
    render(
      <MemoryRouter>
        <Sidebar open />
      </MemoryRouter>
    );
    expect(screen.getByText("Thông tin")).toBeInTheDocument();
    const guide = screen.getByRole("link", { name: /Hướng dẫn/ });
    expect(guide).toBeInTheDocument();
    expect(guide).toHaveAttribute("href", "/huong-dan-su-dung.html");
  });

  it("hides admin-only items for non-admin users", () => {
    const plain = { ...mockUserState, user: { ...mockUserState.user, expand: { ...mockUserState.user.expand, role_id: { can_manage: false, view_scope: "personal", level: "employee" } } } };
    (useAuthStore as any).mockImplementation((sel: any) => (sel ? sel(plain) : plain));    render(
      <MemoryRouter>
        <Sidebar open />
      </MemoryRouter>
    );
    expect(screen.queryByText("Nhật ký")).toBeNull();
    expect(screen.queryByText("Thùng rác")).toBeNull();
    expect(screen.getByRole("link", { name: /Hướng dẫn/ })).toBeInTheDocument();
  });

  it("auto-expands on hover when collapsed and collapses on leave", () => {
    render(
      <MemoryRouter>
        <Sidebar open={false} />
      </MemoryRouter>
    );
    const aside = screen.getByRole("complementary");
    // Thu gọn: chưa hiện nhãn / tiêu đề section
    expect(screen.queryByText("Quản lý Công việc")).toBeNull();
    expect(screen.queryByText("Kế hoạch & Nhiệm vụ")).toBeNull();

    fireEvent.mouseEnter(aside);
    expect(screen.getByText("Quản lý Công việc")).toBeInTheDocument();
    expect(screen.getByText("Kế hoạch & Nhiệm vụ")).toBeInTheDocument();

    fireEvent.mouseLeave(aside);
    expect(screen.queryByText("Quản lý Công việc")).toBeNull();
    expect(screen.queryByText("Kế hoạch & Nhiệm vụ")).toBeNull();
  });
});
