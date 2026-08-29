import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Task } from "@shared/types";
import { TASK_STATUS_LABELS } from "../../utils/constants";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: Date[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, -startPad + i + 1);
    days.push(d);
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month + 1, d));
  }
  return days;
}

function getWeekDays(year: number, month: number, weekIndex: number): Date[] {
  const monthDays = getMonthDays(year, month);
  const start = weekIndex * 7;
  return monthDays.slice(start, start + 7);
}

export default function CalendarView({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekIndex, setWeekIndex] = useState(Math.floor((now.getDate() + now.getDay()) / 7));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);
  const weekDays = useMemo(() => getWeekDays(year, month, weekIndex), [year, month, weekIndex]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = task.deadline?.split("T")[0];
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
      const startKey = task.start_date?.split("T")[0];
      if (startKey && startKey !== key) {
        if (!map.has(startKey)) map.set(startKey, []);
        map.get(startKey)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const navigate = (dir: number) => {
    if (viewMode === "month") {
      const d = new Date(year, month + dir, 1);
      setViewDate(d);
    } else {
      const newWeek = weekIndex + dir;
      if (newWeek < 0 || newWeek > 5) {
        const d = new Date(year, month + (dir > 0 ? 1 : -1), 1);
        setViewDate(d);
        setWeekIndex(dir > 0 ? 0 : 5);
      } else {
        setWeekIndex(newWeek);
      }
    }
  };

  const todayStr = now.toISOString().split("T")[0];
  const days = viewMode === "month" ? monthDays : weekDays;
  const title = viewDate.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50/50 p-0.5 mr-2 dark:border-slate-700 dark:bg-slate-800/60">
            <button onClick={() => { setViewMode("month"); setWeekIndex(Math.floor((now.getDate() + now.getDay()) / 7)); }}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${viewMode === "month" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}>
              Tháng
            </button>
            <button onClick={() => setViewMode("week")}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${viewMode === "week" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}>
              Tuần
            </button>
          </div>
          <button onClick={() => navigate(-1)} aria-label="Tháng trước" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => { setViewDate(new Date(now.getFullYear(), now.getMonth(), 1)); setWeekIndex(Math.floor((now.getDate() + now.getDay()) / 7)); }}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors dark:text-indigo-400 dark:hover:bg-indigo-950/40">
            Hôm nay
          </button>
          <button onClick={() => navigate(1)} aria-label="Tháng sau" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden dark:bg-slate-700">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-slate-50 px-2 py-1.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:bg-slate-800 dark:text-slate-400">
              {label}
            </div>
          ))}
          {days.map((day, idx) => {
            const dateStr = day.toISOString().split("T")[0];
            const dayTasks = taskMap.get(dateStr) || [];
            const isToday = dateStr === todayStr;
            const isCurrentMonth = day.getMonth() === month;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={idx}
                className={`min-h-24 bg-white p-1.5 transition-colors dark:bg-slate-900 ${isToday ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/30" : ""} ${!isCurrentMonth ? "bg-slate-50/50 dark:bg-slate-800/60" : ""}`}>
                <div className={`text-xs font-semibold mb-1 ${isToday ? "text-indigo-600 dark:text-indigo-400" : isWeekend ? "text-red-400" : isCurrentMonth ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div key={task.id}
                      className="truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: task.status === "completed" ? "#d1fae5" : task.status === "in_progress" ? "#dbeafe" : task.status === "pending_approval" ? "#fef3c7" : "#f1f5f9" }}
                      title={`${task.name} (${TASK_STATUS_LABELS[task.status]})`}>
                      {task.name}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[9px] text-slate-400 font-medium pl-1 dark:text-slate-500">+{dayTasks.length - 3} nhiệm vụ</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
