import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DonutChart from "../components/shared/DonutChart";

describe("DonutChart", () => {
  const colorFor = (status: string) => {
    const colors: Record<string, string> = {
      completed: "#10b981",
      in_progress: "#6366f1",
      not_started: "#64748b",
    };
    return colors[status] || "#cbd5e1";
  };

  it("renders SVG with data", () => {
    const { container } = render(
      <DonutChart
        data={[
          { status: "completed", value: 5 },
          { status: "in_progress", value: 3 },
        ]}
        colorFor={colorFor}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders correct number of circle slices", () => {
    const { container } = render(
      <DonutChart
        data={[
          { status: "a", value: 10 },
          { status: "b", value: 20 },
          { status: "c", value: 30 },
        ]}
        colorFor={colorFor}
      />
    );
    const circles = container.querySelectorAll("circle");
    // 1 background circle + 3 data circles = 4
    expect(circles.length).toBe(4);
  });

  it("returns null for empty data", () => {
    const { container } = render(
      <DonutChart data={[]} colorFor={colorFor} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for zero total", () => {
    const { container } = render(
      <DonutChart
        data={[
          { status: "a", value: 0 },
          { status: "b", value: 0 },
        ]}
        colorFor={colorFor}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("skips zero-value slices", () => {
    const { container } = render(
      <DonutChart
        data={[
          { status: "a", value: 0 },
          { status: "b", value: 10 },
        ]}
        colorFor={colorFor}
      />
    );
    const circles = container.querySelectorAll("circle");
    // 1 background + 1 data circle (zero value skipped)
    expect(circles.length).toBe(2);
  });

  it("uses custom size", () => {
    const { container } = render(
      <DonutChart
        data={[{ status: "a", value: 10 }]}
        colorFor={colorFor}
        size={200}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "200");
    expect(svg).toHaveAttribute("height", "200");
  });
});
