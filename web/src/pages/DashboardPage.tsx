import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useNow } from "../hooks/useNow";
import { usePlans } from "../hooks/usePlans";
import { useTasks } from "../hooks/useTasks";
import { useKpiScores } from "../hooks/useKpiScores";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useDepartments } from "../hooks/useDepartments";
import { PLAN_STATUS_LABELS, TASK_STATUS_LABELS } from "../utils/constants";
import { planInUserGroups, taskInUserGroups, userGroupIds } from "../utils/groupScope";
import type { TaskStatus, PlanStatus } from "@shared/types";

import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import { isTaskOverdue } from "../utils/format";

// Extracted components
import StatCard from "../components/dashboard/StatCard";
import AlertSection from "../components/dashboard/AlertSection";
import RecentPlans from "../components/dashboard/RecentPlans";
import DepartmentStats from "../components/dashboard/DepartmentStats";
import TaskTrendChart from "../components/dashboard/TaskTrendChart";
import KpiOverview from "../components/dashboard/KpiOverview";
import PeriodFilter from "../components/dashboard/PeriodFilter";
import ErrorState from "../components/shared/ErrorState";
import { SkeletonStatCards, SkeletonCard } from "../components/shared/Skeleton";

type StatsMode = "all" | "month" | "quarter" | "year";

const STATUS_CARDS = [
  {
    label: "Chưa làm",
    key: "not_started",
    icon: ClipboardList,
    gradient: "from-slate-400 via-slate-500 to-gray-600",
    shadow: "shadow-slate-500/25",
  },
  {
    label: "Đang làm",
    key: "in_progress",
    icon: Clock,
    gradient: "from-blue-500 via-indigo-500 to-purple-600",
    shadow: "shadow-indigo-500/25",
  },
  {
    label: "Hoàn thành",
    key: "completed",
    icon: CheckCircle2,
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    shadow: "shadow-emerald-500/25",
  },
  {
    label: "Trễ hạn",
    key: "overdue",
    icon: AlertTriangle,
    gradient: "from-rose-500 via-red-500 to-pink-600",
    shadow: "shadow-rose-500/25",
  },
] as const;

export default function DashboardPage() {
  const { data: plans, isLoading: plansLoading, error: plansError } = usePlans();
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useTasks();
  const { data: kpiScores } = useKpiScores();

  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const viewScope = role?.view_scope;
  const userDeptId = user?.expand?.department_id?.id;
  const myGroupIds = userGroupIds(user);
  const { data: departments } = useDepartments();
  const [deptTab, setDeptTab] = usePersistedState<"plans" | "tasks">("dash_deptTab", "plans");

  const [statsMode, setStatsMode] = usePersistedState<StatsMode>("dash_statsMode", "month");
  const [statsYear, setStatsYear] = usePersistedState<number>("dash_statsYear", new Date().getFullYear());
  const [statsQuarter, setStatsQuarter] = usePersistedState<number>("dash_statsQuarter", Math.floor(new Date().getMonth() / 3) + 1);
  const [statsMonth, setStatsMonth] = usePersistedState<string>("dash_statsMonth", format(new Date(), "yyyy-MM"));

  const handleStatsModeChange = (m: StatsMode) => {
    setStatsMode(m);
    if (m === "year") setStatsYear(new Date().getFullYear());
    else if (m === "quarter") {
      setStatsYear(new Date().getFullYear());
      setStatsQuarter(Math.floor(new Date().getMonth() / 3) + 1);
    } else if (m === "month") setStatsMonth(format(new Date(), "yyyy-MM"));
  };

  const statsInPeriod = useCallback((dateStr?: string | null): boolean => {
    if (statsMode === "all") return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (statsMode === "year") return d.getFullYear() === statsYear;
    if (statsMode === "quarter") {
      return d.getFullYear() === statsYear && Math.floor(d.getMonth() / 3) + 1 === statsQuarter;
    }
    return format(d, "yyyy-MM") === statsMonth;
  }, [statsMode, statsYear, statsQuarter, statsMonth]);

  // ── Period options ──
  const periodOptions = useMemo(() => {
    const years = new Set<number>();
    const months = new Set<string>();
    const consider = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      years.add(d.getFullYear());
      months.add(format(d, "yyyy-MM"));
    };
    (tasks || []).forEach((t) => consider(t.deadline || t.created));
    (plans || []).forEach((p) => consider(p.start_date || p.created));
    const now = new Date();
    years.add(now.getFullYear());
    months.add(format(now, "yyyy-MM"));
    return {
      years: Array.from(years).sort((a, b) => b - a),
      months: Array.from(months).sort().reverse(),
    };
  }, [tasks, plans]);

  const yearOptions = useMemo(
    () => periodOptions.years.map((y) => ({ value: String(y), label: String(y) })),
    [periodOptions.years]
  );
  const quarterOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    periodOptions.years.forEach((y) => [1, 2, 3, 4].forEach((q) => opts.push({ value: `${y}-Q${q}`, label: `Q${q}/${y}` })));
    return opts;
  }, [periodOptions.years]);
  const monthOptions = useMemo(
    () => periodOptions.months.map((m) => ({ value: m, label: `Tháng ${format(new Date(m + "-01"), "MM/yyyy", { locale: vi })}` })),
    [periodOptions.months]
  );

  // ── Scoping ──
  const overviewTasks = useMemo(() => {
    if (!tasks || !user) return [];
    if (viewScope === "personal") return tasks.filter((t) => t.executor_id === user.id || t.supervisor_id === user.id || (t.collaborator_ids || []).includes(user.id) || t.expand?.plan_id?.leader_id === user.id);
    if (viewScope === "group") return tasks.filter((t) => taskInUserGroups(t, myGroupIds));
    if (viewScope === "department") {
      if (!userDeptId) return [];
      return tasks.filter((t) => {
        if (t.host_dept_id === userDeptId) return true;
        const plan = t.expand?.plan_id;
        if (plan && (plan.partner_dept_ids || []).includes(userDeptId)) return true;
        return false;
      });
    }
    return tasks;
  }, [tasks, viewScope, user, userDeptId, myGroupIds]);

  const periodTasks = useMemo(
    () => overviewTasks.filter((t) => statsInPeriod(t.deadline || t.created)),
    [overviewTasks, statsInPeriod]
  );

  const overviewPlans = useMemo(() => {
    if (!plans) return [];
    if (viewScope === "all") return plans;
    if (viewScope === "personal") {
      const planIds = new Set(overviewTasks.map((t) => t.plan_id).filter(Boolean));
      return plans.filter((p) => planIds.has(p.id) || p.leader_id === user?.id);
    }
    if (viewScope === "group") return plans.filter((p) => planInUserGroups(p, myGroupIds));
    if (!userDeptId) return [];
    return plans.filter((p) => p.host_dept_id === userDeptId || (p.partner_dept_ids || []).includes(userDeptId));
  }, [plans, viewScope, userDeptId, overviewTasks, user, myGroupIds]);

  const periodPlans = useMemo(
    () => overviewPlans.filter((p) => statsInPeriod(p.start_date || p.created)),
    [overviewPlans, statsInPeriod]
  );

  // ── KPI scores scoped to period tasks ──
  const overviewKpiScores = useMemo(() => {
    if (!kpiScores || !periodTasks.length) return [];
    const taskIds = new Set(periodTasks.map((t) => t.id));
    return kpiScores.filter((k) => taskIds.has(k.task_id));
  }, [kpiScores, periodTasks]);

  // ── Status counts ──
  const taskCounts = useMemo(() => ({
    not_started: periodTasks.filter((t) => t.status === "not_started").length,
    in_progress: periodTasks.filter((t) => t.status === "in_progress").length,
    completed: periodTasks.filter((t) => t.status === "completed").length,
    overdue: periodTasks.filter((t) => isTaskOverdue(t)).length,
  }), [periodTasks]);

  const pendingApproval = useMemo(
    () => periodTasks.filter((t) => t.status === "pending_approval").length,
    [periodTasks]
  );
  const now = useNow();
  const nearDeadline = useMemo(
    () => periodTasks.filter((t) => {
      if (t.status === "completed" || t.status === "cancelled") return false;
      const deadline = new Date(t.deadline);
      if (isNaN(deadline.getTime())) return false;
      const diff = (deadline.getTime() - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 3;
    }).length,
    [periodTasks, now]
  );

  // ── Department stats ──
  const deptStats = useMemo(() => {
    if (!plans || !tasks || !departments) return [];
    const periodPlansAll = plans.filter((p) => statsInPeriod(p.start_date || p.created));
    const periodTasksAll = tasks.filter((t) => statsInPeriod(t.deadline || t.created));
    let deptList = departments.filter((d) => d.is_counted);
    if (viewScope === "department" || viewScope === "personal") {
      deptList = deptList.filter((d) => d.id === userDeptId);
    } else if (viewScope === "group") {
      const groupDeptIds = new Set((user?.expand?.group_ids || []).map((g) => g.department_id).filter(Boolean));
      deptList = deptList.filter((d) => groupDeptIds.has(d.id));
    }
    if (deptList.length === 0) return [];

    const deptIds = new Set(deptList.map((d) => d.id));
    const planCountsByDept: Record<string, Record<string, number>> = {};
    const taskCountsByDept: Record<string, Record<string, number>> = {};
    for (const p of periodPlansAll) {
      if (!deptIds.has(p.host_dept_id)) continue;
      (planCountsByDept[p.host_dept_id] ||= {})[p.status] = (planCountsByDept[p.host_dept_id][p.status] || 0) + 1;
    }
    for (const t of periodTasksAll) {
      if (!deptIds.has(t.host_dept_id)) continue;
      (taskCountsByDept[t.host_dept_id] ||= {})[t.status] = (taskCountsByDept[t.host_dept_id][t.status] || 0) + 1;
    }

    return deptList.map((dept) => {
      const planCounts = planCountsByDept[dept.id] || {};
      const taskCounts = taskCountsByDept[dept.id] || {};
      const planTotal = Object.values(planCounts).reduce((s, v) => s + v, 0);
      const taskTotal = Object.values(taskCounts).reduce((s, v) => s + v, 0);
      return {
        deptId: dept.id,
        deptName: dept.name,
        planTotal,
        taskTotal,
        planData: Object.entries(planCounts).map(([s, v]) => ({ status: s, value: v, label: PLAN_STATUS_LABELS[s as PlanStatus] || s })),
        taskData: Object.entries(taskCounts).map(([s, v]) => ({ status: s, value: v, label: TASK_STATUS_LABELS[s as TaskStatus] || s })),
      };
    });
  }, [plans, tasks, departments, viewScope, userDeptId, user, statsInPeriod]);

  // ── Task trend ──
  const taskTrend = useMemo(() => {
    const monthMap = new Map<string, number>();
    periodTasks.forEach((t) => {
      const d = new Date(t.deadline || t.created);
      if (isNaN(d.getTime())) return;
      const key = format(d, "yyyy-MM", { locale: vi });
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({
        month: format(new Date(month + "-01"), "MM/yyyy", { locale: vi }),
        count,
      }));
  }, [periodTasks]);

  // ── Plans pagination ──
  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = usePersistedState("dash_planPageSize", 8);
  const planTotalPages = Math.max(1, Math.ceil(periodPlans.length / planPageSize));
  const paginatedPlans = useMemo(
    () => periodPlans.slice((planPage - 1) * planPageSize, planPage * planPageSize),
    [periodPlans, planPage, planPageSize]
  );
  const plansResetKey = `${periodPlans.length}|${planPageSize}`;
  const [prevPlansResetKey, setPrevPlansResetKey] = useState(plansResetKey);
  if (prevPlansResetKey !== plansResetKey) {
    setPrevPlansResetKey(plansResetKey);
    setPlanPage(1);
  }

  useEffect(() => {
    usePageTitleStore.getState().setTitle("Tổng quan");
  }, []);

  // ── Loading state ──
  if (plansLoading || tasksLoading) {
    return (
      <div className="space-y-6">
        <SkeletonStatCards count={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard title lines={4} />
          <SkeletonCard title lines={4} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} title={false} lines={3} />
          ))}
        </div>
        <SkeletonCard title lines={5} />
      </div>
    );
  }

  if (plansError || tasksError) {
    return <ErrorState message="Không thể tải dữ liệu. Vui lòng thử lại sau." />;
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <PeriodFilter
        mode={statsMode}
        onModeChange={handleStatsModeChange}
        yearOptions={yearOptions}
        quarterOptions={quarterOptions}
        monthOptions={monthOptions}
        selectedMonth={statsMonth}
        selectedQuarter={`${statsYear}-Q${statsQuarter}`}
        selectedYear={String(statsYear)}
        onMonthChange={setStatsMonth}
        onQuarterChange={(y, q) => { setStatsYear(parseInt(y, 10)); setStatsQuarter(parseInt(q, 10)); }}
        onYearChange={(v) => setStatsYear(parseInt(v, 10))}
        taskCount={periodTasks.length}
        planCount={periodPlans.length}
      />

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_CARDS.map((card) => {
          const count = taskCounts[card.key as keyof typeof taskCounts];
          return (
            <StatCard
              key={card.key}
              label={card.label}
              value={count}
              icon={card.icon}
              gradient={card.gradient}
              shadow={card.shadow}
              trend={String(count)}
            />
          );
        })}
      </div>

      {/* Alerts + Recent Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AlertSection
          pendingApproval={pendingApproval}
          nearDeadline={nearDeadline}
          overdue={taskCounts.overdue}
        />
        <RecentPlans
          plans={paginatedPlans}
          totalCount={periodPlans.length}
          page={planPage}
          totalPages={planTotalPages}
          pageSize={planPageSize}
          onPageChange={setPlanPage}
          onPageSizeChange={setPlanPageSize}
        />
      </div>

      {/* Department stats */}
      <DepartmentStats
        deptStats={deptStats}
        activeTab={deptTab}
        onTabChange={setDeptTab}
      />

      {/* Task trend chart */}
      <TaskTrendChart data={taskTrend} />

      {/* KPI overview */}
      <KpiOverview scores={overviewKpiScores} />
    </div>
  );
}
