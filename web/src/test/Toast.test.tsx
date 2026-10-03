import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ToastContainer from "../components/shared/Toast";
import { useToastStore } from "../stores/toastStore";

// Mock the toast store
vi.mock("../stores/toastStore", () => ({
  useToastStore: vi.fn(),
}));

const mockRemoveToast = vi.fn();
const mockUseToastStore = vi.mocked(useToastStore);

describe("ToastContainer", () => {
  it("renders nothing when no toasts", () => {
    mockUseToastStore.mockReturnValue({ toasts: [], removeToast: mockRemoveToast });
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe("");
  });

  it("renders success toast", () => {
    mockUseToastStore.mockReturnValue({
      toasts: [{ id: "1", type: "success", message: "Thành công!" }],
      removeToast: mockRemoveToast,
    });
    render(<ToastContainer />);
    expect(screen.getByText("Thành công!")).toBeInTheDocument();
  });

  it("renders error toast", () => {
    mockUseToastStore.mockReturnValue({
      toasts: [{ id: "1", type: "error", message: "Lỗi xảy ra" }],
      removeToast: mockRemoveToast,
    });
    render(<ToastContainer />);
    expect(screen.getByText("Lỗi xảy ra")).toBeInTheDocument();
  });

  it("renders info toast", () => {
    mockUseToastStore.mockReturnValue({
      toasts: [{ id: "1", type: "info", message: "Thông tin" }],
      removeToast: mockRemoveToast,
    });
    render(<ToastContainer />);
    expect(screen.getByText("Thông tin")).toBeInTheDocument();
  });

  it("calls removeToast when dismiss button is clicked", () => {
    mockUseToastStore.mockReturnValue({
      toasts: [{ id: "abc", type: "success", message: "Test" }],
      removeToast: mockRemoveToast,
    });
    render(<ToastContainer />);
    fireEvent.click(screen.getByLabelText("Đóng thông báo"));
    expect(mockRemoveToast).toHaveBeenCalledWith("abc");
  });

  it("renders multiple toasts", () => {
    mockUseToastStore.mockReturnValue({
      toasts: [
        { id: "1", type: "success", message: "First" },
        { id: "2", type: "error", message: "Second" },
      ],
      removeToast: mockRemoveToast,
    });
    render(<ToastContainer />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
