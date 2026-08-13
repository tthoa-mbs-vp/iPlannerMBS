import { useMemo, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useTasks } from "../../hooks/useTasks";
import { useKpiScores } from "../../hooks/useKpiScores";
import {
  useAttendanceLogs,
  useAttendanceConfigs,
  useCheckIn,
  useCheckOut,
} from "../../hooks/useAttendance";
import { isTaskOverdue } from "../../utils/format";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "../../utils/constants";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import {
  Sun,
  CalendarDays,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Wifi,
  Award,
  Star,
  User as UserIcon,
  Briefcase,
} from "lucide-react";
import type { Task } from "@shared/types";

function diffDays(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function MDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const role = user?.expand?.role_id;
  const dept = user?.expand?.department_id;

  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: kpiScores } = useKpiScores();
  const { data: logs = [] } = useAttendanceLogs(userId);
  const { data: configs = [] } = useAttendanceConfigs();

  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const myTasks = useMemo(() => {
    if (!tasks || !user) return [];
    return tasks.filter(
      (t) =>
        t.executor_id === user.id ||
        t.supervisor_id === user.id ||
        (t.collaborator_ids || []).includes(user.id)
    );
  }, [tasks, user]);

  const active = useMemo(
    () => myTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled"),
    [myTasks]
  );

  const overdue = useMemo(
    () =>
      active
        .filter((t) => isTaskOverdue(t))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [active]
  );

  const dueToday = useMemo(
    () =>
      active
        .filter((t) => diffDays(t.deadline) === 0 && !isTaskOverdue(t))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [active]
  );

  const todayTasks = [...overdue, ...dueToday];

  const upcoming = useMemo(
    () =>
      active
        .filter((t) => !isTaskOverdue(t) && diffDays(t.deadline) !== 0)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 5),
    [active]
  );

  const counts = useMemo(
    () => ({
      not_started: myTasks.filter((t) => t.status === "not_started").length,
      today: dueToday.length,
      in_progress: myTasks.filter((t) => t.status === "in_progress").length,
      pending_approval: myTasks.filter((t) => t.status === "pending_approval").length,
      overdue: overdue.length,
      completed: myTasks.filter((t) => t.status === "completed").length,
    }),
    [myTasks, dueToday, overdue]
  );

  const myKpiScores = useMemo(() => {
    if (!kpiScores || !user) return [];
    const taskIds = new Set(myTasks.map((t) => t.id));
    return kpiScores.filter((k) => taskIds.has(k.task_id));
  }, [kpiScores, myTasks, user]);

  const myAvgScore = myKpiScores.length
    ? myKpiScores.reduce((s, k) => s + k.final_score, 0) / myKpiScores.length
    : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.check_in?.startsWith(todayStr));
  const activeConfig = configs.find((c) => c.is_active) || configs[0];

  const handleCheckIn = () => {
    if (!user) return;
    checkInMutation.mutate({
      user_id: user.id,
      ssid: activeConfig?.wifi_ssid || "",
      bssid: activeConfig?.wifi_bssid,
      config: activeConfig,
      notes: activeConfig ? `Tại ${activeConfig.office_name}` : "Check-in nhanh",
    });
  };

  const handleCheckOut = () => {
    if (todayLog?.id) checkOutMutation.mutate(todayLog.id);
  };

  const dateLabel = format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi });
  const todayTime = todayLog
    ? new Date(todayLog.check_in).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const checkedOut = !!todayLog?.check_out;

  const statCards = [
    { label: "Chưa làm", value: counts.not_started, icon: ClipboardList, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Hôm nay", value: counts.today, icon: Sun, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Đang làm", value: counts.in_progress, icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100" },
    { label: "Chờ duyệt", value: counts.pending_approval, icon: CheckCircle2, color: "text-violet-600", bg: "bg-violet-100" },
    { label: "Trễ hạn", value: counts.overdue, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-100" },
    { label: "Hoàn thành", value: counts.completed, icon: Award, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  const renderTaskCard = (t: Task, showTodayLabel = false) => {
    const late = isTaskOverdue(t);
    const expanded = expandedId === t.id;
    return (
      <div
        key={t.id}
        className="rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <button
          onClick={() => setExpandedId(expanded ? null : t.id)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {late ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
            ) : (
              <CalendarDays className="h-4 w-4 shrink-0 text-amber-500" />
            )}
            <span className="truncate text-sm font-medium text-slate-700">{t.name}</span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              late
                ? "bg-rose-100 text-rose-700"
                : TASK_STATUS_STYLES[t.status] || ""
            }`}
          >
            {late ? "Trễ hạn" : TASK_STATUS_LABELS[t.status] || t.status}
          </span>
        </button>
        {expanded && (
          <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <p className="whitespace-pre-wrap text-slate-700">{t.description || "Không có mô tả."}</p>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
              <span>Hạn: {new Date(t.deadline).toLocaleDateString("vi-VN")}</span>
              {showTodayLabel && (
                <span className={`font-bold ${late ? "text-rose-600" : "text-amber-600"}`}>
                  ({late ? "Quá hạn" : "Hôm nay"})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-slate-400" />
              <span>Thực hiện: {t.expand?.executor_id?.name || "—"}</span>
            </div>
            {t.expand?.supervisor_id && (
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>Giám sát: {t.expand.supervisor_id.name}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4">
      {/* Greeting */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 p-4 text-white shadow-lg">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-blue-200">
          <Sun className="h-3.5 w-3.5" />
          {dateLabel}
        </p>
        <h1 className="mt-1 text-xl font-bold">Xin chào, {user?.name || user?.email}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {role?.name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
              <Briefcase className="h-3 w-3" />
              {role.name}
            </span>
          )}
          {dept?.name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
              <CalendarDays className="h-3 w-3" />
              {dept.name}
            </span>
          )}
        </div>
      </div>

      {/* Quick attendance */}
      <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Chấm công hôm nay</p>
            <p className="text-xs text-slate-500">
              {!todayLog
                ? "Chưa chấm công"
                : checkedOut
                  ? `Vào ${todayTime} · Đã ra ca`
                  : `Vào ${todayTime} · Chưa ra ca`}
            </p>
          </div>
        </div>
        {!todayLog ? (
          <button
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
          >
            {checkInMutation.isPending ? "..." : "Check-in"}
          </button>
        ) : !checkedOut ? (
          <button
            onClick={handleCheckOut}
            disabled={checkOutMutation.isPending}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
          >
            {checkOutMutation.isPending ? "..." : "Ra ca"}
          </button>
        ) : (
          <span className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
            Hoàn tất
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
            >
              <div className={`rounded-lg ${card.bg} p-1.5 ${card.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`text-lg font-extrabold ${card.color}`}>{card.value}</span>
              <span className="text-[10px] font-medium text-slate-400">{card.label}</span>
            </div>
          );
        })}
      </div>

      {tasksLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Đang tải...</div>
      ) : (
        <>
          {/* Tasks today */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Sun className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-800">Nhiệm vụ hôm nay</h2>
            </div>
            {todayTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                Hôm nay bạn không có nhiệm vụ
              </div>
            ) : (
              todayTasks.map((t) => renderTaskCard(t, true))
            )}
          </section>

          {/* Upcoming */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-800">Sắp đến hạn</h2>
            </div>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                Không có nhiệm vụ nào
              </div>
            ) : (
              upcoming.map((t) => {
                const late = isTaskOverdue(t);
                const d = diffDays(t.deadline);
                return (
                  <div key={`u-${t.id}`}>
                    {renderTaskCard(t)}
                    <div className="mt-0.5 px-1 text-[11px] text-slate-400">
                      {late ? "Quá hạn" : d === 0 ? "Hôm nay" : `Còn ${d} ngày`}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      {/* My KPI */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-1.5 text-white">
            <Award className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">KPI của tôi</h2>
        </div>
        {myKpiScores.length > 0 ? (
          <div className="flex items-center gap-2">
            <p className="text-3xl font-extrabold text-emerald-600">
              {myAvgScore.toFixed(1)}
            </p>
            <p className="text-xs text-slate-400">/ 100</p>
            <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              {myKpiScores.length} nhiệm vụ đã chấm
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Chưa có dữ liệu KPI. Hoàn thành nhiệm vụ để được chấm điểm.
          </p>
        )}
      </section>
    </div>
  );
}