import { useEffect, useMemo, useState } from "react";
import { useNow } from "../hooks/useNow";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useTasks } from "../hooks/useTasks";
import { useKpiScores } from "../hooks/useKpiScores";
import { useUsers } from "../hooks/useDepartments";
import { useAttendanceLogs, useAttendanceConfigs, useCheckIn, useCheckOut } from "../hooks/useAttendance";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES, ATTENDANCE_STATUS_STYLES } from "../utils/constants";
import { isTaskOverdue } from "../utils/format";
import type { Task } from "@shared/types";
import {
  Sun,
  CalendarDays,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Wifi,
  ArrowRight,
  Sparkles,
  Briefcase,
  ClipboardList,
  Award,
  Star,
  TrendingUp,
  Filter,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import { SkeletonCard, SkeletonStatCards } from "../components/shared/Skeleton";
import CheckCombobox from "../components/shared/CheckCombobox";
import Pagination from "../components/shared/Pagination";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / (1000 * 60 * 60 * 24));
}

export default function MyDayPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks();
  const { data: kpiScores } = useKpiScores();
  const { data: users = [] } = useUsers();
  const { data: logs = [], isLoading: attendanceLoading } = useAttendanceLogs(userId);
  const { data: configs = [] } = useAttendanceConfigs();

  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const [checkingIn, setCheckingIn] = useState(false);

  const [showTaskFilters, setShowTaskFilters] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilters, setTaskStatusFilters] = useState<string[]>([]);
  const [taskPersonFilters, setTaskPersonFilters] = useState<string[]>([]);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(8);

  useEffect(() => {
    usePageTitleStore.getState().setTitle("Việc của tôi hôm nay");
  }, []);

  const myTasks = useMemo(() => {
    if (!tasks || !user) return [];
    return tasks.filter(
      (t) => t.executor_id === user.id || t.supervisor_id === user.id || (t.collaborator_ids || []).includes(user.id)
    );
  }, [tasks, user]);

  const active = useMemo(() => myTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled"), [myTasks]);

  const overdue = useMemo(() => active.filter((t) => isTaskOverdue(t)).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()), [active]);

  const dueToday = useMemo(
    () =>
      active
        .filter((t) => diffDays(t.deadline) === 0 && !isTaskOverdue(t))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [active]
  );

  const todayTasks = [...overdue, ...dueToday];

  const myTaskCounts = useMemo(
    () => ({
      not_started: myTasks.filter((t) => t.status === "not_started").length,
      in_progress: myTasks.filter((t) => t.status === "in_progress").length,
      pending_approval: myTasks.filter((t) => t.status === "pending_approval").length,
      completed: myTasks.filter((t) => t.status === "completed").length,
      overdue: myTasks.filter((t) => isTaskOverdue(t)).length,
    }),
    [myTasks]
  );

  const myKpiScores = useMemo(() => {
    if (!kpiScores || !user) return [];
    const taskIds = new Set(myTasks.map((t) => t.id));
    return kpiScores.filter((k) => taskIds.has(k.task_id));
  }, [kpiScores, myTasks, user]);

  const myUpcoming = useMemo(
    () =>
      myTasks
        .filter((t) => t.status !== "completed" && t.status !== "cancelled")
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [myTasks]
  );

  const filteredUpcoming = useMemo(() => {
    let list = myUpcoming;
    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (taskStatusFilters.length) list = list.filter((t) => taskStatusFilters.includes(t.status));
    if (taskPersonFilters.length) list = list.filter((t) => taskPersonFilters.includes(t.executor_id) || taskPersonFilters.includes(t.supervisor_id));
    return list;
  }, [myUpcoming, taskSearch, taskStatusFilters, taskPersonFilters]);

  const upcomingTotalPages = Math.max(1, Math.ceil(filteredUpcoming.length / taskPageSize));
  const paginatedUpcoming = useMemo(
    () => filteredUpcoming.slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize),
    [filteredUpcoming, taskPage, taskPageSize]
  );

  const upcomingPersonOptions = useMemo(() => {
    const ids = new Set<string>();
    myUpcoming.forEach((t) => {
      if (t.executor_id) ids.add(t.executor_id);
      if (t.supervisor_id) ids.add(t.supervisor_id);
    });
    taskPersonFilters.forEach((id) => ids.add(id));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return Array.from(ids)
      .map((id) => userMap.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "vi"));
  }, [myUpcoming, users, taskPersonFilters]);

  const now = useNow();
  const taskResetKey = `${filteredUpcoming.length}|${taskSearch}|${taskStatusFilters.join(",")}|${taskPersonFilters.join(",")}|${taskPageSize}`;
  const [prevTaskResetKey, setPrevTaskResetKey] = useState(taskResetKey);
  if (prevTaskResetKey !== taskResetKey) {
    setPrevTaskResetKey(taskResetKey);
    setTaskPage(1);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.check_in?.startsWith(todayStr));

  const activeConfig = configs.find((c) => c.is_active) || configs[0];

  const handleCheckIn = () => {
    if (!user || checkingIn) return;
    setCheckingIn(true);
    checkInMutation.mutate(
      {
        user_id: user.id,
        ssid: activeConfig?.wifi_ssid || "",
        bssid: activeConfig?.wifi_bssid,
        config: activeConfig,
        notes: activeConfig ? `Tại ${activeConfig.office_name}` : "Check-in nhanh",
      },
      {
        onSettled: () => setCheckingIn(false),
      }
    );
  };

  const handleCheckOut = () => {
    if (todayLog?.id) checkOutMutation.mutate(todayLog.id);
  };

  const isLoading = tasksLoading || attendanceLoading;

  const dateLabel = format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi });
  const roleLabel = user?.expand?.role_id?.name;
  const deptLabel = user?.expand?.department_id?.name;

  const statCards = [
    { label: "Chưa làm", value: myTaskCounts.not_started, icon: ClipboardList, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-700", link: "/tasks" },
    { label: "Hôm nay", value: dueToday.length, icon: Sun, color: "text-amber-600 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40", link: "/tasks" },
    { label: "Đang làm", value: myTaskCounts.in_progress, icon: Clock, color: "text-indigo-600 dark:text-indigo-300", bg: "bg-indigo-100 dark:bg-indigo-900/40", link: "/tasks" },
    { label: "Chờ duyệt", value: myTaskCounts.pending_approval, icon: CheckCircle2, color: "text-violet-600 dark:text-violet-300", bg: "bg-violet-100 dark:bg-violet-900/40", link: "/tasks" },
    { label: "Trễ hạn", value: myTaskCounts.overdue, icon: AlertTriangle, color: "text-rose-600 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-900/40", link: "/tasks" },
    { label: "Hoàn thành", value: myTaskCounts.completed, icon: Award, color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40", link: "/tasks" },
  ];

  const todayTime = todayLog
    ? `${new Date(todayLog.check_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
    : null;
  const checkedOut = !!todayLog?.check_out;
  const lateToday = todayLog?.status === "late";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 p-6 text-white shadow-lg shadow-indigo-500/20">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-16 bottom-0 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-blue-200 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              {dateLabel}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Xin chào, {user?.name || user?.email}
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              {roleLabel && <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium"><Briefcase className="h-3 w-3" />{roleLabel}</span>}
              {deptLabel && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium"><CalendarDays className="h-3 w-3" />{deptLabel}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!todayLog ? (
              <button
                onClick={handleCheckIn}
                disabled={checkInMutation.isPending || checkingIn}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-md transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                <Wifi className="h-4 w-4" />
                {checkInMutation.isPending || checkingIn ? "Đang chấm công..." : "Chấm công vào ca"}
              </button>
            ) : !checkedOut ? (
              <button
                onClick={handleCheckOut}
                disabled={checkOutMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-amber-950 shadow-md transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                <Clock className="h-4 w-4" />
                {checkOutMutation.isPending ? "Đang ra ca..." : "Ra ca"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/20 px-4 py-2.5 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/40">
                <CheckCircle2 className="h-4 w-4" />
                Đã hoàn thành công hôm nay
              </span>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <>
          <SkeletonStatCards count={6} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SkeletonCard title lines={5} className="lg:col-span-2" />
            <SkeletonCard title lines={4} />
          </div>
        </>
      ) : tasksError ? (
        <ErrorState message="Không thể tải dữ liệu" subMessage="Vui lòng thử lại sau" onRetry={() => refetchTasks()} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  to={card.link}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br from-indigo-100/40 via-purple-100/30 to-transparent opacity-60 transition-all duration-500 group-hover:scale-150" />
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{card.label}</p>
                      <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
                    </div>
                    <div className={`shrink-0 rounded-lg ${card.bg} ${card.color} p-2 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2 shadow-lg shadow-amber-500/20">
                      <Sun className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Nhiệm vụ hôm nay</h3>
                  </div>
                  <Link to="/tasks" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    Xem tất cả <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {todayTasks.length > 0 ? (
                  <div className="space-y-2">
                    {todayTasks.map((t: Task) => {
                      const late = isTaskOverdue(t);
                      return (
                        <Link
                          key={t.id}
                          to={`/tasks/${t.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-sm transition-all hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-700 dark:hover:bg-slate-700/50"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {late ? (
                              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                            ) : (
                              <CalendarDays className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                            )}
                            <span className="truncate font-medium text-slate-700 dark:text-slate-200">{t.name}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TASK_STATUS_STYLES[t.status] || ""}`}>
                              {TASK_STATUS_LABELS[t.status] || t.status}
                            </span>
                            <span className={`text-xs font-bold ${late ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                              {late ? "Quá hạn" : "Hôm nay"}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Sun}
                    message="Hôm nay bạn không có nhiệm vụ"
                    subMessage="Tận hưởng một ngày làm việc nhẹ nhàng nhé"
                    size="sm"
                    className="py-8"
                  />
                )}
              </div>

              {/* Sắp đến hạn (from Dashboard "Việc của tôi") */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2 shadow-lg shadow-blue-500/20">
                      <ListChecks className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sắp đến hạn</h3>
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowTaskFilters(!showTaskFilters)} title="Bộ lọc nhiệm vụ"
                      className={`relative rounded-lg border p-1.5 transition-colors ${(taskSearch || taskStatusFilters.length > 0 || taskPersonFilters.length > 0) ? "border-indigo-300 bg-indigo-100 text-indigo-600 dark:border-indigo-500/50 dark:bg-indigo-900/30 dark:text-indigo-300" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"}`}>
                      <Filter className="h-4 w-4" />
                      {(taskSearch || taskStatusFilters.length > 0 || taskPersonFilters.length > 0) && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500 dark:border-slate-800" />
                      )}
                    </button>
                    {showTaskFilters && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTaskFilters(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} aria-label="Tìm nhiệm vụ"
                              placeholder="Tìm nhiệm vụ..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
                          </div>
                          <div className="mt-2 space-y-2">
                            <CheckCombobox
                              items={Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({ id: key, label }))}
                              selected={taskStatusFilters}
                              onToggle={(id) => setTaskStatusFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                              label="Trạng thái"
                              placeholder="Tất cả trạng thái"
                              accentColor="indigo"
                              size="sm"
                            />
                            <CheckCombobox
                              items={upcomingPersonOptions.map((u) => ({ id: u.id, label: u.name || u.email }))}
                              selected={taskPersonFilters}
                              onToggle={(id) => setTaskPersonFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                              label="Nhân sự"
                              placeholder="Tất cả nhân sự"
                              accentColor="indigo"
                              size="sm"
                            />
                          </div>
                          {(taskSearch || taskStatusFilters.length > 0 || taskPersonFilters.length > 0) && (
                            <button onClick={() => { setTaskSearch(""); setTaskStatusFilters([]); setTaskPersonFilters([]); }}
                              className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors dark:border-indigo-500/40 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50">
                              Xóa lọc
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {filteredUpcoming.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedUpcoming.map((t: Task) => {
                      const isLate = isTaskOverdue(t);
                      const diff = Math.ceil((new Date(t.deadline).getTime() - now) / (1000 * 60 * 60 * 24));
                      return (
                        <Link
                          key={t.id}
                          to={`/tasks/${t.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-sm transition-all hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-700 dark:hover:bg-slate-700/50"
                        >
                          <span className="truncate font-medium text-slate-700 dark:text-slate-200">{t.name}</span>
                          <span className={`shrink-0 text-xs font-bold ${isLate ? "text-rose-600 dark:text-rose-400" : diff <= 1 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}>
                            {isLate ? "Quá hạn" : diff === 0 ? "Hôm nay" : `${diff} ngày`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={ListChecks} message="Không có nhiệm vụ nào" size="sm" className="py-8" />
                )}
                <Pagination
                  page={taskPage}
                  totalPages={upcomingTotalPages}
                  onChange={setTaskPage}
                  pageSize={taskPageSize}
                  onPageSizeChange={setTaskPageSize}
                  totalCount={filteredUpcoming.length}
                />
                <Link to={`/tasks?executor_id=${user?.id}`}
                  className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all dark:border-slate-600 dark:text-slate-500 dark:hover:text-indigo-300 dark:hover:border-indigo-500/50">
                  Xem tất cả nhiệm vụ của tôi <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col space-y-4">
              {/* Attendance */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 p-2 shadow-lg shadow-emerald-500/20">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Chấm công hôm nay</h3>
                </div>
                {todayLog ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-700/40">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Giờ vào ca</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{todayTime}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-700/40">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Giờ ra ca</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {checkedOut
                          ? new Date(todayLog.check_out!).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                          : "Chưa ra ca"}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ATTENDANCE_STATUS_STYLES[lateToday ? "late" : "on_time"]}`}>
                      {lateToday ? (<><AlertTriangle className="h-3 w-3" /> Đi muộn</>) : (<><CheckCircle2 className="h-3 w-3" /> Đúng giờ</>)}
                    </span>
                  </div>
                ) : (
                  <EmptyState
                    icon={Clock}
                    message="Chưa chấm công hôm nay"
                    subMessage="Đừng quên chấm công khi đến văn phòng"
                    size="sm"
                    className="py-6"
                  />
                )}
              </div>

              {/* KPI của tôi (from Dashboard "Việc của tôi") */}
              <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2 shadow-lg shadow-amber-500/20">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">KPI của tôi</h3>
                </div>
                {myKpiScores.length > 0 ? (
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {(myKpiScores.reduce((s, k) => s + k.final_score, 0) / myKpiScores.length).toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">/ 100</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      {myKpiScores.length} nhiệm vụ đã chấm
                    </div>
                    <Link to="/kpi"
                      className="mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all dark:border-slate-600 dark:text-slate-500 dark:hover:text-indigo-300 dark:hover:border-indigo-500/50">
                      Xem chi tiết KPI <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <EmptyState icon={TrendingUp} message="Chưa có dữ liệu KPI" subMessage="Hoàn thành nhiệm vụ để được chấm điểm" className="flex-1 py-6" size="sm" />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
