import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  shadow: string;
  badgeBg?: string;
  trend?: string;
  subtitle?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  shadow,
  subtitle,
  trend,
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl glass-card p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 glass-hover">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br from-indigo-200/30 via-purple-200/20 to-transparent dark:from-indigo-500/15 dark:via-purple-500/10 opacity-80 transition-all duration-500 group-hover:scale-150 blur-sm" />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate"
            title={label}
          >
            {label}
          </p>
          <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={`rounded-lg bg-gradient-to-br ${gradient} p-2 shadow-md ${shadow} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0`}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      {trend && (
        <div className="mt-2 h-1 w-full rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
            style={{ width: `${Math.min(Number(trend) * 10, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
