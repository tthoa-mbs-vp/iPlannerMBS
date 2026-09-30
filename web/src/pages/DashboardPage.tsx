import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useNow } from "../hooks/useNow";
import { usePlans } from "../hooks/usePlans";
import { useTasks } from "../hooks/useTasks";
import { useKpiScores } from "../hooks/useKpiScores";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useDepartments } from "../hooks/useDepartments";
import { PLAN_STATUS_LABELS, TASK_STATUS_LABELS, PLAN_STATUS_STYLES, TASK_STATUS_HEX, PLAN_STATUS_HEX } from "../utils/constants";
import { planInUserGroups, taskInUserGroups, userGroupIds } from "../utils/groupScope";
import type { TaskStatus, PlanStatus } from "@shared/types";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Building2,
  ArrowRight,
  Star,
  TrendingUp,
} from "lucide-react";
import TabBar from "../components/shared/TabBar";
import DonutChart from "../components/shared/DonutChart";
import ErrorState from "../components/shared/ErrorState";
import EmptyState from "../components/shared/EmptyState";
import { SkeletonCard, SkeletonStatCards } from "../components/shared/Skeleton";
import Pagination from "../components/shared/Pagination";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import { isTaskOverdue } from "../utils/format";

const statusCards = [
  {
    label: "Chưa làm",
    key: "not_started",
    icon: ClipboardList,
    gradient: "from-slate-400 via-slate-500 to-gray-600",
    shadow: "shadow-slate-500/25",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-600",
    badgeBg: "bg-slate-100 text-slate-700 dark:text-slate-200",
  },
  {
    label: "Đang làm",
    key: "in_progress",
    icon: Clock,
    gradient: "from-blue-500 via-indigo-500 to-purple-600",
    shadow: "shadow-indigo-500/25",
    borderHover: "hover:border-indigo-300 dark:hover:border-indigo-500/50",
    badgeBg: "bg-indigo-100 text-indigo-700",
  },
  {
    label: "Hoàn thành",
    key: "completed",
    icon: CheckCircle2,
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    shadow: "shadow-emerald-500/25",
    borderHover: "hover:border-emerald-300 dark:hover:border-emerald-500/50",
    badgeBg: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Trễ hạn",
    key: "overdue",
    icon: AlertTriangle,
    gradient: "from-rose-500 via-red-500 to-pink-600",
    shadow: "shadow-rose-500/25",
    borderHover: "hover:border-rose-300 dark:hover:border-rose-500/50",
    badgeBg: "bg-rose-100 text-rose-700",
  },
];

type StatsMode = "all" | "month" | "quarter" | "year";
const PERIOD_TABS: { key: StatsMode; label: string; gradient: string }[] = [
  { key: "all", label: "Tất cả", gradient: "from-slate-500 to-slate-600" },
  { key: "month", label: "Tháng", gradient: "from-blue-500 to-indigo-600" },
  { key: "quarter", label: "Quý", gradient: "from-emerald-500 to-teal-600" },
  { key: "year", label: "Năm", gradient: "from-amber-500 to-orange-600" },
];
const QUARTERS = [1, 2, 3, 4];

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
    periodOptions.years.forEach((y) => QUARTERS.forEach((q) => opts.push({ value: `${y}-Q${q}`, label: `Q${q}/${y}` })));
    return opts;
  }, [periodOptions.years]);

  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = usePersistedState("dash_planPageSize", 8);

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

  // Apply the selected stats period (deadline-based for tasks).
  const periodTasks = useMemo(() =>
    overviewTasks.filter((t) => statsInPeriod(t.deadline || t.created))
  , [overviewTasks, statsInPeriod]);

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

  // Apply the selected stats period (start_date-based for plans).
  const periodPlans = useMemo(() =>
    overviewPlans.filter((p) => statsInPeriod(p.start_date || p.created))
  , [overviewPlans, statsInPeriod]);

  const overviewKpiScores = useMemo(() => {
    if (!kpiScores || !periodTasks.length) return [];
    const taskIds = new Set(periodTasks.map((t) => t.id));
    return kpiScores.filter((k) => taskIds.has(k.task_id));
  }, [kpiScores, periodTasks]);

  const taskCounts = useMemo(() => ({
    not_started: periodTasks.filter((t) => t.status === "not_started").length,
    in_progress: periodTasks.filter((t) => t.status === "in_progress").length,
    completed: periodTasks.filter((t) => t.status === "completed").length,
    overdue: periodTasks.filter((t) => isTaskOverdue(t)).length,
  }), [periodTasks]);

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
        deptId: dept.id, deptName: dept.name,
        planTotal, taskTotal,
        planData: Object.entries(planCounts).map(([s, v]) => ({ status: s, value: v, label: PLAN_STATUS_LABELS[s as PlanStatus] || s })),
        taskData: Object.entries(taskCounts).map(([s, v]) => ({ status: s, value: v, label: TASK_STATUS_LABELS[s as TaskStatus] || s })),
      };
    });
  }, [plans, tasks, departments, viewScope, userDeptId, user, statsInPeriod]);

  const pendingApproval = useMemo(
    () => periodTasks.filter((t) => t.status === "pending_approval").length,
    [periodTasks],
  );
  const now = useNow();
  const nearDeadline = useMemo(
    () => periodTasks.filter((t) => {
      if (t.status === "completed" || t.status === "cancelled") return false;
      const deadline = new Date(t.deadline);
      if (isNaN(deadline.getTime())) return false;
      const diff =
        (deadline.getTime() - now) /
        (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 3;
    }).length,
    [periodTasks, now],
  );

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

  const planTotalPages = Math.max(1, Math.ceil(periodPlans.length / planPageSize));
  const paginatedPlans = useMemo(() =>
    periodPlans.slice((planPage - 1) * planPageSize, planPage * planPageSize)
  , [periodPlans, planPage, planPageSize]);

  const plansResetKey = `${periodPlans.length}|${planPageSize}`;
  const [prevPlansResetKey, setPrevPlansResetKey] = useState(plansResetKey);
  if (prevPlansResetKey !== plansResetKey) {
    setPrevPlansResetKey(plansResetKey);
    setPlanPage(1);
  }

  useEffect(() => { usePageTitleStore.getState().setTitle("Tổng quan"); }, []);

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

  if (plansError || tasksError) return <ErrorState message="Không thể tải dữ liệu. Vui lòng thử lại sau." />;

  return (
    <div className="space-y-6">
      {/* Time filter */}
      <div className="flex items-center gap-3">
        <TabBar
          tabs={PERIOD_TABS}
          active={statsMode}
          onChange={(k) => handleStatsModeChange(k as StatsMode)}
          size="sm"
        />
        {statsMode === "month" && (
          <select aria-label="Chọn tháng" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
            {periodOptions.months.map((m) => <option key={m} value={m}>Tháng {format(new Date(m + "-01"), "MM/yyyy", { locale: vi })}</option>)}
          </select>
        )}
        {statsMode === "quarter" && (
          <select aria-label="Chọn quý" value={`${statsYear}-Q${statsQuarter}`}
            onChange={(e) => {
              const [y, q] = e.target.value.split("-Q");
              setStatsYear(parseInt(y, 10));
              setStatsQuarter(parseInt(q, 10));
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
            {quarterOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
        {statsMode === "year" && (
          <select aria-label="Chọn năm" value={String(statsYear)} onChange={(e) => setStatsYear(parseInt(e.target.value, 10))}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
            {yearOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
        <span className="text-xs text-slate-400 dark:text-slate-500">
          ({periodTasks.length} NV · {periodPlans.length} KH)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statusCards.map((card) => {
          const Icon = card.icon;
          const count = taskCounts[card.key as keyof typeof taskCounts];
          return (
            <div
              key={card.key}
              className={`group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 ${card.borderHover} hover:shadow-lg hover:-translate-y-0.5`}
            >
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br from-indigo-100/40 via-purple-100/30 to-transparent dark:from-indigo-900/20 dark:via-purple-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate" title={card.label}>
                    {card.label}
                  </p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                    {count}
                  </p>
                </div>
                <div
                  className={`rounded-lg bg-gradient-to-br ${card.gradient} p-2 shadow-md ${card.shadow} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0`}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${card.gradient} transition-all duration-500`}
                  style={{ width: `${Math.min(count * 10, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2 shadow-lg shadow-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Cảnh báo</h3>
            </div>
            <Link to="/tasks" className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors">
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1.5 overflow-y-auto scrollbar-thin max-h-48 pr-1">
            {pendingApproval > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                <Clock className="h-4 w-4 shrink-0" />
                {pendingApproval} nhiệm vụ chờ duyệt
              </div>
            )}
            {nearDeadline > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 px-3 py-2 text-sm text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {nearDeadline} nhiệm vụ sắp đến hạn (≤3 ngày)
              </div>
            )}
            {taskCounts.overdue > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {taskCounts.overdue} nhiệm vụ trễ hạn
              </div>
            )}
            {pendingApproval === 0 &&
              nearDeadline === 0 &&
              taskCounts.overdue === 0 && (
                <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  Không có cảnh báo
                </div>
              )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2 shadow-lg shadow-blue-500/20">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Kế hoạch gần đây</h3>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/plans" className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors">
                Xem tất cả <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          {periodPlans.length > 0 ? (
            <div className="space-y-1.5 overflow-y-auto scrollbar-thin max-h-48 pr-1">
              {paginatedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="group flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm transition-all duration-200 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-gradient-to-r hover:from-indigo-50 dark:hover:from-indigo-950/40 hover:to-blue-50 dark:hover:to-blue-950/40"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 truncate">
                    {plan.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_STATUS_STYLES[plan.status] || ""}`}
                  >
                    {PLAN_STATUS_LABELS[plan.status] || plan.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} message="Chưa có kế hoạch" className="py-8" />
          )}
          <Pagination
            page={planPage}
            totalPages={planTotalPages}
            onChange={setPlanPage}
            pageSize={planPageSize}
            onPageSizeChange={setPlanPageSize}
            totalCount={periodPlans.length}
          />
        </div>
      </div>

      {deptStats.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Thống kê theo phòng ban</h3>
            </div>
            <TabBar
              tabs={[
                { key: "plans", label: "Kế hoạch", gradient: "from-blue-500 to-indigo-600" },
                { key: "tasks", label: "Nhiệm vụ", gradient: "from-emerald-500 to-teal-600" },
              ]}
              active={deptTab}
              onChange={(k) => setDeptTab(k as "plans" | "tasks")}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {deptStats.map((stat) => (
              <div key={stat.deptId}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={stat.deptName}>{stat.deptName}</h4>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{deptTab === "plans" ? stat.planTotal : stat.taskTotal}</span>
                </div>
                {deptTab === "plans" && (
                  stat.planData.length > 0 ? (
                    <div className="flex justify-center">
                      <DonutChart data={stat.planData} colorFor={(s) => PLAN_STATUS_HEX[s as PlanStatus] || "#cbd5e1"} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-xs text-slate-300 dark:text-slate-600">Chưa có dữ liệu</div>
                  )
                )}
                {deptTab === "tasks" && (
                  stat.taskData.length > 0 ? (
                    <div className="flex justify-center">
                      <DonutChart data={stat.taskData} colorFor={(s) => TASK_STATUS_HEX[s as TaskStatus] || "#cbd5e1"} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-xs text-slate-300 dark:text-slate-600">Chưa có dữ liệu</div>
                  )
                )}
              </div>
            ))}
          </div>
          {taskTrend.length > 1 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:shadow-lg">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2 shadow-lg shadow-cyan-500/20">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Xu hướng nhiệm vụ theo thời gian</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={taskTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: "#0ea5e9", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-white/60 px-4 py-2.5 text-xs dark:bg-white/5">
            {(deptTab === "plans" ? Object.entries(PLAN_STATUS_LABELS) : Object.entries(TASK_STATUS_LABELS)).map(([key, label]) => {
              const hex = deptTab === "plans" ? PLAN_STATUS_HEX[key as PlanStatus] : TASK_STATUS_HEX[key as TaskStatus];
              return (
                <span key={key} className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex || "#cbd5e1" }} />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {overviewKpiScores.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-2 shadow-lg shadow-amber-500/20">
                <Award className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Tổng quan KPI</h3>
            </div>
            <Link to="/kpi" className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors">
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-amber-100/40 via-orange-100/30 to-transparent dark:from-amber-900/20 dark:via-orange-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2.5 shadow-lg shadow-amber-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{overviewKpiScores.length}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Đã chấm điểm</p>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-100/40 via-teal-100/30 to-transparent dark:from-emerald-900/20 dark:via-teal-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 p-2.5 shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {(overviewKpiScores.reduce((s, k) => s + k.final_score, 0) / overviewKpiScores.length).toFixed(1)}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Điểm TB</p>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-blue-100/40 via-indigo-100/30 to-transparent dark:from-blue-900/20 dark:via-indigo-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 shadow-lg shadow-indigo-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">
                    {overviewKpiScores.filter((k) => k.result_rating >= 4).length}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Xuất sắc / Tốt</p>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-cyan-100/40 via-blue-100/30 to-transparent dark:from-cyan-900/20 dark:via-blue-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {overviewKpiScores.filter((k) => k.result_rating >= 3).length}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Từ Khá trở lên</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
