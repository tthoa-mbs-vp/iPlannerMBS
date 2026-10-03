import { describe, it, expect } from "vitest";
import {
  aggregateUserKpi,
  buildTaskKpi,
  createPeriodMatcher,
  filterCompletedTasksInPeriod,
  filterKpiScoresInPeriod,
} from "@/utils/kpiSelectors";
import type { KpiScore, Task, User } from "@shared/types";

const ALL = { periodType: "all" as const, selectedMonth: "", selectedQuarter: "", selectedYear: "" };

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    name: "Task",
    description: "",
    host_dept_id: "d1",
    executor_id: "u1",
    supervisor_id: "u2",
    collaborator_ids: [],
    start_date: "2026-01-01 00:00:00.000Z",
    deadline: "2026-03-15 00:00:00.000Z",
    status: "completed",
    is_recurring: false,
    is_deleted: false,
    created: "2026-01-01 00:00:00.000Z",
    updated: "2026-01-01 00:00:00.000Z",
    ...over,
  } as Task;
}

function makeScore(task: Task, over: Partial<KpiScore> = {}): KpiScore {
  return {
    id: "k1",
    task_id: task.id,
    final_score: 8,
    expand: { task_id: task },
    ...over,
  } as KpiScore;
}

function makeUser(id: string): User {
  return { id, email: `${id}@mbs.com`, reminder_days: 2, verified: true, disabled: false } as User;
}

describe("createPeriodMatcher", () => {
  it("accepts everything for periodType=all", () => {
    const m = createPeriodMatcher(ALL);
    expect(m("2020-01-01 00:00:00.000Z")).toBe(true);
    expect(m("2030-12-31 00:00:00.000Z")).toBe(true);
  });

  it("matches month and year", () => {
    const m = createPeriodMatcher({ ...ALL, periodType: "month", selectedMonth: "2026-03" });
    expect(m("2026-03-15 00:00:00.000Z")).toBe(true);
    expect(m("2026-04-15 00:00:00.000Z")).toBe(false);

    const y = createPeriodMatcher({ ...ALL, periodType: "year", selectedYear: "2026" });
    expect(y("2026-04-15 00:00:00.000Z")).toBe(true);
    expect(y("2025-04-15 00:00:00.000Z")).toBe(false);
  });

  it("matches quarter", () => {
    const m = createPeriodMatcher({ ...ALL, periodType: "quarter", selectedQuarter: "2026-Q1" });
    expect(m("2026-02-01 00:00:00.000Z")).toBe(true);
    expect(m("2026-06-01 00:00:00.000Z")).toBe(false);
  });

  it("keeps unparseable dates in the period rather than hiding the record", () => {
    const m = createPeriodMatcher({ ...ALL, periodType: "month", selectedMonth: "2026-03" });
    expect(m("not-a-date")).toBe(true);
  });
});

describe("filterKpiScoresInPeriod", () => {
  const isInPeriod = createPeriodMatcher({ ...ALL, periodType: "month", selectedMonth: "2026-03" });

  it("keeps scores whose task deadline is in the period", () => {
    const t = makeTask();
    expect(filterKpiScoresInPeriod([makeScore(t)], isInPeriod)).toHaveLength(1);
  });

  it("drops scores outside the period", () => {
    const t = makeTask({ deadline: "2026-09-01 00:00:00.000Z" });
    expect(filterKpiScoresInPeriod([makeScore(t)], isInPeriod)).toHaveLength(0);
  });

  it("drops scores whose task is soft-deleted", () => {
    const t = makeTask();
    const deleted = makeScore({ ...t, is_deleted: true });
    expect(filterKpiScoresInPeriod([deleted], isInPeriod)).toHaveLength(0);
  });

  it("handles undefined input", () => {
    expect(filterKpiScoresInPeriod(undefined, isInPeriod)).toEqual([]);
  });
});

describe("filterCompletedTasksInPeriod", () => {
  const isInPeriod = createPeriodMatcher({ ...ALL, periodType: "month", selectedMonth: "2026-03" });

  it("keeps only completed tasks inside the period", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b", status: "in_progress" }),
      makeTask({ id: "c", deadline: "2026-10-01 00:00:00.000Z" }),
    ];
    expect(filterCompletedTasksInPeriod(tasks, isInPeriod).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("buildTaskKpi", () => {
  const isInPeriod = createPeriodMatcher(ALL);

  it("returns the stored score when one exists", () => {
    const t = makeTask();
    const stored = makeScore(t, { final_score: 9 });
    const result = buildTaskKpi([t], [stored], isInPeriod);
    expect(result).toHaveLength(1);
    expect(result[0].final_score).toBe(9);
  });

  it("substitutes a zeroed computed placeholder for unscored tasks", () => {
    const t = makeTask();
    const result = buildTaskKpi([t], [], isInPeriod);
    expect(result).toHaveLength(1);
    expect(result[0].final_score).toBe(0);
    // It must still expose the task, otherwise the person loses the credit.
    expect(result[0].expand?.task_id?.id).toBe("t1");
  });

  it("excludes tasks outside the period", () => {
    const t = makeTask({ deadline: "2026-05-01 00:00:00.000Z" });
    const scoped = createPeriodMatcher({ ...ALL, periodType: "month", selectedMonth: "2026-03" });
    expect(buildTaskKpi([t], [], scoped)).toHaveLength(0);
  });
});

describe("aggregateUserKpi", () => {
  it("counts completed tasks and averages final_score per executor", () => {
    const t1 = makeTask({ id: "t1", executor_id: "u1" });
    const t2 = makeTask({ id: "t2", executor_id: "u1" });
    const t3 = makeTask({ id: "t3", executor_id: "u2" });
    const scores = [makeScore(t1, { final_score: 10 }), makeScore(t3, { final_score: 4 })];
    const completed = [t1, t2, t3];

    const rows = aggregateUserKpi([makeUser("u1"), makeUser("u2")], scores, completed);
    expect(rows.map((r) => r.user.id)).toEqual(["u1", "u2"]);
    expect(rows[0]).toMatchObject({ taskCount: 2, avgScore: 10 });
    expect(rows[1]).toMatchObject({ taskCount: 1, avgScore: 4 });
  });

  it("keeps zero-work users by default and drops them with onlyWithTasks", () => {
    const t1 = makeTask({ id: "t1", executor_id: "u1" });
    const scores = [makeScore(t1, { final_score: 5 })];

    const all = aggregateUserKpi([makeUser("u1"), makeUser("idle")], scores, [t1]);
    expect(all).toHaveLength(2);
    expect(all[1]).toMatchObject({ taskCount: 0, avgScore: 0 });

    const busy = aggregateUserKpi([makeUser("u1"), makeUser("idle")], scores, [t1], {
      onlyWithTasks: true,
    });
    expect(busy).toHaveLength(1);
    expect(busy[0].user.id).toBe("u1");
  });

  it("handles undefined users", () => {
    expect(aggregateUserKpi(undefined, [], [])).toEqual([]);
  });
});
