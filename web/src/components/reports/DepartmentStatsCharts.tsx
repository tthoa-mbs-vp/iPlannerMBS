import { useDepartments } from "../../hooks/useDepartments";
import { usePlans } from "../../hooks/usePlans";
import { useTasks } from "../../hooks/useTasks";
import { ClipboardList, CheckSquare, Building2, Loader2 } from "lucide-react";

const planStatuses: { key: string; label: string; color: string }[] = [
  { key: "not_started", label: "Chưa làm", color: "bg-slate-400" },
  { key: "in_progress", label: "Đang làm", color: "bg-blue-500" },
  { key: "completed", label: "Hoàn thành", color: "bg-emerald-500" },
  { key: "paused", label: "Tạm dừng", color: "bg-amber-400" },
  { key: "cancelled", label: "Đã hủy", color: "bg-rose-400" },
];

const taskStatuses: { key: string; label: string; color: string }[] = [
  { key: "in_progress", label: "Đang làm", color: "bg-blue-500" },
  { key: "pending_approval", label: "Chờ duyệt", color: "bg-amber-400" },
  { key: "completed", label: "Hoàn thành", color: "bg-emerald-500" },
  { key: "proposed_extension", label: "Gia hạn", color: "bg-purple-500" },
  { key: "proposed_cancellation", label: "Đề xuất hủy", color: "bg-rose-500" },
  { key: "cancelled", label: "Đã hủy", color: "bg-slate-400" },
];

const deptColors = [
  "from-indigo-500 to-blue-600",
  "from-purple-500 to-pink-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-500",
  "from-rose-500 to-red-500",
];

export default function DepartmentStatsCharts() {
  const { data: departments } = useDepartments();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: tasks, isLoading: tasksLoading } = useTasks();

  if (plansLoading || tasksLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!departments || !plans || !tasks) return null;

  return (
    <div className="space-y-6">
      {departments.filter((d) => d.is_counted).map((dept, idx) => {
        const deptPlans = plans.filter((p) => p.host_dept_id === dept.id);
        const deptTasks = tasks.filter((t) => t.host_dept_id === dept.id);
        if (deptPlans.length === 0 && deptTasks.length === 0) return null;

        const totalPlans = deptPlans.length || 1;
        const totalTasks = deptTasks.length || 1;
        const grad = deptColors[idx % deptColors.length];

        return (
          <div
            key={dept.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-700">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr ${grad} text-white shadow-md`}
              >
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">{dept.name}</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {dept.code}
                  {dept.expand?.leader_id
                    ? ` · LĐ: ${dept.expand.leader_id.name || dept.expand.leader_id.email}`
                    : ""}
                </p>
              </div>
            </div>

            {/* Plans stacked bar */}
            <div className="mb-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <ClipboardList className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                Kế hoạch ({deptPlans.length})
              </div>
              <div className="flex h-5 overflow-hidden rounded-lg bg-slate-100 shadow-inner dark:bg-slate-800">
                {planStatuses.map((s) => {
                  const count = deptPlans.filter((p) => p.status === s.key).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={s.key}
                      className={`${s.color} flex items-center justify-center text-[10px] font-bold text-white transition-all duration-300 first:rounded-l-lg last:rounded-r-lg`}
                      style={{ width: `${(count / totalPlans) * 100}%` }}
                      title={`${s.label}: ${count}`}
                    >
                      {count > 2 && count}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex flex-wrap gap-3">
                {planStatuses.map((s) => {
                  const count = deptPlans.filter((p) => p.status === s.key).length;
                  if (count === 0) return null;
                  return (
                    <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                      <span className={`inline-block h-2.5 w-2.5 rounded ${s.color}`} />
                      {s.label}: {count}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tasks stacked bar */}
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <CheckSquare className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                Nhiệm vụ ({deptTasks.length})
              </div>
              <div className="flex h-5 overflow-hidden rounded-lg bg-slate-100 shadow-inner dark:bg-slate-800">
                {taskStatuses.map((s) => {
                  const count = deptTasks.filter((t) => t.status === s.key).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={s.key}
                      className={`${s.color} flex items-center justify-center text-[10px] font-bold text-white transition-all duration-300 first:rounded-l-lg last:rounded-r-lg`}
                      style={{ width: `${(count / totalTasks) * 100}%` }}
                      title={`${s.label}: ${count}`}
                    >
                      {count > 2 && count}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex flex-wrap gap-3">
                {taskStatuses.map((s) => {
                  const count = deptTasks.filter((t) => t.status === s.key).length;
                  if (count === 0) return null;
                  return (
                    <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                      <span className={`inline-block h-2.5 w-2.5 rounded ${s.color}`} />
                      {s.label}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
