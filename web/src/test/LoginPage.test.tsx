import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  })),
}));

describe("LoginPage", () => {
  it("renders login form", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText("iPlanner")).toBeInTheDocument();
    expect(screen.getByText("Đăng nhập")).toBeInTheDocument();
  });

  it("renders email and password inputs", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });
});
