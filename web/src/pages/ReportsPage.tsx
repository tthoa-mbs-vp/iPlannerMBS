import { useEffect, useMemo, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useTasks } from "../hooks/useTasks";
import { usePlans } from "../hooks/usePlans";
import { useDepartments } from "../hooks/useDepartments";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { FileDown, PieChart, Building2, ClipboardList, TrendingUp, CheckSquare, BarChart3, Filter } from "lucide-react";
import DepartmentStatsCharts from "../components/reports/DepartmentStatsCharts";
import CheckCombobox from "../components/shared/CheckCombobox";
import PdfExportMenu from "../components/shared/PdfExportMenu";
import { exportToExcel, TASK_EXPORT_COLUMNS, PLAN_EXPORT_COLUMNS } from "../utils/importExport";
import { exportHtmlToPdf } from "../utils/exportPdf";
import { PLAN_STATUS_LABELS, TASK_STATUS_LABELS, TASK_STATUS_HEX, PLAN_STATUS_HEX } from "../utils/constants";
import type { TaskStatus, PlanStatus } from "@shared/types";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import {
  PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import TabBar from "../components/shared/TabBar";
import ErrorState from "../components/shared/ErrorState";
import Spinner from "../components/shared/Spinner";

const statusGradients: Record<string, string> = {
  not_started: "from-slate-400 to-gray-500",
  in_progress: "from-blue-500 to-indigo-600",
  pending_approval: "from-amber-400 to-orange-500",
  completed: "from-emerald-400 to-teal-600",
  proposed_extension: "from-purple-500 to-violet-600",
  proposed_cancellation: "from-rose-500 to-red-600",
  cancelled: "from-slate-400 to-gray-500",
  paused: "from-amber-400 to-orange-500",
};

const deptGradients = [
  "from-indigo-500 to-blue-600",
  "from-purple-500 to-pink-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-500",
  "from-rose-500 to-red-500",
];

export default function ReportsPage() {
  const [reportTab, setReportTab] = usePersistedState<"plans" | "tasks">("report_tab", "tasks");
  const [deptFilters, setDeptFilters] = usePersistedState<string[]>("reports_deptFilters", []);
  const [statusFilters, setStatusFilters] = usePersistedState<string[]>("reports_statusFilters", []);
  const [showFilters, setShowFilters] = useState(false);
  const deptClause = deptFilters.length ? `(${deptFilters.map((id) => `host_dept_id="${id}"`).join("||")})` : "";
  const statusClause = statusFilters.length ? `(${statusFilters.map((s) => `status="${s}"`).join("||")})` : "";
  const taskQueryFilter = [deptClause, statusClause].filter(Boolean).join("&&");
  const planQueryFilter = deptClause;
  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks(taskQueryFilter || undefined);
  const { data: plans, isLoading: plansLoading, error: plansError, refetch: refetchPlans } = usePlans(planQueryFilter || undefined);
  const { data: departments, isLoading: deptsLoading, error: deptsError, refetch: refetchDepts } = useDepartments();

  const taskPieData = useMemo(() => {
    if (!tasks) return [];
    return Object.entries(TASK_STATUS_LABELS)
      .map(([key, label]) => ({
        name: label,
        value: tasks.filter((t) => t.status === key).length,
        color: TASK_STATUS_HEX[key as TaskStatus] || "#94a3b8",
      }))
      .filter((d) => d.value > 0);
  }, [tasks]);

  const planPieData = useMemo(() => {
    if (!plans) return [];
    return Object.entries(PLAN_STATUS_LABELS)
      .map(([key, label]) => ({
        name: label,
        value: plans.filter((p) => p.status === key).length,
        color: PLAN_STATUS_HEX[key as PlanStatus] || "#94a3b8",
      }))
      .filter((d) => d.value > 0);
  }, [plans]);

  const taskTrendData = useMemo(() => {
    if (!tasks) return [];
    const monthMap = new Map<string, number>();
    tasks.forEach((t) => {
      const d = new Date(t.created || t.start_date);
      if (isNaN(d.getTime())) return;
      const key = format(d, "yyyy-MM", { locale: vi });
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: format(new Date(month + "-01"), "MM/yyyy", { locale: vi }),
        count,
      }));
  }, [tasks]);

  const planTrendData = useMemo(() => {
    if (!plans) return [];
    const monthMap = new Map<string, number>();
    plans.forEach((p) => {
      const d = new Date(p.created || p.start_date);
      if (isNaN(d.getTime())) return;
      const key = format(d, "yyyy-MM", { locale: vi });
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: format(new Date(month + "-01"), "MM/yyyy", { locale: vi }),
        count,
      }));
  }, [plans]);

  const handleExportTaskExcel = () => {
    if (!tasks) return;
    const data = tasks.map((t) => ({
      name: t.name,
      status: TASK_STATUS_LABELS[t.status as TaskStatus] || t.status,
      host_dept: t.expand?.host_dept_id?.name || "",
      executor: t.expand?.executor_id?.name || "",
      start_date: t.start_date,
      deadline: t.deadline,
    }));
    exportToExcel(data, TASK_EXPORT_COLUMNS, "bao-cao-nhiem-vu");
  };

  const handleExportPlanExcel = () => {
    if (!plans) return;
    const data = plans.map((p) => ({
      name: p.name,
      status: PLAN_STATUS_LABELS[p.status as PlanStatus] || p.status,
      host_dept: p.expand?.host_dept_id?.name || "",
      start_date: p.start_date,
      end_date: p.end_date,
      progress: p.progress,
    }));
    exportToExcel(data, PLAN_EXPORT_COLUMNS, "bao-cao-ke-hoach");
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yyyy", { locale: vi });
  };

  const buildFilterMeta = () => {
    const parts: string[] = [];
    if (deptFilters.length) {
      const names = deptFilters.map((id) => departments?.find((d) => d.id === id)?.name || id).join(", ");
      parts.push(`Phòng ban: ${names}`);
    }
    if (statusFilters.length) {
      const names = statusFilters
        .map((s) => TASK_STATUS_LABELS[s as TaskStatus] || PLAN_STATUS_LABELS[s as PlanStatus] || s)
        .join(", ");
      parts.push(`Trạng thái: ${names}`);
    }
    return parts.length ? `Bộ lọc: ${parts.join(" · ")}` : "Toàn bộ dữ liệu";
  };

  const handlePrint = async (landscape: boolean) => {
    if (reportTab === "plans") {
      const rows = (plans || []).map((p) => [
        p.name,
        PLAN_STATUS_LABELS[p.status as PlanStatus] || p.status,
        p.expand?.host_dept_id?.name || "",
        fmtDate(p.start_date),
        fmtDate(p.end_date),
        `${p.progress}%`,
      ]);
      const summary = [
        { label: "Tổng kế hoạch", value: rows.length },
        ...Object.entries(PLAN_STATUS_LABELS).map(([key, label]) => ({
          label,
          value: plans?.filter((p) => p.status === key).length || 0,
        })),
      ];
      await exportHtmlToPdf({
        title: "BÁO CÁO KẾ HOẠCH",
        meta: buildFilterMeta(),
        landscape,
        summary,
        columns: [
          { label: "Kế hoạch" },
          { label: "Trạng thái", align: "center" },
          { label: "Phòng ban chủ trì" },
          { label: "Ngày bắt đầu", align: "center" },
          { label: "Ngày kết thúc", align: "center" },
          { label: "Tiến độ", align: "center" },
        ],
        rows,
        filename: "bao-cao-ke-hoach",
      });
      return;
    }
    const rows = (tasks || []).map((t) => [
      t.name,
      TASK_STATUS_LABELS[t.status as TaskStatus] || t.status,
      t.expand?.host_dept_id?.name || "",
      t.expand?.executor_id?.name || "",
      fmtDate(t.start_date),
      fmtDate(t.deadline),
    ]);
    const summary = [
      { label: "Tổng nhiệm vụ", value: rows.length },
      ...Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({
        label,
        value: tasks?.filter((t) => t.status === key).length || 0,
      })),
    ];
    await exportHtmlToPdf({
      title: "BÁO CÁO NHIỆM VỤ",
      meta: buildFilterMeta(),
      landscape,
      summary,
      columns: [
        { label: "Nhiệm vụ" },
        { label: "Trạng thái", align: "center" },
        { label: "Phòng ban chủ trì" },
        { label: "Người thực hiện" },
        { label: "Ngày bắt đầu", align: "center" },
        { label: "Hạn hoàn thành", align: "center" },
      ],
      rows,
      filename: "bao-cao-nhiem-vu",
    });
  };

  useEffect(() => { usePageTitleStore.getState().setTitle("Báo cáo & Thống kê"); }, []);

  const taskTotal = tasks?.length || 1;

  return (
    <div className="flex h-full flex-col gap-5">

      {/* Tab bar + filters */}
      <div className="flex items-center justify-between gap-4">
        <TabBar
          tabs={[
            { key: "plans", label: "Kế hoạch", icon: ClipboardList, gradient: "from-blue-500 to-indigo-600" },
            { key: "tasks", label: "Nhiệm vụ", icon: CheckSquare, gradient: "from-emerald-500 to-teal-600" },
          ]}
          active={reportTab}
          onChange={(k) => setReportTab(k as "plans" | "tasks")}
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowFilters(!showFilters)} title="Bộ lọc báo cáo"
              className={`relative rounded-lg border p-1.5 transition-colors ${(deptFilters.length > 0 || statusFilters.length > 0) ? "border-indigo-300 bg-indigo-100 text-indigo-600" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"}`}>
              <Filter className="h-4 w-4" />
              {(deptFilters.length > 0 || statusFilters.length > 0) && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500" />
              )}
            </button>
            {showFilters && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                  <div className="space-y-2">
                    <CheckCombobox
                      items={(departments || []).filter((d) => d.is_counted).map((d) => ({ id: d.id, label: d.name }))}
                      selected={deptFilters}
                      onToggle={(id) => setDeptFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                      label="Phòng ban"
                      placeholder="Tất cả phòng ban"
                      accentColor="indigo"
                      size="sm"
                    />
                    {reportTab === "tasks" && (
                      <CheckCombobox
                        items={Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({ id: key, label }))}
                        selected={statusFilters}
                        onToggle={(id) => setStatusFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                        label="Trạng thái"
                        placeholder="Tất cả trạng thái"
                        accentColor="indigo"
                        size="sm"
                      />
                    )}
                  </div>
                  {(deptFilters.length > 0 || statusFilters.length > 0) && (
                    <button onClick={() => { setDeptFilters([]); setStatusFilters([]); }}
                      className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors">
                      Xóa lọc
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={reportTab === "plans" ? handleExportPlanExcel : handleExportTaskExcel}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
            <FileDown className="h-3.5 w-3.5" />
            Xuất Excel
          </button>
          <PdfExportMenu onExport={handlePrint} label="Xuất PDF" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-5">
        {reportTab === "plans" ? (
          <>
            {/* Plan status pie + bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm">
                    <PieChart className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Phân bố trạng thái kế hoạch</h3>
                </div>
                {plansError ? (
                  <ErrorState message="Không thể tải dữ liệu" onRetry={refetchPlans} />
                ) : plansLoading ? (
                  <Spinner />
                ) : planPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie data={planPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>
                        {planPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">Chưa có dữ liệu</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-sm">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Thống kê kế hoạch</h3>
                </div>
                {plansError ? (
                  <ErrorState message="Không thể tải dữ liệu" onRetry={refetchPlans} />
                ) : plansLoading ? (
                  <Spinner />
                ) : plans ? (
                  <div className="space-y-3.5">
                    {Object.entries(PLAN_STATUS_LABELS).map(([key, label]) => {
                      const count = plans.filter((p) => p.status === key).length;
                      const total = plans.length || 1;
                      const pct = Math.round((count / total) * 100);
                      if (count === 0) return null;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between text-xs mb-1 font-medium">
                            <span className="text-slate-600 dark:text-slate-300">{label}</span>
                            <span className="text-slate-800 font-bold dark:text-slate-100">{count} <span className="text-[10px] text-slate-400 font-normal dark:text-slate-500">({pct}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 dark:bg-slate-800 dark:border-slate-700/50">
                            <div className={`h-full rounded-full bg-gradient-to-r ${statusGradients[key] || "from-slate-400 to-gray-500"} transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {plans.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-sm text-slate-400 dark:text-slate-500">Chưa có kế hoạch</div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải...</p>
                )}
              </div>
            </div>

            {/* Plan trend */}
            {planTrendData.length > 1 && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Xu hướng kế hoạch theo thời gian</h3>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={planTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Task status pie + bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-sm">
                    <PieChart className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Phân bố trạng thái nhiệm vụ</h3>
                </div>
                {tasksError ? (
                  <ErrorState message="Không thể tải dữ liệu" onRetry={refetchTasks} />
                ) : tasksLoading ? (
                  <Spinner />
                ) : taskPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie data={taskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>
                        {taskPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">Chưa có dữ liệu</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-400 to-teal-600 text-white shadow-sm">
                    <ClipboardList className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Thống kê theo trạng thái</h3>
                </div>
                {tasksError ? (
                  <ErrorState message="Không thể tải dữ liệu" onRetry={refetchTasks} />
                ) : tasksLoading ? (
                  <Spinner />
                ) : tasks ? (
                  <div className="space-y-3.5">
                    {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => {
                      const count = tasks.filter((t) => t.status === key).length;
                      const pct = Math.round((count / taskTotal) * 100);
                      if (count === 0) return null;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between text-xs mb-1 font-medium">
                            <span className="text-slate-600 dark:text-slate-300">{label}</span>
                            <span className="text-slate-800 font-bold dark:text-slate-100">{count} <span className="text-[10px] text-slate-400 font-normal dark:text-slate-500">({pct}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 dark:bg-slate-800 dark:border-slate-700/50">
                            <div className={`h-full rounded-full bg-gradient-to-r ${statusGradients[key] || "from-slate-400 to-gray-500"} transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải...</p>
                )}
              </div>
            </div>

            {/* Task trend */}
            {taskTrendData.length > 1 && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Xu hướng nhiệm vụ theo thời gian</h3>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={taskTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Department per-dept bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 dark:border-slate-700">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm dark:text-slate-100">Thống kê theo phòng ban</h3>
                </div>
                {deptsError ? (
                  <ErrorState message="Không thể tải dữ liệu" onRetry={refetchDepts} />
                ) : deptsLoading ? (
                  <Spinner />
                ) : tasks && departments ? (
                  <div className="space-y-3.5">
                    {departments.filter((d) => d.is_counted).map((dept, idx) => {
                      const count = tasks.filter((t) => t.host_dept_id === dept.id).length;
                      const total = tasks.length || 1;
                      const pct = Math.round((count / total) * 100);
                      if (count === 0) return null;
                      const grad = deptGradients[idx % deptGradients.length];
                      return (
                        <div key={dept.id}>
                          <div className="flex items-center justify-between text-xs mb-1 font-medium">
                            <span className="text-slate-600 dark:text-slate-300">{dept.name}</span>
                            <span className="text-slate-800 font-bold dark:text-slate-100">{count} <span className="text-[10px] text-slate-400 font-normal dark:text-slate-500">({pct}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 dark:bg-slate-800 dark:border-slate-700/50">
                            <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</p>
                )}
              </div>
            </div>

            {/* Department detail charts */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-sm">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Chi tiết theo phòng ban</h3>
              </div>
              <DepartmentStatsCharts />
            </div>


          </>
        )}
      </div>
    </div>
  );
}
