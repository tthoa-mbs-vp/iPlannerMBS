import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useDismissableMenu } from "@/hooks/useDismissableMenu";

function Menu() {
  const menu = useDismissableMenu();
  return (
    <>
      <button onClick={menu.toggle} {...menu.triggerProps}>
        Xuất dữ liệu
      </button>
      {menu.open && (
        <div role="menu">
          <button onClick={menu.close}>Xuất Excel</button>
        </div>
      )}
    </>
  );
}

describe("useDismissableMenu", () => {
  afterEach(() => cleanup());

  it("starts closed and reports expanded state on the trigger", () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Xuất dữ liệu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("toggles open and reflects it in aria-expanded", () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Xuất dữ liệu" });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Xuất dữ liệu" });

    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Escape is the only dismissal a keyboard user has — the backdrop is not focusable.
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes when a menu item is chosen", () => {
    render(<Menu />);
    fireEvent.click(screen.getByRole("button", { name: "Xuất dữ liệu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
