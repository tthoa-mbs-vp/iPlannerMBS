import type { LucideIcon } from "lucide-react";

export interface Tab {
  key: string;
  label: string;
  icon?: LucideIcon;
  gradient?: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  size?: "sm" | "md";
  variant?: "tab" | "page";
  counts?: Record<string, number>;
}

const SIZE = {
  sm: "px-2.5 py-1 text-[10px]",
  md: "px-3 py-1.5 text-xs",
};

export default function TabBar({ tabs, active, onChange, className = "", size = "md", variant = "tab", counts }: Props) {
  const defaultGradient = "from-blue-500 to-indigo-600";

  if (variant === "page") {
    return (
      <div className={`flex w-fit gap-1 rounded-xl glass-light p-1 overflow-x-auto ${className}`} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          const grad = tab.gradient || defaultGradient;
          const count = counts?.[tab.key];
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? `bg-gradient-to-r ${grad} text-white shadow-lg shadow-indigo-500/20`
                  : "text-slate-500 hover:bg-white/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
              {count ? <span className="text-xs opacity-80">({count})</span> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex gap-1 rounded-xl glass-light p-1 overflow-x-auto ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        const grad = tab.gradient || defaultGradient;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-200 ${SIZE[size]} ${
              isActive
                ? `bg-gradient-to-r ${grad} text-white shadow-lg shadow-indigo-500/20`
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/30"
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
