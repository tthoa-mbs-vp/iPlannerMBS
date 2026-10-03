import { Building2 } from "lucide-react";
import TabBar from "../shared/TabBar";
import DonutChart from "../shared/DonutChart";
import {
  PLAN_STATUS_LABELS,
  TASK_STATUS_LABELS,
  PLAN_STATUS_HEX,
  TASK_STATUS_HEX,
} from "../../utils/constants";

interface DeptStat {
  deptId: string;
  deptName: string;
  planTotal: number;
  taskTotal: number;
  planData: { status: string; value: number; label: string }[];
  taskData: { status: string; value: number; label: string }[];
}

interface DepartmentStatsProps {
  deptStats: DeptStat[];
  activeTab: "plans" | "tasks";
  onTabChange: (tab: "plans" | "tasks") => void;
}

export default function DepartmentStats({
  deptStats,
  activeTab,
  onTabChange,
}: DepartmentStatsProps) {
  if (deptStats.length === 0) return null;

  const statusLabels = activeTab === "plans" ? PLAN_STATUS_LABELS : TASK_STATUS_LABELS;
  const statusHex = activeTab === "plans" ? PLAN_STATUS_HEX : TASK_STATUS_HEX;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Thống kê theo phòng ban
          </h3>
        </div>
        <TabBar
          tabs={[
            { key: "plans", label: "Kế hoạch", gradient: "from-blue-500 to-indigo-600" },
            { key: "tasks", label: "Nhiệm vụ", gradient: "from-emerald-500 to-teal-600" },
          ]}
          active={activeTab}
          onChange={(k) => onTabChange(k as "plans" | "tasks")}
          size="sm"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {deptStats.map((stat) => {
          const chartData = activeTab === "plans" ? stat.planData : stat.taskData;
          const total = activeTab === "plans" ? stat.planTotal : stat.taskTotal;
          return (
            <div
              key={stat.deptId}
              className="rounded-2xl glass-card p-4 transition-all duration-300 hover:shadow-md glass-hover"
            >
              <div className="mb-2 flex items-center justify-between">
                <h4
                  className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"
                  title={stat.deptName}
                >
                  {stat.deptName}
                </h4>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {total}
                </span>
              </div>
              {chartData.length > 0 ? (
                <div className="flex justify-center">
                  <DonutChart
                    data={chartData}
                    colorFor={(s) =>
                      (statusHex as Record<string, string>)[s] || "#cbd5e1"
                    }
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-xs text-slate-300 dark:text-slate-600">
                  Chưa có dữ liệu
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 rounded-xl glass-light px-4 py-2.5 text-xs">
        {Object.entries(statusLabels).map(([key, label]) => {
          const hex = (statusHex as Record<string, string>)[key] || "#cbd5e1";
          return (
            <span
              key={key}
              className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: hex }}
              />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
