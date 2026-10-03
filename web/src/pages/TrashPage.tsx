import { useEffect, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { Navigate } from "react-router-dom";
import { Trash2, RotateCcw, AlertTriangle, ClipboardList, CheckSquare } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useTrashedPlans, useRestorePlan, usePermanentDeletePlan, useBulkPermanentDeletePlans } from "../hooks/usePlans";
import { useTrashedTasks, useRestoreTask, usePermanentDeleteTask, useBulkPermanentDeleteTasks } from "../hooks/useTasks";
import TabBar from "../components/shared/TabBar";
import Spinner from "../components/shared/Spinner";
import EmptyState from "../components/shared/EmptyState";
import type { Plan, Task } from "@shared/types";

/** Trash holds plans or tasks, depending on the active tab. */
type TrashItem = Plan | Task;

export default function TrashPage() {
  const [tab, setTab] = usePersistedState<"plans" | "tasks">("trash_tab", "plans");
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const isAdmin = role?.can_manage;

  useEffect(() => { usePageTitleStore.getState().setTitle("Thùng rác"); }, []);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <TabBar
        tabs={[
          { key: "plans", label: "Kế hoạch", icon: ClipboardList, gradient: "from-blue-500 to-indigo-600" },
          { key: "tasks", label: "Nhiệm vụ", icon: CheckSquare, gradient: "from-emerald-500 to-teal-600" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as "plans" | "tasks")}
        size="md"
      />
      <TrashList type={tab} />
    </div>
  );
}

function TrashList({ type }: { type: "plans" | "tasks" }) {
  const { data: plans, isLoading: plansLoading } = useTrashedPlans();
  const { data: tasks, isLoading: tasksLoading } = useTrashedTasks();
  const restorePlan = useRestorePlan();
  const restoreTask = useRestoreTask();
  const permDeletePlan = usePermanentDeletePlan();
  const permDeleteTask = usePermanentDeleteTask();
  const bulkDeletePlans = useBulkPermanentDeletePlans();
  const bulkDeleteTasks = useBulkPermanentDeleteTasks();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const isLoading = type === "plans" ? plansLoading : tasksLoading;
  const items = type === "plans" ? plans : tasks;
  const restore = type === "plans"
    ? (id: string) => restorePlan.mutateAsync(id)
    : (id: string) => restoreTask.mutateAsync(id);
  const permDelete = type === "plans"
    ? (id: string) => permDeletePlan.mutateAsync(id)
    : (id: string) => permDeleteTask.mutateAsync(id);
  const bulkDelete = type === "plans"
    ? (ids: string[]) => bulkDeletePlans.mutateAsync(ids)
    : (ids: string[]) => bulkDeleteTasks.mutateAsync(ids);
  const isRestoring = type === "plans" ? restorePlan.isPending : restoreTask.isPending;
  const isDeleting = type === "plans" ? permDeletePlan.isPending : permDeleteTask.isPending;
  const isBulkDeleting = type === "plans" ? bulkDeletePlans.isPending : bulkDeleteTasks.isPending;

  if (isLoading) return <Spinner color="border-red-500" />;

  if (!items || items.length === 0) return <EmptyState icon={Trash2} message="Thùng rác trống" size="lg" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        {confirmBulk ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 font-medium dark:text-red-400">Xóa vĩnh viễn tất cả ({items.length})?</span>
            <button onClick={async () => { await bulkDelete(items.map((i: TrashItem) => i.id)); setConfirmBulk(false); }} disabled={isBulkDeleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
              {isBulkDeleting ? "..." : "Xác nhận"}
            </button>
            <button onClick={() => setConfirmBulk(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              Hủy
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmBulk(true)}
            className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">
            <Trash2 className="h-3.5 w-3.5" />
            Xóa tất cả ({items.length})
          </button>
        )}
      </div>
      {items.map((item: TrashItem) => (
        <div key={item.id}
          className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/50">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate dark:text-slate-100" title={item.name || item.id}>{item.name || item.id}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {type === "plans" ? "Kế hoạch" : "Nhiệm vụ"} · Đã xóa {new Date(item.updated).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <div className="flex gap-2">
            {confirmId === item.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium dark:text-red-400">Xóa vĩnh viễn?</span>
                <button onClick={async () => { await permDelete(item.id); setConfirmId(null); }} disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {isDeleting ? "..." : "Xác nhận"}
                </button>
                <button onClick={() => setConfirmId(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                  Hủy
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => restore(item.id)} disabled={isRestoring}
                  className="flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Khôi phục
                </button>
                <button onClick={() => setConfirmId(item.id)}
                  className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Xóa hẳn
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
