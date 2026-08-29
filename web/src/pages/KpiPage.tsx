import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useKpiScores, useBatchCalculateKpi } from "../hooks/useKpiScores";
import { useTasks } from "../hooks/useTasks";
import { useUsers } from "../hooks/useDepartments";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { Award, CheckCircle, Clock, TrendingUp, RefreshCw, BarChart3, Star, Zap, FileDown, Trophy, User as UserIcon } from "lucide-react";
import KpiTaskTable from "../components/kpi/KpiTaskTable";
import RatingDistCard from "../components/kpi/RatingDistCard";
import { exportToExcel } from "../utils/importExport";
import { exportHtmlToPdf } from "../utils/exportPdf";
import { getRatingBadgeStyle } from "../utils/constants";
import PdfExportMenu from "../components/shared/PdfExportMenu";
import type { ColumnDef } from "../utils/importExport";
import Leaderboard from "../components/kpi/Leaderboard";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import ErrorState from "../components/shared/ErrorState";
import TabBar from "../components/shared/TabBar";
import EmptyState from "../components/shared/EmptyState";
import Pagination from "../components/shared/Pagination";
import { calculateKpi } from "../utils/kpi";
import type { KpiScore } from "@shared/types";

const RATING_LABELS: Record<number, string> = {
  5: "Xuất sắc",
  4: "Tốt",
  3: "Khá",
  2: "Trung bình",
  1: "Cần cải thiện",
};

const RATING_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

const KPI_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "task_name", label: "Nhiệm vụ" },
  { key: "executor", label: "Người thực hiện" },
  { key: "base_score", label: "Điểm cơ bản" },
  { key: "difficulty_coeff", label: "Hệ số khó (%)" },
  { key: "max_score", label: "Điểm tối đa" },
  { key: "progress_score", label: "Mức tiến độ (%)" },
  { key: "result_points", label: "Mức kết quả (%)" },
  { key: "final_score", label: "Điểm thực tế" },
];

function getRating(avgScore: number): number {
  return avgScore >= 10 ? 5 : avgScore >= 7 ? 4 : avgScore >= 5 ? 3 : avgScore >= 3 ? 2 : 1;
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ value: format(d, "yyyy-MM"), label: format(d, "MM/yyyy", { locale: vi }) });
  }
  return options;
}

function getQuarterOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const m = now.getMonth() - i * 3;
    const year = now.getFullYear() + Math.floor((m < 0 ? m - 11 : m) / 12);
    const q = Math.floor(((m % 12 + 12) % 12) / 3) + 1;
    options.push({ value: `${year}-Q${q}`, label: `Q${q}/${year}` });
  }
  return options;
}

function getYearOptions() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const y = now.getFullYear() - i;
    return { value: String(y), label: String(y) };
  });
}

const monthOptions = getMonthOptions();
const quarterOptions = getQuarterOptions();
const yearOptions = getYearOptions();

const PERIOD_TABS = [
  { key: "all", label: "Tất cả", gradient: "from-slate-500 to-slate-600" },
  { key: "month", label: "Tháng", gradient: "from-blue-500 to-indigo-600" },
  { key: "quarter", label: "Quý", gradient: "from-emerald-500 to-teal-600" },
  { key: "year", label: "Năm", gradient: "from-amber-500 to-orange-600" },
];

const VIEW_TABS = [
  { key: "chung", label: "Chung", icon: BarChart3, gradient: "from-sky-500 to-cyan-600" },
  { key: "mine", label: "Của tôi", icon: UserIcon, gradient: "from-violet-500 to-purple-600" },
];



export default function KpiPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.expand?.role_id?.can_manage;
  const { data: kpiScores, error: kpiError, refetch: refetchKpi } = useKpiScores();
  const { data: tasks, error: tasksError, refetch: refetchTasks } = useTasks();
  const { data: users, error: usersError, refetch: refetchUsers } = useUsers();
  const calcKpi = useBatchCalculateKpi();
  const [recalcStatus, setRecalcStatus] = useState("");
  const [viewTab, setViewTab] = usePersistedState<"chung" | "mine">("kpi_viewTab", "chung");
  const [userKpiPage, setUserKpiPage] = useState(1);
  const [userKpiPageSize, setUserKpiPageSize] = usePersistedState("kpi_userPageSize", 10);

  const [periodType, setPeriodType] = usePersistedState<"all" | "month" | "quarter" | "year">("kpi_periodType", "month");
  const [selectedMonth, setSelectedMonth] = usePersistedState("kpi_selectedMonth", format(new Date(), "yyyy-MM"));
  const [selectedQuarter, setSelectedQuarter] = usePersistedState("kpi_selectedQuarter", (() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  })());
  const [selectedYear, setSelectedYear] = usePersistedState("kpi_selectedYear", format(new Date(), "yyyy"));

  const isInPeriod = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    if (periodType === "all") return true;
    if (periodType === "month") return format(d, "yyyy-MM") === selectedMonth;
    if (periodType === "quarter") {
      const [year, qStr] = selectedQuarter.split("-Q");
      return String(d.getFullYear()) === year && Math.floor(d.getMonth() / 3) + 1 === Number(qStr);
    }
    return String(d.getFullYear()) === selectedYear;
  }, [periodType, selectedMonth, selectedQuarter, selectedYear]);

  const completedTasks = useMemo(
    () => tasks?.filter((t) => t.status === "completed") || [],
    [tasks],
  );

  const filteredCompletedTasks = useMemo(
    () => completedTasks.filter((t) => isInPeriod(t.deadline)),
    [completedTasks, isInPeriod],
  );

  const filteredKpiScores = useMemo(
    () => kpiScores?.filter((k) => {
      if (!k.expand?.task_id || k.expand.task_id.is_deleted) return false;
      const d = k.expand.task_id.deadline;
      return d ? isInPeriod(d) : true;
    }) || [],
    [kpiScores, isInPeriod],
  );

  const scoredTaskIds = new Set(filteredKpiScores.map((k) => k.task_id));
  const unscoredTasks = filteredCompletedTasks.filter((t) => !scoredTaskIds.has(t.id));

  const allTaskKpi = useMemo(() => {
    const kpiMap = new Map(filteredKpiScores.map((k) => [k.task_id, k]));
    const allTasks = tasks?.filter((t) => isInPeriod(t.deadline)) || [];
    return allTasks.map((t) => {
      const stored = kpiMap.get(t.id);
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
  }, [tasks, filteredKpiScores, isInPeriod]);

  const userKpi = useMemo(() => {
    return users?.map((u) => {
      const userScores = filteredKpiScores.filter(
        (k) => k.expand?.task_id?.executor_id === u.id,
      ) || [];
      const userCompleted = filteredCompletedTasks.filter((t) => t.executor_id === u.id);
      const avgScore = userScores.length > 0
        ? userScores.reduce((s, k) => s + (k.final_score || 0), 0) / userScores.length
        : 0;
      return { user: u, taskCount: userCompleted.length, avgScore };
    }).sort((a, b) => b.taskCount - a.taskCount) || [];
  }, [users, filteredKpiScores, filteredCompletedTasks]);

  const userKpiTotalPages = Math.max(1, Math.ceil(userKpi.length / userKpiPageSize));
  const paginatedUserKpi = useMemo(() =>
    userKpi.slice((userKpiPage - 1) * userKpiPageSize, userKpiPage * userKpiPageSize)
  , [userKpi, userKpiPage, userKpiPageSize]);

  const userKpiResetKey = `${userKpi.length}|${userKpiPageSize}`;
  const [prevUserKpiResetKey, setPrevUserKpiResetKey] = useState(userKpiResetKey);
  if (prevUserKpiResetKey !== userKpiResetKey) {
    setPrevUserKpiResetKey(userKpiResetKey);
    setUserKpiPage(1);
  }

  const chartData = useMemo(
    () => userKpi.filter((u) => u.taskCount > 0).map((u) => ({
      name: u.user.name || u.user.email?.split("@")[0] || u.user.id.slice(0, 6),
      score: Math.round(u.avgScore * 10) / 10,
      tasks: u.taskCount,
    })),
    [userKpi],
  );

  const ratingDist = useMemo(
    () => [1, 2, 3, 4, 5].map((r) => ({
      name: RATING_LABELS[r],
      value: filteredKpiScores.filter((k) => Math.round(k.result_rating || 0) === r).length || 0,
      color: RATING_COLORS[r - 1],
    })).filter((d) => d.value > 0),
    [filteredKpiScores],
  );

  const trendData = useMemo(() => {
    if (!kpiScores || !tasks) return [];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const months: Record<string, { scores: number[]; count: number }> = {};
    kpiScores.forEach((k) => {
      const task = taskMap.get(k.task_id);
      if (!task) return;
      const key = format(new Date(task.deadline), "MM/yy");
      if (!months[key]) months[key] = { scores: [], count: 0 };
      months[key].scores.push(k.final_score);
      months[key].count++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => {
        const [mA, yA] = a.split("/");
        const [mB, yB] = b.split("/");
        return Number(yA) * 12 + Number(mA) - (Number(yB) * 12 + Number(mB));
      })
      .slice(-12)
      .map(([month, data]) => ({
        month,
        avgScore: Math.round((data.scores.reduce((s, v) => s + v, 0) / data.scores.length) * 10) / 10,
        count: data.count,
      }));
  }, [kpiScores, tasks]);

  const myKpiScores = useMemo(
    () => filteredKpiScores.filter((k) => k.expand?.task_id?.executor_id === user?.id),
    [filteredKpiScores, user],
  );

  const myTaskKpi = useMemo(() => {
    const kpiMap = new Map(myKpiScores.map((k) => [k.task_id, k]));
    const myTasks = tasks?.filter((t) => t.executor_id === user?.id && isInPeriod(t.deadline)) || [];
    return myTasks.map((t) => {
      const stored = kpiMap.get(t.id);
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
  }, [tasks, myKpiScores, isInPeriod, user]);

  const myCompletedCount = useMemo(
    () => filteredCompletedTasks.filter((t) => t.executor_id === user?.id).length,
    [filteredCompletedTasks, user],
  );

  const myAvgScore = useMemo(
    () => myKpiScores.length > 0 ? myKpiScores.reduce((s, k) => s + (k.final_score || 0), 0) / myKpiScores.length : 0,
    [myKpiScores],
  );

  const myRatingDist = useMemo(
    () => [1, 2, 3, 4, 5].map((r) => ({
      name: RATING_LABELS[r],
      value: myKpiScores.filter((k) => Math.round(k.result_rating || 0) === r).length || 0,
      color: RATING_COLORS[r - 1],
    })).filter((d) => d.value > 0),
    [myKpiScores],
  );

  const handleRecalculateAll = useCallback(async () => {
    if (!canManage) return;
    if (unscoredTasks.length === 0) return;
    setRecalcStatus(`Đang tính KPI cho ${unscoredTasks.length} nhiệm vụ...`);
    try {
      const { created, failed } = await calcKpi.mutateAsync();
      setRecalcStatus(`Đã tính KPI cho ${created} nhiệm vụ${failed ? ` (${failed} thất bại)` : ""}.`);
    } catch (err: unknown) {
      setRecalcStatus(err instanceof Error ? err.message : "Không thể tính lại KPI.");
    }
    setTimeout(() => setRecalcStatus(""), 3000);
  }, [canManage, unscoredTasks.length, calcKpi, setRecalcStatus]);

  const buildExportRows = (list: KpiScore[]) => list.map((k) => {
    const maxScore = k.max_converted_score ?? Math.round(k.base_score * k.difficulty_coeff * 10) / 10;
    const isFinalValid = k.id !== "";
    return {
      task_name: k.expand?.task_id?.name || k.task_id,
      executor: k.expand?.task_id?.expand?.executor_id?.name || "",
      base_score: k.base_score,
      difficulty_coeff: (k.difficulty_coeff * 100).toFixed(0),
      max_score: maxScore.toFixed(1),
      progress_score: isFinalValid ? `${k.progress_score}%` : "0%",
      result_points: isFinalValid ? `${Math.round((k.result_rating / 5) * 100)}%` : "0%",
      final_score: isFinalValid ? k.final_score : 0,
    };
  });

  const handleExport = () => {
    exportToExcel(buildExportRows(allTaskKpi), KPI_EXPORT_COLUMNS, "bao-cao-kpi", {
      title: "BÁO CÁO ĐIỂM KPI",
      highlightHeader: true,
      groupBy: (row) => row.executor || "Chưa phân công",
    });
  };

  const handleExportMine = () => {
    exportToExcel(buildExportRows(myTaskKpi), KPI_EXPORT_COLUMNS, "bao-cao-kpi-cua-toi", {
      title: "BÁO CÁO KPI CỦA TÔI",
      highlightHeader: true,
      groupBy: (row) => row.executor || "Chưa phân công",
    });
  };

  const getPeriodLabel = () => {
    if (periodType === "all") return "Tất cả";
    if (periodType === "month") return `Tháng ${format(new Date(`${selectedMonth}-01`), "MM/yyyy")}`;
    if (periodType === "quarter") {
      const [year, qStr] = selectedQuarter.split("-Q");
      return `Quý ${qStr}/${year}`;
    }
    return `Năm ${selectedYear}`;
  };

  const handlePrint = async (landscape: boolean) => {
    const source = viewTab === "chung" ? allTaskKpi : myTaskKpi;
    const rows = buildExportRows(source);
    const groups = rows.filter((r) => r.executor).length;
    const allFinal = rows.filter((r) => r.final_score).map((r) => r.final_score);
    const avg = allFinal.length > 0 ? allFinal.reduce((s, v) => s + v, 0) / allFinal.length : 0;
    await exportHtmlToPdf({
      title: viewTab === "chung" ? "BÁO CÁO ĐIỂM KPI" : "BÁO CÁO KPI CỦA TÔI",
      meta: `Kỳ: ${getPeriodLabel()}`,
      landscape,
      summary: [
        { label: "Tổng nhiệm vụ", value: rows.length },
        { label: "Số người thực hiện", value: groups },
        { label: "Điểm trung bình", value: avg.toFixed(1) },
      ],
      columns: [
        { label: "Nhiệm vụ" },
        { label: "Người thực hiện" },
        { label: "Điểm cơ bản", align: "center" },
        { label: "Hệ số khó (%)", align: "center" },
        { label: "Điểm tối đa", align: "center" },
        { label: "Tiến độ (%)", align: "center" },
        { label: "Kết quả (%)", align: "center" },
        { label: "Điểm thực tế", align: "center" },
      ],
      rows: rows.map((r) => [
        r.task_name,
        r.executor || "Chưa phân công",
        r.base_score,
        r.difficulty_coeff,
        r.max_score,
        r.progress_score,
        r.result_points,
        r.final_score,
      ]),
      rowGroups: rows.map((r) => r.executor || "Chưa phân công"),
      filename: viewTab === "chung" ? "bao-cao-kpi" : "bao-cao-kpi-cua-toi",
    });
  };

  const autoCalcDone = useRef(false);
  useEffect(() => {
    usePageTitleStore.getState().setTitle("Điểm KPI & Đánh giá");
    if (canManage && unscoredTasks.length > 0 && !autoCalcDone.current && !calcKpi.isPending) {
      autoCalcDone.current = true;
      handleRecalculateAll();
    }
  }, [unscoredTasks.length, calcKpi.isPending, canManage, handleRecalculateAll]);

  if (kpiError || tasksError || usersError) {
    const msg = (kpiError || tasksError || usersError) as Error | null;
    return (
      <ErrorState
        message="Không thể tải dữ liệu"
        subMessage={msg?.message || "Vui lòng thử lại"}
        onRetry={() => { refetchKpi(); refetchTasks(); refetchUsers(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <TabBar variant="page" tabs={VIEW_TABS} active={viewTab} onChange={(k) => setViewTab(k as "chung" | "mine")} />
        <div className="flex items-center gap-3">
          <button onClick={viewTab === "chung" ? handleExport : handleExportMine} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:scale-[1.02] active:scale-95 dark:border-slate-700 dark:bg-slate-800">
            <FileDown className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            Xuất Excel
          </button>
          <PdfExportMenu onExport={handlePrint} />
          {viewTab === "chung" && canManage && unscoredTasks.length > 0 && (
            <button onClick={handleRecalculateAll} disabled={calcKpi.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${calcKpi.isPending ? "animate-spin" : ""}`} />
              Tính KPI ({unscoredTasks.length})
            </button>
          )}
        </div>
      </div>

      {recalcStatus && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/60 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {recalcStatus}
        </div>
      )}

      {viewTab === "chung" ? (
        <>
      {/* Time filter */}
      <div className="flex items-center gap-3">
        <TabBar
          tabs={PERIOD_TABS}
          active={periodType}
          onChange={(k) => setPeriodType(k as "all" | "month" | "quarter" | "year")}
          size="sm"
        />
        {periodType === "month" && (
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {periodType === "quarter" && (
          <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
            {quarterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {periodType === "year" && (
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-400 dark:text-slate-500">
          ({filteredCompletedTasks.length} NV hoàn thành · {filteredKpiScores.length} điểm KPI)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-blue-100/40 via-indigo-100/30 to-transparent dark:from-blue-900/20 dark:via-indigo-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{filteredCompletedTasks.length}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">NV hoàn thành</p>
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
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{tasks?.length || 0}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng nhiệm vụ</p>
            </div>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-amber-100/40 via-orange-100/30 to-transparent dark:from-amber-900/20 dark:via-orange-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2.5 shadow-lg shadow-amber-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{filteredKpiScores.length}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Điểm KPI</p>
            </div>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-purple-100/40 via-pink-100/30 to-transparent dark:from-purple-900/20 dark:via-pink-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 p-2.5 shadow-lg shadow-purple-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{users?.length || 0}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Người dùng</p>
            </div>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <BarChart3 className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              Điểm KPI trung bình theo người dùng
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <RatingDistCard data={ratingDist} />
        </div>
      )}

      {trendData.length > 1 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            Xu hướng điểm KPI theo thời gian
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="avgScore" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} name="Điểm TB" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-100">KPI theo người dùng</h3>
        {userKpi.length === 0 ? (
          <EmptyState icon={Award} message="Chưa có dữ liệu KPI. Hoàn thành nhiệm vụ để tính điểm." className="py-12" />
        ) : (
          <>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Người dùng</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">NV hoàn thành</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Điểm TB</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUserKpi.map(({ user, taskCount, avgScore }) => {
                const rating = getRating(avgScore);
                return (
                  <tr key={user.id} className="even:bg-slate-100 dark:even:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{user.name || user.email}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">{taskCount}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">{avgScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getRatingBadgeStyle(rating)}`}>
                        {rating >= 4 && <Zap className="h-3 w-3" />}
                        {RATING_LABELS[rating]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <Pagination
            page={userKpiPage}
            totalPages={userKpiTotalPages}
            onChange={setUserKpiPage}
            pageSize={userKpiPageSize}
            onPageSizeChange={setUserKpiPageSize}
            totalCount={userKpi.length}
          />
          </>
        )}
      </div>

      {allTaskKpi.length > 0 ? (
        <KpiTaskTable items={allTaskKpi} title="Chi tiết điểm KPI" />
      ) : (
        <EmptyState icon={Award} message="Chưa có dữ liệu KPI." className="py-12" />
      )}

      {/* Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-yellow-500 to-amber-600 text-white shadow-md shadow-yellow-500/20">
            <Trophy className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Bảng Xếp hạng Thi đua
          </h3>
        </div>
        <Leaderboard />
      </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <TabBar
              tabs={PERIOD_TABS}
              active={periodType}
              onChange={(k) => setPeriodType(k as "all" | "month" | "quarter" | "year")}
              size="sm"
            />
            {periodType === "month" && (
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {periodType === "quarter" && (
              <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
                {quarterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {periodType === "year" && (
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 px-3.5 py-2 text-sm shadow-2xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:focus:bg-slate-800">
                {yearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({myCompletedCount} NV hoàn thành · {myKpiScores.length} điểm KPI)
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-700 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-indigo-200">KPI của tôi</p>
                <h2 className="mt-1 text-2xl font-bold">{user?.name || user?.email}</h2>
              </div>
              <Award className="h-10 w-10 text-indigo-200/50" />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-indigo-400/30 pt-4 text-center">
              <div>
                <p className="text-xs text-indigo-200">NV hoàn thành</p>
                <p className="text-xl font-bold">{myCompletedCount}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-200">Điểm TB</p>
                <p className="text-xl font-bold">{myAvgScore.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-200">Xếp loại</p>
                <p className="text-xl font-bold">{RATING_LABELS[getRating(myAvgScore)]}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-100/40 via-teal-100/30 to-transparent dark:from-emerald-900/20 dark:via-teal-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 p-2.5 shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{myTaskKpi.length}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng nhiệm vụ của tôi</p>
                </div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-purple-100/40 via-pink-100/30 to-transparent dark:from-purple-900/20 dark:via-pink-900/20 opacity-60 transition-all duration-500 group-hover:scale-150" />
              <div className="relative flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 p-2.5 shadow-lg shadow-purple-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{myKpiScores.length}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Điểm KPI đã chấm</p>
                </div>
              </div>
            </div>
          </div>

          {myRatingDist.length > 0 && <RatingDistCard data={myRatingDist} />}

          {myTaskKpi.length > 0 ? (
            <KpiTaskTable items={myTaskKpi} title="Chi tiết điểm KPI của tôi" />
          ) : (
            <EmptyState icon={Award} message="Bạn chưa có nhiệm vụ trong kỳ này." subMessage="Hoàn thành nhiệm vụ để được chấm điểm KPI" className="py-12" />
          )}
        </div>
      )}
    </div>
  );
}
