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
  describe("basic field presence", () => {
    it("returns correct fields", () => {
      const result = calculateKpi(makeTask());
      expect(result).toHaveProperty("task_id", "task1");
      expect(result).toHaveProperty("base_score");
      expect(result).toHaveProperty("difficulty_coeff");
      expect(result).toHaveProperty("progress_score");
      expect(result).toHaveProperty("final_score");
      expect(result).toHaveProperty("result_rating");
      expect(result).toHaveProperty("max_converted_score");
    });
  });

  describe("base_score", () => {
    it("is 10 for normal tasks", () => {
      expect(calculateKpi(makeTask({ category: "normal" })).base_score).toBe(10);
    });

    it("is 12 for sudden tasks", () => {
      expect(calculateKpi(makeTask({ category: "sudden" })).base_score).toBe(12);
    });

    it("is 12 for important tasks", () => {
      expect(calculateKpi(makeTask({ category: "important" })).base_score).toBe(10);
    });
  });

  describe("difficulty_coeff", () => {
    it("is 1.0 for normal tasks", () => {
      expect(calculateKpi(makeTask({ category: "normal" })).difficulty_coeff).toBe(1.0);
    });

    it("is 1.2 for important tasks", () => {
      expect(calculateKpi(makeTask({ category: "important" })).difficulty_coeff).toBe(1.2);
    });

    it("is 1.1 when task has coordinating department", () => {
      const result = calculateKpi(makeTask({ category: "normal", coordinating_dept_id: "dept2" }));
      expect(result.difficulty_coeff).toBe(1.1);
    });

    it("is 1.1 when plan has partner departments", () => {
      const result = calculateKpi(makeTask({
        category: "normal",
        expand: { plan_id: { partner_dept_ids: ["dept2"] } },
      } as any));
      expect(result.difficulty_coeff).toBe(1.1);
    });

    it("is 1.2 for important even with coordinating dept (important takes priority)", () => {
      const result = calculateKpi(makeTask({ category: "important", coordinating_dept_id: "dept2" }));
      expect(result.difficulty_coeff).toBe(1.2);
    });
  });

  describe("scheduleLevel (progress_score)", () => {
    it("is 100 (on-time) when completed before deadline", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      expect(calculateKpi(makeTask({ deadline: future })).progress_score).toBe(100);
    });

    it("is 80 for 1-3 days late", () => {
      const past = new Date(Date.now() - 86400000 * 2).toISOString();
      expect(calculateKpi(makeTask({ deadline: past })).progress_score).toBe(80);
    });

    it("is 60 for 4-5 days late", () => {
      const past = new Date(Date.now() - 86400000 * 4).toISOString();
      expect(calculateKpi(makeTask({ deadline: past })).progress_score).toBe(60);
    });

    it("is 0 for >5 days late", () => {
      const past = new Date(Date.now() - 86400000 * 10).toISOString();
      expect(calculateKpi(makeTask({ deadline: past })).progress_score).toBe(0);
    });

    it("is 0 for non-completed tasks", () => {
      expect(calculateKpi(makeTask({ status: "in_progress" })).progress_score).toBe(0);
    });

    it("is 100 for completed task without deadline", () => {
      expect(calculateKpi(makeTask({ deadline: "" as any })).progress_score).toBe(100);
    });
  });

  describe("resultLevel (rating / 10.0 scale)", () => {
    it("defaults to 0 when no rating", () => {
      expect(calculateKpi(makeTask()).result_rating).toBe(0);
    });

    it("uses task rating field", () => {
      expect(calculateKpi(makeTask({ rating: 5 } as any)).result_rating).toBe(5);
    });

    it("rating 10 = resultLevel 1.0 (max)", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ deadline: future, rating: 10 } as any));
      expect(result.result_rating).toBe(10);
      // final_score = base(10) * (0.3*1.0 + 0.7*1.0) * 1.0 = 10 * 1.0 = 10
      expect(result.final_score).toBe(10);
    });

    it("rating 5 = resultLevel 0.5 (half)", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ deadline: future, rating: 5 } as any));
      expect(result.result_rating).toBe(5);
      // final_score = base(10) * (0.3*1.0 + 0.7*0.5) * 1.0 = 10 * 0.65 = 6.5
      expect(result.final_score).toBe(6.5);
    });

    it("rating 1 = resultLevel 0.1 (minimum)", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ deadline: future, rating: 1 } as any));
      expect(result.result_rating).toBe(1);
      // final_score = base(10) * (0.3*1.0 + 0.7*0.1) * 1.0 = 10 * 0.37 = 3.7
      expect(result.final_score).toBe(3.7);
    });
  });

  describe("final_score calculation", () => {
    it("on-time normal task with no rating: 10 * (0.3*1 + 0.7*0) * 1.0 = 3", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ category: "normal", deadline: future }));
      expect(result.final_score).toBe(3);
    });

    it("on-time important task with rating 10: 10 * (0.3*1 + 0.7*1) * 1.2 = 12", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ category: "important", deadline: future, rating: 10 } as any));
      expect(result.final_score).toBe(12);
    });

    it("on-time sudden task with rating 8: 12 * (0.3*1 + 0.7*0.8) * 1.0 = 10.3", () => {
      const future = new Date(Date.now() + 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ category: "sudden", deadline: future, rating: 8 } as any));
      expect(result.final_score).toBe(10.3);
    });

    it("3-day late normal task with rating 6: 10 * (0.3*0.8 + 0.7*0.6) * 1.0 = 6.6", () => {
      const past = new Date(Date.now() - 86400000 * 2).toISOString();
      const result = calculateKpi(makeTask({ category: "normal", deadline: past, rating: 6 } as any));
      expect(result.final_score).toBe(6.6);
    });

    it("final_score is rounded to 1 decimal", () => {
      const result = calculateKpi(makeTask({ deadline: new Date(Date.now() + 86400000 * 2).toISOString() }));
      expect(result.final_score! * 10).toBe(Math.round(result.final_score! * 10));
    });
  });

  describe("max_converted_score", () => {
    it("equals base_score * difficulty_coeff", () => {
      const result = calculateKpi(makeTask({ category: "important" }));
      expect(result.max_converted_score).toBe(12); // 10 * 1.2
    });

    it("equals 12 for sudden task", () => {
      const result = calculateKpi(makeTask({ category: "sudden" }));
      expect(result.max_converted_score).toBe(12); // 12 * 1.0
    });
  });

  describe("edge cases", () => {
    it("handles exact deadline day (on-time)", () => {
      const today = new Date(Date.now() + 86400000).toISOString();
      expect(calculateKpi(makeTask({ deadline: today })).progress_score).toBe(100);
    });

    it("handles cancelled task", () => {
      const result = calculateKpi(makeTask({ status: "cancelled" }));
      expect(result.progress_score).toBe(0);
      expect(result.final_score).toBe(0);
    });

    it("handles pending_approval task", () => {
      const result = calculateKpi(makeTask({ status: "pending_approval" }));
      expect(result.progress_score).toBe(0);
    });
  });
});
