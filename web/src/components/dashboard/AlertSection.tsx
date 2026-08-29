import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface AlertSectionProps {
  pendingApproval: number;
  nearDeadline: number;
  overdue: number;
}

export default function AlertSection({
  pendingApproval,
  nearDeadline,
  overdue,
}: AlertSectionProps) {
  const hasAlerts = pendingApproval > 0 || nearDeadline > 0 || overdue > 0;

  return (
    <div className="rounded-2xl glass-card p-5 transition-all duration-300 hover:shadow-lg glass-hover">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2 shadow-lg shadow-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Cảnh báo
          </h3>
        </div>
        <Link
          to="/tasks"
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
        >
          Xem tất cả <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="space-y-1.5 overflow-y-auto scrollbar-thin max-h-48 pr-1">
        {pendingApproval > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            {pendingApproval} nhiệm vụ chờ duyệt
          </div>
        )}
        {nearDeadline > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 px-3 py-2 text-sm text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {nearDeadline} nhiệm vụ sắp đến hạn (≤3 ngày)
          </div>
        )}
        {overdue > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {overdue} nhiệm vụ trễ hạn
          </div>
        )}
        {!hasAlerts && (
          <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden="true" />
            Không có cảnh báo
          </div>
        )}
      </div>
    </div>
  );
}
