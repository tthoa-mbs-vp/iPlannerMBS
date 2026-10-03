import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import Spinner from "../components/shared/Spinner";
import { ClipboardList } from "lucide-react";

describe("EmptyState", () => {
  it("renders message", () => {
    render(<EmptyState icon={ClipboardList} message="Không có dữ liệu" />);
    expect(screen.getByText("Không có dữ liệu")).toBeInTheDocument();
  });

  it("renders subMessage when provided", () => {
    render(
      <EmptyState icon={ClipboardList} message="Trống" subMessage="Thêm mới để bắt đầu" />
    );
    expect(screen.getByText("Thêm mới để bắt đầu")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={ClipboardList}
        message="Trống"
        action={{ label: "Thêm mới", onClick }}
      />
    );
    fireEvent.click(screen.getByText("Thêm mới"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when not provided", () => {
    render(<EmptyState icon={ClipboardList} message="Trống" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders default message", () => {
    render(<ErrorState />);
    expect(screen.getByText("Không thể tải dữ liệu")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<ErrorState message="Lỗi kết nối" />);
    expect(screen.getByText("Lỗi kết nối")).toBeInTheDocument();
  });

  it("renders subMessage when provided", () => {
    render(<ErrorState message="Lỗi" subMessage="Chi tiết lỗi" />);
    expect(screen.getByText("Chi tiết lỗi")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Thử lại"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ErrorState />);
    expect(screen.queryByText("Thử lại")).not.toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("renders a spinning element", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders with sm size", () => {
    const { container } = render(<Spinner size="sm" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.className).toContain("h-5");
  });

  it("renders with lg size", () => {
    const { container } = render(<Spinner size="lg" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.className).toContain("h-8");
  });

  it("applies custom className", () => {
    const { container } = render(<Spinner className="my-custom-class" />);
    expect(container.querySelector(".my-custom-class")).toBeInTheDocument();
  });
});
