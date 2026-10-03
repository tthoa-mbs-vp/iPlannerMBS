import { ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../shared/EmptyState";
import Pagination from "../shared/Pagination";
import { PLAN_STATUS_LABELS, PLAN_STATUS_STYLES } from "../../utils/constants";

interface Plan {
  id: string;
  name: string;
  status: string;
}

interface RecentPlansProps {
  plans: Plan[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function RecentPlans({
  plans,
  totalCount,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: RecentPlansProps) {
  return (
    <div className="rounded-2xl glass-card p-5 transition-all duration-300 hover:shadow-lg glass-hover">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2 shadow-lg shadow-blue-500/20">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Kế hoạch gần đây
          </h3>
        </div>
        <Link
          to="/plans"
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
        >
          Xem tất cả <span aria-hidden="true">→</span>
        </Link>
      </div>
      {plans.length > 0 ? (
        <div className="space-y-1.5 overflow-y-auto scrollbar-thin max-h-48 pr-1">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200 glass-light hover:bg-white/60 dark:hover:bg-white/5"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 truncate">
                {plan.name}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${(PLAN_STATUS_STYLES as Record<string, string>)[plan.status] || ""}`}
              >
                {(PLAN_STATUS_LABELS as Record<string, string>)[plan.status] || plan.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} message="Chưa có kế hoạch" className="py-8" />
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={onPageChange}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        totalCount={totalCount}
      />
    </div>
  );
}
