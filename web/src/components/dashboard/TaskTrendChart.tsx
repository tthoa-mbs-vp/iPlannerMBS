import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface TaskTrendChartProps {
  data: { month: string; count: number }[];
}

export default function TaskTrendChart({ data }: TaskTrendChartProps) {
  if (data.length <= 1) return null;

  return (
    <div className="rounded-2xl glass-card p-5 transition-all duration-300 hover:shadow-lg glass-hover">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2 shadow-lg shadow-cyan-500/20">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          Xu hướng nhiệm vụ theo thời gian
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="stroke-slate-200 dark:stroke-slate-700"
          />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ fill: "#0ea5e9", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
