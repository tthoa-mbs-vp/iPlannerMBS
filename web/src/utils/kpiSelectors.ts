import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import type { KpiScore, Task, User } from "@shared/types";
import { calculateKpi } from "./kpi";

// Pure selectors for the KPI screen.
//
// KpiPage (desktop) and MKpiPage (mobile) rendered the same numbers from the
// same data with independently written — and slightly divergent — code. Any
// change to how a period or an average is computed had to be made twice, and
// the two copies had already started to disagree. These functions are the one
// implementation; both pages call them.

export type PeriodType = "all" | "month" | "quarter" | "year";

export interface PeriodSelection {
  periodType: PeriodType;
  selectedMonth: string;
  selectedQuarter: string;
  selectedYear: string;
}

/**
 * Build a date predicate for the selected reporting period.
 *
 * An unparseable/missing date is treated as "in period" so a task with a broken
 * deadline is still visible rather than silently dropped from every report.
 */
export function createPeriodMatcher({
  periodType,
  selectedMonth,
  selectedQuarter,
  selectedYear,
}: PeriodSelection): (dateStr: string) => boolean {
  return (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return true;
    if (periodType === "all") return true;
    if (periodType === "month") return format(d, "yyyy-MM") === selectedMonth;
    if (periodType === "quarter") {
      const [year, qStr] = selectedQuarter.split("-Q");
      return String(d.getFullYear()) === year && Math.floor(d.getMonth() / 3) + 1 === Number(qStr);
    }
    return String(d.getFullYear()) === selectedYear;
  };
}

/** Scores whose task is alive and whose deadline falls in the period. */
export function filterKpiScoresInPeriod(
  scores: KpiScore[] | undefined,
  isInPeriod: (dateStr: string) => boolean,
): KpiScore[] {
  return (
    scores?.filter((k) => {
      if (!k.expand?.task_id || k.expand.task_id.is_deleted) return false;
      const deadline = k.expand.task_id.deadline;
      return deadline ? isInPeriod(deadline) : true;
    }) || []
  );
}

export function filterCompletedTasksInPeriod(
  tasks: Task[] | undefined,
  isInPeriod: (dateStr: string) => boolean,
): Task[] {
  return tasks?.filter((t) => t.status === "completed" && isInPeriod(t.deadline)) || [];
}

/**
 * Pair every task in the period with its score: the stored row when one
 * exists, otherwise a zeroed placeholder computed from the task itself.
 *
 * Without this, a task completed inside the period but never scored simply
 * disappeared from the leaderboard, understating that person's workload.
 */
export function buildTaskKpi(
  tasks: Task[] | undefined,
  scored: KpiScore[],
  isInPeriod: (dateStr: string) => boolean,
): KpiScore[] {
  const byTaskId = new Map(scored.map((k) => [k.task_id, k]));
  return (tasks?.filter((t) => isInPeriod(t.deadline)) || []).map((t) => {
    const stored = byTaskId.get(t.id);
    if (stored) return stored;
    const computed = calculateKpi(t);
    return {
      id: "",
      task_id: t.id,
      base_score: computed.base_score!,
      difficulty_coeff: computed.difficulty_coeff!,
      max_converted_score: computed.max_converted_score,
      progress_score: 0,
      result_rating: 0,
      final_score: 0,
      created: "",
      expand: { task_id: t },
    } as KpiScore;
  });
}

export interface UserKpiRow {
  user: User;
  taskCount: number;
  avgScore: number;
}

/**
 * Per-user leaderboard rows, busiest first.
 *
 * `onlyWithTasks` drops people with no completed work in the period. The two
 * screens disagree here — desktop lists every employee, mobile lists only
 * those with work — so it stays an explicit option rather than being silently
 * unified, and the existing behaviour of each screen is preserved.
 */
export function aggregateUserKpi(
  users: User[] | undefined,
  scores: KpiScore[],
  completedTasks: Task[],
  { onlyWithTasks = false }: { onlyWithTasks?: boolean } = {},
): UserKpiRow[] {
  const scoresByExecutor = new Map<string, number[]>();
  for (const k of scores) {
    const executorId = k.expand?.task_id?.executor_id;
    if (!executorId) continue;
    const list = scoresByExecutor.get(executorId) ?? [];
    list.push(k.final_score || 0);
    scoresByExecutor.set(executorId, list);
  }

  const completedByExecutor = new Map<string, number>();
  for (const t of completedTasks) {
    completedByExecutor.set(t.executor_id, (completedByExecutor.get(t.executor_id) ?? 0) + 1);
  }

  return (users || [])
    .map((user) => {
      const values = scoresByExecutor.get(user.id) ?? [];
      const avgScore = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      return {
        user,
        taskCount: completedByExecutor.get(user.id) ?? 0,
        avgScore,
      };
    })
    .filter((row) => (onlyWithTasks ? row.taskCount > 0 : true))
    .sort((a, b) => b.taskCount - a.taskCount);
}

/** Locale-aware helpers used by both KPI screens. */
export function formatPeriodMonth(date: Date): string {
  return format(date, "MM/yyyy", { locale: vi });
}

export function formatPeriodQuarter(date: Date): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

export function formatPeriodYear(date: Date): string {
  return format(date, "yyyy");
}
