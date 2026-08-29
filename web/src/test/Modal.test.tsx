import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "../components/shared/Modal";

describe("Modal", () => {
  it("renders with title", () => {
    render(
      <Modal title="Test Modal" onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <Modal title="Modal" onClose={vi.fn()}>
        <p>Child content here</p>
      </Modal>
    );
    expect(screen.getByText("Child content here")).toBeInTheDocument();
  });

  it("has dialog role and aria attributes", () => {
    render(
      <Modal title="Accessible Modal" onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Accessible Modal");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Closeable" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText("Đóng"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Escapable" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Backdrop" onClose={onClose}>
        <p>Content</p>
      </Modal>
    );
    // Click the backdrop (the fixed overlay)
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside modal content", () => {
    const onClose = vi.fn();
    render(
      <Modal title="ContentClick" onClose={onClose}>
        <button>Inside</button>
      </Modal>
    );
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies custom maxWidth", () => {
    render(
      <Modal title="Wide" onClose={vi.fn()} maxWidth="3xl">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector(".max-w-3xl")).toBeInTheDocument();
  });
});
