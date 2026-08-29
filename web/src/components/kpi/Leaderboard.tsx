import { useMemo, useState } from "react";
import { Trophy, Medal, Award, Building2, Users } from "lucide-react";
import { useKpiScores } from "../../hooks/useKpiScores";
import { useUsers } from "../../hooks/useDepartments";
import EmptyState from "../shared/EmptyState";

export default function Leaderboard() {
  const { data: kpiScores } = useKpiScores();
  const { data: users } = useUsers();
  const [viewMode, setViewMode] = useState<"individual" | "department">("individual");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const entries = useMemo(() => {
    if (!kpiScores || !users) return [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const [yearStr, monthStr] = month.split("-");
    const y = parseInt(yearStr);
    const m = parseInt(monthStr);

    const filtered = kpiScores.filter((ks) => {
      if (!ks.expand?.task_id || ks.expand.task_id.is_deleted) return false;
      const d = new Date(ks.created);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    });

    if (viewMode === "individual") {
      const userScores = new Map<string, { total: number; count: number }>();
      filtered.forEach((ks) => {
        const taskUserId = (ks as unknown as { expand?: { task_id?: { executor_id?: string } } }).expand?.task_id?.executor_id;
        if (taskUserId && userMap.has(taskUserId)) {
          const entry = userScores.get(taskUserId) || { total: 0, count: 0 };
          entry.total += ks.final_score || 0;
          entry.count += 1;
          userScores.set(taskUserId, entry);
        }
      });

      const sorted = Array.from(userScores.entries())
        .map(([id, data]) => ({
          id,
          name: userMap.get(id)?.name || userMap.get(id)?.email || id,
          department: userMap.get(id)?.expand?.department_id?.name || "",
          avgScore: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
          taskCount: data.count,
          totalScore: Math.round(data.total * 10) / 10,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      return sorted;
    } else {
      const deptScores = new Map<string, { total: number; count: number }>();
      filtered.forEach((ks) => {
        const taskUserId = (ks as unknown as { expand?: { task_id?: { executor_id?: string } } }).expand?.task_id?.executor_id;
        if (taskUserId && userMap.has(taskUserId)) {
          const dept = userMap.get(taskUserId)?.expand?.department_id?.name || "Chưa có phòng ban";
          const entry = deptScores.get(dept) || { total: 0, count: 0 };
          entry.total += ks.final_score || 0;
          entry.count += 1;
          deptScores.set(dept, entry);
        }
      });

      const sorted = Array.from(deptScores.entries())
        .map(([name, data]) => ({
          rank: 0,
          id: name,
          name,
          department: name,
          avgScore: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
          taskCount: data.count,
          totalScore: Math.round(data.total * 10) / 10,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      return sorted;
    }
  }, [kpiScores, users, viewMode, month]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-slate-400 dark:text-slate-500" />;
    if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />;
    return <span className="text-xs font-bold text-slate-400 w-4 text-center dark:text-slate-500">{rank}</span>;
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Bảng Xếp hạng Thi đua</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50/50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
            <button onClick={() => setViewMode("individual")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${viewMode === "individual" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-300" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}>
              <Users className="h-3 w-3" />
              Cá nhân
            </button>
            <button onClick={() => setViewMode("department")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${viewMode === "department" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-indigo-300" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`}>
              <Building2 className="h-3 w-3" />
              Phòng ban
            </button>
          </div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            max={currentMonth}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Trophy} message="Chưa có dữ liệu KPI trong tháng này" className="py-16" />
      ) : (
        <div className="p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-10 dark:text-slate-400">#</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">{viewMode === "individual" ? "Cá nhân" : "Phòng ban"}</th>
                {viewMode === "individual" && (
                  <th className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">Phòng ban</th>
                )}
                <th className="px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">Điểm TB</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">SL</th>
                <th className="px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 20).map((entry) => (
                <tr key={entry.id}
                  className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors dark:border-slate-800 dark:hover:bg-slate-800/50 ${entry.rank <= 3 ? "bg-amber-50/30 dark:bg-amber-950/20" : ""}`}>
                  <td className="px-2 py-2.5 text-center">{getRankIcon(entry.rank)}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      {entry.rank === 1 && <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                      <span className="font-semibold text-slate-800 truncate max-w-32 dark:text-slate-100" title={entry.name}>{entry.name}</span>
                    </div>
                  </td>
                  {viewMode === "individual" && (
                    <td className="px-2 py-2.5 text-slate-400 dark:text-slate-500">{entry.department || "—"}</td>
                  )}
                  <td className="px-2 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{entry.avgScore}</td>
                  <td className="px-2 py-2.5 text-center text-slate-500 dark:text-slate-400">{entry.taskCount}</td>
                  <td className="px-2 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-200">{entry.totalScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
