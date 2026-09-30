import { useState, useRef, useMemo } from "react";
import { useUpdateTask } from "../../hooks/useTasks";
import { useNavigate } from "react-router-dom";
import type { Task, TaskStatus } from "@shared/types";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES, TASK_STATUS_COLORS } from "../../utils/constants";

const COLUMNS: TaskStatus[] = ["not_started", "in_progress", "pending_approval", "completed", "proposed_extension", "proposed_cancellation", "cancelled"];

interface Props {
  tasks: Task[];
}

export default function KanbanBoard({ tasks }: Props) {
  const updateTask = useUpdateTask();
  const navigate = useNavigate();
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragTask = useRef<Task | null>(null);

  const columnTasks = useMemo(() => {
    const acc = {} as Record<TaskStatus, Task[]>;
    for (const status of COLUMNS) acc[status] = [];
    for (const t of tasks) acc[t.status].push(t);
    return acc;
  }, [tasks]);

  const handleDragStart = (task: Task) => {
    dragTask.current = task;
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (status: string) => {
    setDragOverCol(null);
    const task = dragTask.current;
    dragTask.current = null;
    if (!task || task.status === status) return;
    try {
      await updateTask.mutateAsync({ id: task.id, data: { status: status as TaskStatus } });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-2">
      {COLUMNS.filter((s) => columnTasks[s].length > 0 || ["not_started", "in_progress", "pending_approval", "completed"].includes(s)).map((status) => (
        <div key={status} className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
          <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2.5 border-b border-slate-200 bg-gradient-to-r ${TASK_STATUS_COLORS[status]} dark:border-slate-700`}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">{columnTasks[status].length}</span>
            <span className="text-xs font-bold text-white">{TASK_STATUS_LABELS[status]}</span>
          </div>
          <div
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(status)}
            className={`flex-1 space-y-1.5 overflow-y-auto p-2 transition-colors ${dragOverCol === status ? "bg-indigo-50/50 dark:bg-indigo-900/30" : ""}`}
          >
            {columnTasks[status].length === 0 && (
              <p className="py-6 text-center text-[10px] text-slate-300 dark:text-slate-600">Kéo thả nhiệm vụ vào đây</p>
            )}
            {columnTasks[status].map((task) => (
              <div key={task.id} draggable
                onDragStart={() => handleDragStart(task)}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white p-3 shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-xs font-semibold text-slate-800 line-clamp-2 dark:text-slate-100">{task.name}</p>
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                  <span>{task.expand?.executor_id?.name || "—"}</span>
                </div>
                <div className="mt-1 text-[9px] text-slate-300 dark:text-slate-600">
                  {new Date(task.deadline).toLocaleDateString("vi-VN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
