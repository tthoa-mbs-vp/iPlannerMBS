import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  gradient: string;
  shadow: string;
  title: string;
  count: number;
  countUnit: string;
  subtitle: string;
  children?: ReactNode;
}

export default function ManagerHeader({ icon, gradient, shadow, title, count, countUnit, subtitle, children }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className={`shrink-0 rounded-lg bg-gradient-to-br ${gradient} p-2 shadow-lg ${shadow}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            <span className="truncate">{title}</span>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500 dark:bg-slate-700 dark:text-slate-300">{count} {countUnit}</span>
          </h3>
          <p className="truncate text-sm text-slate-400 dark:text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
