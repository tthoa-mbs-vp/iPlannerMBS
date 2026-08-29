import { Award, TrendingUp, Star, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import KpiStatCard from "./KpiStatCard";

interface KpiScore {
  final_score: number;
  result_rating: number;
}

interface KpiOverviewProps {
  scores: KpiScore[];
}

export default function KpiOverview({ scores }: KpiOverviewProps) {
  if (scores.length === 0) return null;

  const avgScore = (
    scores.reduce((s, k) => s + k.final_score, 0) / scores.length
  ).toFixed(1);
  const excellentCount = scores.filter((k) => k.result_rating >= 4).length;
  const goodPlusCount = scores.filter((k) => k.result_rating >= 3).length;

  return (
    <div className="rounded-2xl glass-card p-5 transition-all duration-300 hover:shadow-lg glass-hover">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-2 shadow-lg shadow-amber-500/20">
            <Award className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Tổng quan KPI
          </h3>
        </div>
        <Link
          to="/kpi"
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
        >
          Xem tất cả <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiStatCard
          label="Đã chấm điểm"
          value={scores.length}
          icon={Award}
          gradient="from-amber-400 to-orange-500"
          bgGradient="from-amber-100/40 via-orange-100/30 to-transparent dark:from-amber-900/20 dark:via-orange-900/20"
        />
        <KpiStatCard
          label="Điểm TB"
          value={avgScore}
          icon={TrendingUp}
          gradient="from-emerald-400 to-teal-500"
          bgGradient="from-emerald-100/40 via-teal-100/30 to-transparent dark:from-emerald-900/20 dark:via-teal-900/20"
        />
        <KpiStatCard
          label="Xuất sắc / Tốt"
          value={excellentCount}
          icon={Star}
          gradient="from-blue-500 to-indigo-600"
          bgGradient="from-blue-100/40 via-indigo-100/30 to-transparent dark:from-blue-900/20 dark:via-indigo-900/20"
        />
        <KpiStatCard
          label="Từ Khá trở lên"
          value={goodPlusCount}
          icon={CheckCircle2}
          gradient="from-cyan-500 to-blue-600"
          bgGradient="from-cyan-100/40 via-blue-100/30 to-transparent dark:from-cyan-900/20 dark:via-blue-900/20"
        />
      </div>
    </div>
  );
}
