import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useUpdateTask } from "../../hooks/useTasks";
import { usePersistedState } from "../../hooks/usePersistedState";
import type { Plan, Task } from "@shared/types";

const GANTT_COLORS: Record<string, string> = {
  completed: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  in_progress: "bg-gradient-to-r from-blue-400 to-blue-500",
  pending_approval: "bg-gradient-to-r from-amber-400 to-amber-500",
  proposed_extension: "bg-gradient-to-r from-purple-400 to-purple-500",
  proposed_cancellation: "bg-gradient-to-r from-rose-400 to-rose-500",
  cancelled: "bg-slate-300",
};

type ScaleKey = "auto" | "day" | "5day" | "week" | "month";
type ConcreteScale = Exclude<ScaleKey, "auto">;

const SCALE_OPTIONS: { key: ScaleKey; label: string }[] = [
  { key: "auto", label: "Tự động" },
  { key: "day", label: "Ngày" },
  { key: "5day", label: "5 ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
];

const DAY_MS = 1000 * 60 * 60 * 24;

function buildBuckets(start: Date, end: Date, totalDays: number, scale: ConcreteScale): { label: string; startDay: number; endDay: number }[] {
  const buckets: { label: string; startDay: number; endDay: number }[] = [];
  const fmt = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  if (scale === "day" || scale === "5day") {
    const step = scale === "day" ? 1 : 5;
    for (let i = 0; i <= totalDays; i += step) {
      const from = i;
      const to = Math.min(i + step - 1, totalDays);
      const fromD = new Date(start); fromD.setDate(fromD.getDate() + from);
      const toD = new Date(start); toD.setDate(toD.getDate() + to);
      buckets.push({ label: scale === "day" ? fmt(fromD) : `${fmt(fromD)}–${fmt(toD)}`, startDay: from, endDay: to });
    }
  } else if (scale === "week") {
    const monday = new Date(start);
    monday.setDate(monday.getDate() + (monday.getDay() === 0 ? -6 : 1 - monday.getDay()));
    const cursor = new Date(monday);
    while (cursor.getTime() <= end.getTime()) {
      const fromD = new Date(cursor);
      const toD = new Date(cursor); toD.setDate(toD.getDate() + 6);
      buckets.push({
        label: `${fmt(fromD)}–${fmt(toD)}`,
        startDay: Math.max(0, Math.round((fromD.getTime() - start.getTime()) / DAY_MS)),
        endDay: Math.min(totalDays, Math.round((toD.getTime() - start.getTime()) / DAY_MS)),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    let y = start.getFullYear();
    let m = start.getMonth();
    for (;;) {
      const fromD = new Date(y, m, 1);
      if (fromD.getTime() > end.getTime()) break;
      const toD = new Date(y, m + 1, 0);
      buckets.push({
        label: fromD.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" }),
        startDay: Math.max(0, Math.round((fromD.getTime() - start.getTime()) / DAY_MS)),
        endDay: Math.min(totalDays, Math.round((toD.getTime() - start.getTime()) / DAY_MS)),
      });
      m++;
      if (m > 11) { m = 0; y++; }
    }
  }
  return buckets;
}

export default function InteractiveGanttChart({ plan, tasks, canEdit = true }: { plan: Plan; tasks: Task[]; canEdit?: boolean }) {
  const updateTask = useUpdateTask();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const [scale, setScale] = usePersistedState<ScaleKey>("gantt_scale", "auto");
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragging, setDragging] = useState<{ taskId: string; startX: number; originalWidth: number; originalLeft: number; originalDeadline: string; minDeadline: Date } | null>(null);

  const { start, end, hasValidDates, totalDays } = useMemo(() => {
    const start = new Date(plan.start_date);
    const end = new Date(plan.end_date);
    const hasValidDates = !isNaN(start.getTime()) && !isNaN(end.getTime());
    return {
      start,
      end,
      hasValidDates,
      totalDays: hasValidDates ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS)) : 0,
    };
  }, [plan.start_date, plan.end_date]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tasks.length]);

  const effectiveScale: ConcreteScale = useMemo(() => {
    if (scale !== "auto") return scale;
    if (!containerWidth) return "day";
    const availCols = Math.max(1, Math.floor((containerWidth - 112 - 24) / 32));
    const dayCount = totalDays + 1;
    const count5 = Math.ceil(dayCount / 5);
    const mondayOffset = start.getDay() === 0 ? -6 : 1 - start.getDay();
    const countWeek = Math.max(1, Math.ceil((totalDays - mondayOffset + 1) / 7));
    if (dayCount <= availCols) return "day";
    if (count5 <= availCols) return "5day";
    if (countWeek <= availCols) return "week";
    return "month";
  }, [scale, containerWidth, totalDays, start]);

  const buckets = useMemo(
    () => buildBuckets(start, end, totalDays, effectiveScale),
    [start, end, totalDays, effectiveScale],
  );

  const colForDay = useCallback((offset: number) => {
    let idx = 0;
    for (let i = 0; i < buckets.length; i++) {
      if (offset >= buckets[i].startDay) idx = i;
      else break;
    }
    return idx;
  }, [buckets]);

  const colWidthPct = buckets.length > 0 ? 100 / buckets.length : 100;

  const handleMouseDown = useCallback((e: React.MouseEvent, task: Task) => {
    if (!canEdit) return;
    e.preventDefault();
    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.deadline);
    if (isNaN(taskStart.getTime()) || isNaN(taskEnd.getTime())) return;
    const barDays = Math.max(1, (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
    const leftDays = Math.max(0, (taskStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    dragOffsetRef.current = 0;
    setDragging({
      taskId: task.id,
      startX: e.clientX,
      originalWidth: (barDays / totalDays) * containerWidth,
      originalLeft: (leftDays / totalDays) * containerWidth,
      originalDeadline: task.deadline,
      minDeadline: taskStart,
    });
  }, [start, totalDays, canEdit]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const dx = e.clientX - dragging.startX;
    dragOffsetRef.current = dx;
    const daysPerPx = totalDays / containerWidth;
    const deltaDays = Math.round(dx * daysPerPx);
    const newWidthDays = Math.max(1, (dragging.originalWidth / containerWidth) * totalDays + deltaDays);
    const newDeadline = new Date(dragging.minDeadline);
    newDeadline.setDate(newDeadline.getDate() + Math.round(newWidthDays) - 1);
    const bars = container.querySelectorAll<HTMLDivElement>("[data-task-id]");
    bars.forEach((bar) => {
      if (bar.dataset.taskId === dragging.taskId) {
        const leftPct = (dragging.originalLeft / containerWidth) * 100;
        const widthPct = Math.max(1, (newWidthDays / totalDays) * 100);
        bar.style.left = `${leftPct}%`;
        bar.style.width = `${widthPct}%`;
        const tooltip = bar.querySelector<HTMLDivElement>("[data-deadline-label]");
        if (tooltip) {
          tooltip.textContent = newDeadline.toLocaleDateString("vi-VN");
        }
      }
    });
  }, [dragging, totalDays]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const daysPerPx = totalDays / containerWidth;
    const dx = dragOffsetRef.current;
    const deltaDays = Math.round(dx * daysPerPx);
    const newWidthDays = Math.max(1, (dragging.originalWidth / containerWidth) * totalDays + deltaDays);
    const newDeadline = new Date(dragging.minDeadline);
    newDeadline.setDate(newDeadline.getDate() + Math.round(newWidthDays) - 1);
    if (canEdit && newDeadline.getTime() !== new Date(dragging.originalDeadline).getTime()) {
      updateTask.mutate({
        id: dragging.taskId,
        data: { deadline: newDeadline.toISOString().split("T")[0] },
      });
    }
    setDragging(null);
    dragOffsetRef.current = 0;
  }, [dragging, totalDays, updateTask, canEdit]);

  const handleMouseLeave = useCallback(() => {
    if (dragging) {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      const daysPerPx = totalDays / containerWidth;
      const deltaDays = Math.round(dragOffsetRef.current * daysPerPx);
      const newWidthDays = Math.max(1, (dragging.originalWidth / containerWidth) * totalDays + deltaDays);
      const newDeadline = new Date(dragging.minDeadline);
      newDeadline.setDate(newDeadline.getDate() + Math.round(newWidthDays) - 1);
      if (canEdit && newDeadline.getTime() !== new Date(dragging.originalDeadline).getTime()) {
        updateTask.mutate({
          id: dragging.taskId,
          data: { deadline: newDeadline.toISOString().split("T")[0] },
        });
      }
      setDragging(null);
      dragOffsetRef.current = 0;
    }
  }, [dragging, totalDays, updateTask, canEdit]);

  if (!hasValidDates) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <p className="text-sm text-red-500">Ngày tháng không hợp lệ</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm w-full dark:bg-slate-900 dark:border-slate-700">
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Biểu đồ Gantt</h3>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300">
          Thang thời gian
          <select value={scale} onChange={(e) => setScale(e.target.value as ScaleKey)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {SCALE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
        {dragging && (
          <span className="text-xs text-indigo-600 animate-pulse font-medium dark:text-indigo-400">
            Kéo thả để thay đổi hạn
          </span>
        )}
        {!canEdit && (
          <span className="text-xs text-slate-400 dark:text-slate-500">Chỉ xem</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <BarChart3 className="mb-3 h-10 w-10" />
          <p className="text-sm">Chưa có nhiệm vụ nào trong kế hoạch này</p>
        </div>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto w-full">
          <div className="flex border-b border-slate-200 pb-1 dark:border-slate-700">
            <div className="w-28 shrink-0" />
            <div className="flex flex-1 min-w-0">
              {buckets.map((b, i) => (
                <div key={i} style={{ width: `${colWidthPct}%` }} title={b.label}
                  className="shrink-0 text-center text-[10px] text-slate-400 leading-tight whitespace-nowrap overflow-hidden dark:text-slate-500">
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          <div ref={containerRef} className="select-none" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}>
            {tasks.map((task) => {
              const taskStart = new Date(task.start_date);
              const taskEnd = new Date(task.deadline);
              if (isNaN(taskStart.getTime()) || isNaN(taskEnd.getTime())) return null;
              const leftDays = Math.max(0, (taskStart.getTime() - start.getTime()) / DAY_MS);
              const barDays = Math.max(1, (taskEnd.getTime() - taskStart.getTime()) / DAY_MS + 1);
              const cStart = colForDay(leftDays);
              const cEnd = colForDay(leftDays + barDays - 1);

              return (
                <div key={task.id} className="flex items-center py-1.5 even:bg-slate-100 dark:even:bg-slate-800/50">
                  <div className="w-28 shrink-0 pr-2">
                    <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={task.name}>{task.name}</p>
                  </div>
                  <div className="relative flex-1" style={{ height: 24 }}>
                    <div className="absolute inset-0 rounded bg-slate-50 dark:bg-slate-800" />
                    <div
                      data-task-id={task.id}
                      className={`absolute top-0.5 h-5 rounded ${GANTT_COLORS[task.status] || "bg-slate-400 dark:bg-slate-600"} ${dragging?.taskId === task.id ? "shadow-lg ring-2 ring-indigo-400/50" : ""} transition-shadow`}
                      style={{ left: `${cStart * colWidthPct}%`, width: `${Math.max(1, (cEnd - cStart + 1) * colWidthPct)}%` }}
                    >
                      {canEdit && (
                        <div
                          className="absolute right-0 top-0 h-full w-3 cursor-col-resize hover:bg-white/20 rounded-r"
                          onMouseDown={(e) => handleMouseDown(e, task)}
                        />
                      )}
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" data-deadline-label>
                        {new Date(task.deadline).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
