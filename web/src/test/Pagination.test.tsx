import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "../components/shared/Pagination";

describe("Pagination", () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    onChange: vi.fn(),
    pageSize: 10,
  };

  it("renders page buttons", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  it("shows total count when provided", () => {
    render(<Pagination {...defaultProps} totalCount={50} />);
    expect(screen.getByText("1-10 / 50")).toBeInTheDocument();
  });

  it("hides total count when not provided", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it("calls onChange when clicking a page", () => {
    const onChange = vi.fn();
    render(<Pagination {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("disables previous button on page 1", () => {
    render(<Pagination {...defaultProps} page={1} />);
    const prevBtn = screen.getByTitle("Trang trước");
    expect(prevBtn).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<Pagination {...defaultProps} page={5} totalPages={5} />);
    const nextBtn = screen.getByTitle("Trang sau");
    expect(nextBtn).toBeDisabled();
  });

  it("navigates to next page", () => {
    const onChange = vi.fn();
    render(<Pagination {...defaultProps} page={2} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Trang sau"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("navigates to previous page", () => {
    const onChange = vi.fn();
    render(<Pagination {...defaultProps} page={3} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Trang trước"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("shows page size selector when onPageSizeChange is provided", () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);
    expect(screen.getByTitle("Số dòng/trang")).toBeInTheDocument();
  });

  it("hides page size selector when onPageSizeChange is not provided", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.queryByTitle("Số dòng/trang")).not.toBeInTheDocument();
  });

  it("calls onPageSizeChange when page size changes", () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);
    fireEvent.change(screen.getByTitle("Số dòng/trang"), { target: { value: "20" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it("highlights current page button", () => {
    render(<Pagination {...defaultProps} page={3} />);
    const currentPage = screen.getByRole("button", { name: "3" });
    expect(currentPage.className).toContain("from-indigo-500");
  });

  it("shows correct range on page 2 with pageSize 10 and 25 total", () => {
    render(<Pagination {...defaultProps} page={2} pageSize={10} totalCount={25} />);
    expect(screen.getByText("11-20 / 25")).toBeInTheDocument();
  });

  it("shows correct range on last page", () => {
    render(<Pagination {...defaultProps} page={3} pageSize={10} totalCount={25} />);
    expect(screen.getByText("21-25 / 25")).toBeInTheDocument();
  });
});
