import { memo } from "react";
import type { Task } from "@shared/types";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "../../utils/constants";
import { isTaskOverdue } from "../../utils/format";

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}

const TaskRow = memo(function TaskRow({ task, isSelected, onToggle, onOpen }: TaskRowProps) {
  const isOverdue = isTaskOverdue(task);
  return (
    <tr
      onClick={(e) => { if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return; onOpen(task.id); }}
      className="even:bg-slate-100 hover:bg-purple-50/30 transition-colors cursor-pointer dark:even:bg-slate-800/60 dark:hover:bg-purple-950/20"
    >
      <td className="px-2 py-3 w-10 align-middle">
        <input type="checkbox" checked={isSelected} onClick={() => onToggle(task.id)}
          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-800" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100" title={task.name}>{task.name}</p>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{task.expand?.plan_id?.name || task.expand?.host_dept_id?.name || "—"}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {task.expand?.executor_id?.name || task.expand?.executor_id?.email || "—"}
        </div>
        {task.expand?.collaborator_ids && task.expand.collaborator_ids.length > 0 && (
          <div className="text-[11px] text-slate-400 mt-0.5 dark:text-slate-500">
            {task.expand.collaborator_ids.map((u: any) => u.name).join(", ")}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap dark:text-slate-300">
        {task.expand?.supervisor_id?.name || task.expand?.supervisor_id?.email || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
          <span>{new Date(task.start_date).toLocaleDateString("vi-VN")}</span>
          <span className="text-slate-300 dark:text-slate-600">→</span>
        </div>
        <div className={`text-sm font-bold ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}`}>
          {new Date(task.deadline).toLocaleDateString("vi-VN")}
          {isOverdue && " ⚠"}
        </div>
      </td>
    </tr>
  );
});

export default TaskRow;
