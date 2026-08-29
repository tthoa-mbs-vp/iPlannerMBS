import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useOutsideClick } from "../hooks/useOutsideClick";

function TestComponent({ onOutsideClick }: { onOutsideClick: () => void }) {
  const ref = useOutsideClick<HTMLDivElement>(onOutsideClick);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        Inside content
      </div>
      <div data-testid="outside">Outside content</div>
    </div>
  );
}

describe("useOutsideClick", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call handler when clicking inside", () => {
    const handler = vi.fn();
    const { getByTestId } = render(<TestComponent onOutsideClick={handler} />);
    fireEvent.mouseDown(getByTestId("inside"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when clicking outside", () => {
    const handler = vi.fn();
    const { getByTestId } = render(<TestComponent onOutsideClick={handler} />);
    fireEvent.mouseDown(getByTestId("outside"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls handler on touchstart outside", () => {
    const handler = vi.fn();
    const { getByTestId } = render(<TestComponent onOutsideClick={handler} />);
    fireEvent.touchStart(getByTestId("outside"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler on touchstart inside", () => {
    const handler = vi.fn();
    const { getByTestId } = render(<TestComponent onOutsideClick={handler} />);
    fireEvent.touchStart(getByTestId("inside"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns a ref object", () => {
    function HookTest() {
      const ref = useOutsideClick<HTMLDivElement>(() => {});
      return <div ref={ref}>Test</div>;
    }
    const { container } = render(<HookTest />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });
});
