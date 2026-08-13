import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  message: string;
  subMessage?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { icon: "h-8 w-8", text: "text-xs", spacing: "py-8 gap-2" },
  md: { icon: "h-12 w-12", text: "text-sm", spacing: "py-12 gap-3" },
  lg: { icon: "h-16 w-16", text: "text-base", spacing: "py-16 gap-4" },
};

export default function EmptyState({ icon: Icon, message, subMessage, action, className = "", size = "md" }: Props) {
  const s = SIZES[size];
  return (
    <div className={`flex flex-col items-center justify-center ${s.spacing} text-slate-400 dark:text-slate-500 ${className}`}>
      <Icon className={`${s.icon} text-slate-300 dark:text-slate-600`} />
      <p className={s.text}>{message}</p>
      {subMessage && (
        <p className={`text-slate-400 dark:text-slate-500 ${size === "sm" ? "text-xs" : "text-xs"}`}>{subMessage}</p>
      )}
      {action && (
        <button onClick={action.onClick}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}
