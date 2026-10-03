import { getRatingBadgeStyle, getRatingLabel } from "../../utils/constants";
import type { KpiScore } from "@shared/types";

function getScheduleLabel(progress: number): string {
  if (progress >= 100) return "Đúng hạn";
  if (progress >= 80) return "Trễ 1-3 ngày";
  if (progress >= 60) return "Trễ 4-5 ngày";
  if (progress > 0) return "Trễ >5 ngày";
  return "Chưa hoàn thành";
}

export default function KpiTaskTable({ items, title }: { items: KpiScore[]; title: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Nhiệm vụ</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Cơ bản</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Khó</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Tối đa</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Tiến độ</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Kết quả</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Thực tế</th>
          </tr>
        </thead>
        <tbody>
          {items.map((k) => {
            const task = k.expand?.task_id;
            const maxScore = k.max_converted_score ?? Math.round(k.base_score * k.difficulty_coeff * 10) / 10;
            const isFinalValid = k.id !== "";
            return (
            <tr key={task?.id || k.task_id} className="even:bg-slate-100 dark:even:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
              <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100">{task?.name || k.task_id}</td>
              <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">{k.base_score}</td>
              <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400">{(k.difficulty_coeff * 100).toFixed(0)}%</td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{maxScore.toFixed(1)}</td>
              <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-400" title={getScheduleLabel(k.progress_score)}>{isFinalValid ? k.progress_score : "—"}</td>
              <td className="px-4 py-3 text-center">
                {isFinalValid ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRatingBadgeStyle(k.result_rating)}`}>
                  {getRatingLabel(k.result_rating)}
                </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-center text-sm font-bold text-indigo-600 dark:text-indigo-300">{isFinalValid ? k.final_score : "—"}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
