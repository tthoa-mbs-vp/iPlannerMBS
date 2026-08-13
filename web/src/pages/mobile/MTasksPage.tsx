import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useTasks } from "../../hooks/useTasks";
import { isTaskOverdue } from "../../utils/format";
import {
  ClipboardList,
  Search,
} from "lucide-react";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "../../utils/constants";
import type { TaskStatus } from "@shared/types";

const filters = [
  { key: "all", label: "Tất cả" },
  { key: "in_progress", label: "Đang làm" },
  { key: "not_started", label: "Chưa làm" },
  { key: "overdue", label: "Trễ hạn" },
  { key: "completed", label: "Hoàn thành" },
];

export default function MTasksPage() {
  const user = useAuthStore((s) => s.user);
  const { data: tasks, isLoading } = useTasks();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const myTasks = useMemo(() => {
    if (!tasks || !user) return [];
    return tasks.filter(
      (t) => t.executor_id === user.id || (t.collaborator_ids || []).includes(user.id)
    );
  }, [tasks, user]);

  const filtered = useMemo(() => {
    let result = myTasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (filter === "overdue") {
      result = result.filter((t) => isTaskOverdue(t));
    } else if (filter !== "all") {
      result = result.filter((t) => t.status === filter);
    }
    return result.sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
  }, [myTasks, search, filter]);

  const getStatusLabel = (status: TaskStatus) => TASK_STATUS_LABELS[status] || status;
  const getStatusStyle = (status: TaskStatus) => TASK_STATUS_STYLES[status] || "";

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Tìm kiếm nhiệm vụ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-800"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 p-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            Không có nhiệm vụ nào
          </div>
        ) : (
          filtered.map((t) => {
            const late = isTaskOverdue(t);
            return (
              <Link
                key={t.id}
                to="/m/tasks"
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t.name}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      late
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                        : getStatusStyle(t.status as TaskStatus)
                    }`}
                  >
                    {late ? "Trễ hạn" : getStatusLabel(t.status as TaskStatus)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>Hạn: {new Date(t.deadline).toLocaleDateString("vi-VN")}</span>
                  {t.expand?.plan_id && <span>KH: {t.expand.plan_id.name}</span>}
                </div>
                {t.expand?.executor_id && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
                      {t.expand.executor_id.name?.charAt(0) || "?"}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t.expand.executor_id.name}</span>
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
