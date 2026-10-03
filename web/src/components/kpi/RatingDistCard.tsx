import { Star } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface RatingDistCardProps {
  data: { name: string; value: number; color: string }[];
}

export default function RatingDistCard({ data }: RatingDistCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
        <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
        Phân bố xếp loại KPI
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Chưa có dữ liệu
        </div>
      )}
    </div>
  );
}
