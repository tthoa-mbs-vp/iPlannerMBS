import { describe, it, expect } from "vitest";
import { calculateKpi } from "../utils/kpi";
import type { Task } from "@shared/types";

function makeTask(overrides: Partial<Task>): Task {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 86400000).toISOString();
  return {
    id: "t1",
    name: "Task",
    category: "normal",
    status: "completed",
    start_date: now,
    deadline: future,
    completed_at: now,
    updated: now,
    rating: 0,
    ...overrides,
  } as unknown as Task;
}

describe("calculateKpi — thang diem 10 (new scale)", () => {
  it("rating 10/10 on-time normal task gives final_score = base (10)", () => {
    const result = calculateKpi(makeTask({ rating: 10 }));
    expect(result.progress_score).toBe(100);
    expect(result.result_rating).toBe(10);
    // performance = 10 * (0.3*1 + 0.7*1) = 10
    expect(result.final_score).toBe(10);
  });

  it("rating 5/10 halves the result contribution", () => {
    const result = calculateKpi(makeTask({ rating: 5 }));
    // performance = 10 * (0.3 + 0.7*0.5) = 6.5
    expect(result.final_score).toBe(6.5);
  });

  it("rating 8/10 important task applies difficulty coeff 1.2", () => {
    const result = calculateKpi(makeTask({ category: "important", rating: 8 }));
    expect(result.difficulty_coeff).toBe(1.2);
    // performance = 12 * (0.3 + 0.7*0.8) = 12 * 0.86 = 10.3
    expect(result.final_score).toBe(10.3);
    expect(result.max_converted_score).toBe(12);
  });

  it("rating 0 gives only schedule contribution", () => {
    const result = calculateKpi(makeTask({ rating: 0 }));
    // performance = 10 * (0.3*1 + 0) = 3
    expect(result.final_score).toBe(3);
  });

  it("sudden task with full score reaches max converted 12", () => {
    const result = calculateKpi(makeTask({ category: "sudden", rating: 10 }));
    expect(result.base_score).toBe(12);
    expect(result.final_score).toBe(12);
  });
});

describe("calculateKpi — du lieu cu rating 1-5 (legacy)", () => {
  it("legacy rating 5 now maps to only half of result contribution", () => {
    const legacy = calculateKpi(makeTask({ rating: 5 }));
    const full = calculateKpi(makeTask({ rating: 10 }));
    // Legacy max rating 5 can never reach the same final score as a full 10.
    expect(legacy.final_score ?? 0).toBeLessThan(full.final_score ?? 0);
    // Exactly half of the result weight: 0.3 + 0.35 = 0.65 vs 1.0
    expect(legacy.final_score).toBe(6.5);
    expect(full.final_score).toBe(10);
  });

  it("legacy ratings are proportionally consistent under the /10 divisor", () => {
    const r2 = calculateKpi(makeTask({ rating: 2 })).final_score ?? 0;
    const r4 = calculateKpi(makeTask({ rating: 4 })).final_score ?? 0;
    // Doubling the rating doubles the result contribution delta
    expect(r4 - 3).toBeCloseTo((r2 - 3) * 2, 5);
  });
});

describe("calculateKpi — trễ hạn kết hợp đánh giá", () => {
  it("late task with perfect rating still loses schedule points", () => {
    const pastDeadline = new Date(Date.now() - 10 * 86400000).toISOString();
    const completedLate = new Date(Date.now() - 6 * 86400000).toISOString();
    const result = calculateKpi(
      makeTask({ deadline: pastDeadline, completed_at: completedLate, rating: 10 })
    );
    // 4 days late -> scheduleLevel 0.6 -> progress 60
    expect(result.progress_score).toBe(60);
    // performance = 10 * (0.3*0.6 + 0.7*1) = 8.8
    expect(result.final_score).toBe(8.8);
  });

  it("task more than 5 days late scores 0 schedule regardless of rating", () => {
    const pastDeadline = new Date(Date.now() - 10 * 86400000).toISOString();
    const completedVeryLate = new Date(Date.now() - 3 * 86400000).toISOString();
    const result = calculateKpi(
      makeTask({ deadline: pastDeadline, completed_at: completedVeryLate, rating: 10 })
    );
    // 7 days late -> scheduleLevel 0 -> progress 0
    expect(result.progress_score).toBe(0);
    // performance = 10 * (0 + 0.7*1) = 7
    expect(result.final_score).toBe(7);
  });
});
