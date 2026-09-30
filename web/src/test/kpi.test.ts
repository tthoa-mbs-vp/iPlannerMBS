import { describe, it, expect } from "vitest";
import { calculateKpi } from "../utils/kpi";
import type { Task } from "@shared/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: "task1",
    name: "Test Task",
    description: "",
    category: "normal",
    host_dept_id: "dept1",
    executor_id: "user1",
    supervisor_id: "user2",
    collaborator_ids: [],
    start_date: new Date(now - 86400000 * 14).toISOString(),
    deadline: new Date(now - 86400000).toISOString(),
    status: "completed",
    is_recurring: false,
    is_deleted: false,
    created: new Date(now).toISOString(),
    updated: new Date(now).toISOString(),
    ...overrides,
  };
}

describe("calculateKpi", () => {
  it("returns correct fields", () => {
    const result = calculateKpi(makeTask());
    expect(result).toHaveProperty("task_id", "task1");
    expect(result).toHaveProperty("base_score");
    expect(result).toHaveProperty("difficulty_coeff");
    expect(result).toHaveProperty("progress_score");
    expect(result).toHaveProperty("final_score");
    expect(result).toHaveProperty("result_rating");
  });

  it("base_score is 10 for normal tasks", () => {
    const result = calculateKpi(makeTask({ category: "normal" }));
    expect(result.base_score).toBe(10);
  });

  it("base_score is 12 for sudden tasks", () => {
    const result = calculateKpi(makeTask({ category: "sudden" }));
    expect(result.base_score).toBe(12);
  });

  it("uses difficulty coefficient 1.0 for normal tasks", () => {
    const result = calculateKpi(makeTask({ category: "normal" }));
    expect(result.difficulty_coeff).toBe(1.0);
  });

  it("uses difficulty coefficient 1.2 for important tasks", () => {
    const result = calculateKpi(makeTask({ category: "important" }));
    expect(result.difficulty_coeff).toBe(1.2);
  });

  it("difficulty coefficient for sudden is 1.0 (no high_impact, no coordinating)", () => {
    const result = calculateKpi(makeTask({ category: "sudden" }));
    expect(result.difficulty_coeff).toBe(1.0);
  });

  it("uses difficulty coefficient 1.1 when task has coordinating department (not important)", () => {
    const result = calculateKpi(makeTask({ category: "normal", coordinating_dept_id: "dept2" }));
    expect(result.difficulty_coeff).toBe(1.1);
  });

  it("uses difficulty coefficient 1.1 when plan has partner departments (not important)", () => {
    const result = calculateKpi(makeTask({
      category: "normal",
      expand: { plan_id: { partner_dept_ids: ["dept2"] } },
    } as any));
    expect(result.difficulty_coeff).toBe(1.1);
  });

  it("uses difficulty coefficient 1.2 for important tasks even with coordinating department", () => {
    const result = calculateKpi(makeTask({ category: "important", coordinating_dept_id: "dept2" }));
    expect(result.difficulty_coeff).toBe(1.2);
  });

  it("scores 100 for completion before deadline", () => {
    const futureDeadline = new Date(Date.now() + 86400000 * 2).toISOString();
    const result = calculateKpi(makeTask({ deadline: futureDeadline }));
    expect(result.progress_score).toBe(100);
  });

  it("scores 0 for completion >5 days late", () => {
    const pastDeadline = new Date(Date.now() - 86400000 * 10).toISOString();
    const result = calculateKpi(makeTask({ deadline: pastDeadline }));
    expect(result.progress_score).toBe(0);
  });

  it("scores 80 for 1-3 days late", () => {
    const pastDeadline = new Date(Date.now() - 86400000 * 2).toISOString();
    const result = calculateKpi(makeTask({ deadline: pastDeadline }));
    expect(result.progress_score).toBe(80);
  });

  it("scores 60 for 4-5 days late", () => {
    const pastDeadline = new Date(Date.now() - 86400000 * 4).toISOString();
    const result = calculateKpi(makeTask({ deadline: pastDeadline }));
    expect(result.progress_score).toBe(60);
  });

  it("scores 0 for not completed tasks", () => {
    const result = calculateKpi(makeTask({ status: "in_progress" }));
    expect(result.progress_score).toBe(0);
  });

  it("scores 100 for completed task without a deadline", () => {
    const result = calculateKpi(makeTask({ deadline: "" } as any));
    expect(result.progress_score).toBe(100);
  });

  it("result_rating defaults to 0", () => {
    const result = calculateKpi(makeTask());
    expect(result.result_rating).toBe(0);
  });

  it("result_rating uses the task rating field", () => {
    const result = calculateKpi(makeTask({ rating: 5 } as any));
    expect(result.result_rating).toBe(5);
  });

  it("calculates final_score correctly for on-time normal task", () => {
    const futureDeadline = new Date(Date.now() + 86400000 * 2).toISOString();
    const result = calculateKpi(makeTask({ category: "normal", deadline: futureDeadline }));
    // base=10, difficulty=1.0, schedule=1.0, result=0.0 (unrated), perf=10*(0.3*1+0.7*0)=3, actual=3
    expect(result.final_score).toBe(3);
  });

  it("calculates final_score correctly for on-time important task with rating 5", () => {
    const futureDeadline = new Date(Date.now() + 86400000 * 2).toISOString();
    const result = calculateKpi(makeTask({ category: "important", deadline: futureDeadline, rating: 5 } as any));
    // base=10, difficulty=1.2, schedule=1.0, result=1.0, perf=10*(0.3*1+0.7*1)=10, actual=10*1.2=12
    expect(result.final_score).toBe(12);
  });

  it("handles edge case of exact deadline day", () => {
    const todayDeadline = new Date(Date.now() + 86400000).toISOString();
    const result = calculateKpi(makeTask({ deadline: todayDeadline }));
    expect(result.progress_score).toBe(100);
  });

  it("final_score is rounded to 1 decimal", () => {
    const result = calculateKpi(makeTask({ category: "normal", deadline: new Date(Date.now() + 86400000 * 2).toISOString() }));
    expect(result.final_score! * 10).toBe(Math.round(result.final_score! * 10));
  });
});
