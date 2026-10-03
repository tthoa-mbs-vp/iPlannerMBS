import type { LucideIcon } from "lucide-react";

interface KpiStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  bgGradient: string;
}

export default function KpiStatCard({
  label,
  value,
  icon: Icon,
  gradient,
  bgGradient,
}: KpiStatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl glass-card p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 glass-hover">
      <div
        className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${bgGradient} opacity-60 transition-all duration-500 group-hover:scale-150`}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={`rounded-lg bg-gradient-to-br ${gradient} p-2.5 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {value}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
