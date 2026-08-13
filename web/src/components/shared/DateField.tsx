import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { format, parse } from "date-fns";
import { vi } from "date-fns/locale/vi";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function DateField({ value, onChange, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayDate = value
    ? format(parse(value, "yyyy-MM-dd", new Date()), "dd/MM/yyyy", { locale: vi })
    : "";

  const openPicker = () => {
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
    } else {
      inputRef.current?.focus();
      inputRef.current?.click();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        onClick={openPicker}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
        tabIndex={-1}
      >
        <CalendarDays className="h-4 w-4 text-slate-400 shrink-0 dark:text-slate-500" />
        <span className={displayDate ? "" : "text-slate-400 dark:text-slate-500"}>{displayDate || "Chọn ngày"}</span>
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={openPicker}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  );
}
