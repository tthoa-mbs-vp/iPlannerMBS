import TabBar from "../shared/TabBar";

type StatsMode = "all" | "month" | "quarter" | "year";

interface PeriodOption {
  value: string;
  label: string;
}

interface PeriodFilterProps {
  mode: StatsMode;
  onModeChange: (mode: StatsMode) => void;
  yearOptions: PeriodOption[];
  quarterOptions: PeriodOption[];
  monthOptions: PeriodOption[];
  selectedMonth: string;
  selectedQuarter: string;
  selectedYear: string;
  onMonthChange: (v: string) => void;
  onQuarterChange: (y: string, q: string) => void;
  onYearChange: (v: string) => void;
  taskCount: number;
  planCount: number;
}

const PERIOD_TABS: { key: StatsMode; label: string; gradient: string }[] = [
  { key: "all", label: "Tất cả", gradient: "from-slate-500 to-slate-600" },
  { key: "month", label: "Tháng", gradient: "from-blue-500 to-indigo-600" },
  { key: "quarter", label: "Quý", gradient: "from-emerald-500 to-teal-600" },
  { key: "year", label: "Năm", gradient: "from-amber-500 to-orange-600" },
];

const SELECT_CLASSES =
  "rounded-xl glass-input px-3.5 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export default function PeriodFilter({
  mode,
  onModeChange,
  yearOptions,
  quarterOptions,
  monthOptions,
  selectedMonth,
  selectedQuarter,
  selectedYear,
  onMonthChange,
  onQuarterChange,
  onYearChange,
  taskCount,
  planCount,
}: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-3">
      <TabBar
        tabs={PERIOD_TABS}
        active={mode}
        onChange={(k) => onModeChange(k as StatsMode)}
        size="sm"
      />
      {mode === "month" && (
        <select
          aria-label="Chọn tháng"
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className={SELECT_CLASSES}
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      {mode === "quarter" && (
        <select
          aria-label="Chọn quý"
          value={selectedQuarter}
          onChange={(e) => {
            const [y, q] = e.target.value.split("-Q");
            onQuarterChange(y, q);
          }}
          className={SELECT_CLASSES}
        >
          {quarterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {mode === "year" && (
        <select
          aria-label="Chọn năm"
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
          className={SELECT_CLASSES}
        >
          {yearOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      <span className="text-xs text-slate-400 dark:text-slate-500">
        ({taskCount} NV · {planCount} KH)
      </span>
    </div>
  );
}
