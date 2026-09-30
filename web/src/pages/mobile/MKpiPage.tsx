import { useCallback, useMemo, useState } from "react";
import { useKpiScores } from "../../hooks/useKpiScores";
import { useTasks } from "../../hooks/useTasks";
import { useUsers } from "../../hooks/useDepartments";
import { useAuthStore } from "../../stores/authStore";
import { calculateKpi } from "../../utils/kpi";
import { getRatingBadgeStyle } from "../../utils/constants";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import Leaderboard from "../../components/kpi/Leaderboard";
import {
  Award,
  CheckCircle2,
  TrendingUp,
  User as UserIcon,
  Trophy,
  Zap,
  ClipboardList,
} from "lucide-react";
import type { KpiScore } from "@shared/types";

const RATING_LABELS: Record<number, string> = {
  5: "Xuất sắc",
  4: "Tốt",
  3: "Khá",
  2: "Trung bình",
  1: "Cần cải thiện",
};

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
  { key: "all", label: "Tất cả" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

export default function MKpiPage() {
  const user = useAuthStore((s) => s.user);
  const { data: kpiScores } = useKpiScores();
  const { data: tasks } = useTasks();
  const { data: users = [] } = useUsers();

  const [viewTab, setViewTab] = useState<"mine" | "rank">("mine");
  const [periodType, setPeriodType] = useState<"all" | "month" | "quarter" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  });
  const [selectedYear, setSelectedYear] = useState(format(new Date(), "yyyy"));

  const isInPeriod = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      if (periodType === "all") return true;
      if (periodType === "month") return format(d, "yyyy-MM") === selectedMonth;
      if (periodType === "quarter") {
        const [year, qStr] = selectedQuarter.split("-Q");
        return String(d.getFullYear()) === year && Math.floor(d.getMonth() / 3) + 1 === Number(qStr);
      }
      return String(d.getFullYear()) === selectedYear;
    },
    [periodType, selectedMonth, selectedQuarter, selectedYear]
  );

  const filteredKpiScores = useMemo(
    () =>
      kpiScores?.filter((k) => {
        if (!k.expand?.task_id || k.expand.task_id.is_deleted) return false;
        return isInPeriod(k.expand.task_id.deadline);
      }) || [],
    [kpiScores, isInPeriod]
  );

  const filteredCompletedTasks = useMemo(
    () => tasks?.filter((t) => t.status === "completed" && isInPeriod(t.deadline)) || [],
    [tasks, isInPeriod]
  );

  const myTaskKpi = useMemo(() => {
    const kpiMap = new Map(filteredKpiScores.map((k) => [k.task_id, k]));
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
  }, [tasks, filteredKpiScores, isInPeriod, user]);

  const myScores = useMemo(
    () => filteredKpiScores.filter((k) => k.expand?.task_id?.executor_id === user?.id),
    [filteredKpiScores, user]
  );

  const myCompletedCount = useMemo(
    () => filteredCompletedTasks.filter((t) => t.executor_id === user?.id).length,
    [filteredCompletedTasks, user]
  );

  const myAvgScore = myScores.length
    ? myScores.reduce((s, k) => s + (k.final_score || 0), 0) / myScores.length
    : 0;

  const userKpi = useMemo(() => {
    return users
      .map((u) => {
        const userScores = filteredKpiScores.filter(
          (k) => k.expand?.task_id?.executor_id === u.id
        );
        const userCompleted = filteredCompletedTasks.filter((t) => t.executor_id === u.id);
        const avgScore =
          userScores.length > 0
            ? userScores.reduce((s, k) => s + (k.final_score || 0), 0) / userScores.length
            : 0;
        return {
          user: u,
          taskCount: userCompleted.length,
          avgScore,
        };
      })
      .filter((x) => x.taskCount > 0)
      .sort((a, b) => b.taskCount - a.taskCount);
  }, [users, filteredKpiScores, filteredCompletedTasks]);

  const renderKpiRow = (k: KpiScore) => {
    const task = k.expand?.task_id;
    const maxScore = k.max_converted_score ?? Math.round(k.base_score * k.difficulty_coeff * 10) / 10;
    const isFinalValid = k.id !== "";
    return (
      <div key={task?.id || k.task_id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700">{task?.name || k.task_id}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Cơ bản {k.base_score} · Khó {(k.difficulty_coeff * 100).toFixed(0)}% · Tối đa {maxScore.toFixed(1)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold ${isFinalValid ? "text-indigo-600" : "text-slate-300"}`}>
            {isFinalValid ? k.final_score : "—"}
          </p>
          {isFinalValid ? (
            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${getRatingBadgeStyle(k.result_rating)}`}>
              {RATING_LABELS[Math.round(k.result_rating)] || k.result_rating}
            </span>
          ) : (
            <span className="mt-0.5 inline-block text-[10px] text-slate-300">Chưa chấm</span>
          )}
        </div>
      </div>
    );
  };

  const statCards = [
    { label: "NV hoàn thành", value: filteredCompletedTasks.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Tổng nhiệm vụ", value: tasks?.length || 0, icon: ClipboardList, color: "text-indigo-600", bg: "bg-indigo-100" },
    { label: "Điểm KPI", value: filteredKpiScores.length, icon: Award, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Người dùng", value: users.length, icon: UserIcon, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  const periodSelect =
    periodType === "month" ? (
      <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none">
        {monthOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : periodType === "quarter" ? (
      <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none">
        {quarterOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : periodType === "year" ? (
      <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none">
        {yearOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : null;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 text-white">
              <Award className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-800">KPI & Xếp hạng</h2>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {([
              { key: "mine", label: "Của tôi" },
              { key: "rank", label: "Xếp hạng" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setViewTab(t.key)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  viewTab === t.key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setPeriodType(t.key as typeof periodType)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  periodType === t.key
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {periodSelect}
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {viewTab === "mine" ? (
          <>
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-indigo-200">KPI của tôi</p>
                  <h3 className="mt-0.5 text-lg font-bold">{user?.name || user?.email}</h3>
                </div>
                <Award className="h-9 w-9 text-indigo-200/50" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-indigo-400/30 pt-3 text-center">
                <div>
                  <p className="text-xs text-indigo-200">NV hoàn thành</p>
                  <p className="text-lg font-bold">{myCompletedCount}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-200">Điểm TB</p>
                  <p className="text-lg font-bold">{myAvgScore.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-200">Xếp loại</p>
                  <p className="text-lg font-bold">{RATING_LABELS[getRating(myAvgScore)]}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-800">Điểm KPI của tôi</h3>
              </div>
              {myTaskKpi.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  <TrendingUp className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  Bạn chưa có nhiệm vụ trong kỳ này
                </div>
              ) : (
                myTaskKpi.map(renderKpiRow)
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                    <div className={`mx-auto mb-1 w-fit rounded-lg ${card.bg} p-1.5 ${card.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-base font-extrabold text-slate-800">{card.value}</p>
                    <p className="text-[9px] font-medium text-slate-400">{card.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-800">KPI theo người dùng</h3>
              </div>
              {userKpi.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">Chưa có dữ liệu KPI</div>
              ) : (
                userKpi.map(({ user: u, taskCount, avgScore }, idx) => {
                  const rating = getRating(avgScore);
                  return (
                    <div key={u.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                      <span className="w-6 shrink-0 text-center text-sm font-bold text-slate-400">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">{u.name || u.email}</p>
                        <p className="text-[11px] text-slate-400">
                          {taskCount} nhiệm vụ hoàn thành
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-emerald-600">{avgScore.toFixed(1)}</p>
                        <span className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${getRatingBadgeStyle(rating)}`}>
                          {rating >= 4 && <Zap className="h-3 w-3" />}
                          {RATING_LABELS[rating]}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-2 px-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <h3 className="text-sm font-bold text-slate-800">Bảng Xếp hạng Thi đua</h3>
            </div>
            <div className="overflow-x-auto">
              <Leaderboard />
            </div>
          </>
        )}
      </div>
    </div>
  );
}