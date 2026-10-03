import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import Modal from "@/components/shared/Modal";

// Modal is the single dialog implementation in the app, shared by ImportModal,
// UserManager, AnnouncementsPage and TaskDetailPage — so its keyboard contract
// (labelling, initial focus, Tab trap, focus restore) is worth pinning down.

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <>
      <button type="button">Mở hộp thoại</button>
      {open && (
        <Modal title="Chỉnh sửa nhiệm vụ" onClose={close}>
          <label htmlFor="ten">Tên</label>
          <input id="ten" />
          <button type="button">Lưu</button>
          <button type="button">Huỷ</button>
        </Modal>
      )}
    </>
  );
}

function TriggeredHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Mở hộp thoại</button>
      {open && (
        <Modal title="Chỉnh sửa nhiệm vụ" onClose={() => setOpen(false)}>
          <label htmlFor="ten-2">Tên</label>
          <input id="ten-2" />
          <button type="button">Lưu</button>
          <button type="button">Huỷ</button>
        </Modal>
      )}
    </>
  );
}

describe("Modal — rendering", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders its title and children", () => {
    render(
      <Modal title="Chỉnh sửa nhiệm vụ" onClose={vi.fn()}>
        <p>Nội dung chi tiết</p>
      </Modal>
    );
    expect(screen.getByText("Chỉnh sửa nhiệm vụ")).toBeInTheDocument();
    expect(screen.getByText("Nội dung chi tiết")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Đóng được" onClose={onClose}>
        <p>Nội dung</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Modal — accessibility", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("exposes dialog semantics and is labelled by its visible heading", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The accessible name must come from the rendered <h3>, not a duplicated string.
    const heading = screen.getByRole("heading", { name: "Chỉnh sửa nhiệm vụ" });
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("moves focus into the dialog on open", async () => {
    render(<Harness />);
    // Focus is applied on the next tick (setTimeout 0).
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Tên"));
    });
  });

  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab: from the last focusable it wraps back to the first", async () => {
    render(<Harness />);
    // DOM order puts the close button in the header, ahead of the body content.
    const first = screen.getByRole("button", { name: "Đóng" });
    const last = screen.getByRole("button", { name: "Huỷ" });
    last.focus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("traps Shift+Tab: from the first focusable it wraps to the last", async () => {
    render(<Harness />);
    const first = screen.getByRole("button", { name: "Đóng" });
    const last = screen.getByRole("button", { name: "Huỷ" });
    first.focus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the trigger when it closes", async () => {
    render(<TriggeredHarness />);
    const trigger = screen.getByRole("button", { name: "Mở hộp thoại" });

    // Arrive by keyboard, then open the dialog.
    trigger.focus();
    fireEvent.click(trigger);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Tên")).toHaveFocus();
    });

    // Closing must hand focus back, not drop it on <body>.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
