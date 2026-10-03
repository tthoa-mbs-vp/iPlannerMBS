import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Loader2,
  Eye,
  ChevronLeft,
} from "lucide-react";

import {
  useStartSurpriseCheck,
  useCloseSurpriseCheck,
  useSurpriseCheckResults,
  useSurpriseCheckResultsRealtime,
  useActiveCampaigns,
} from "../../hooks/useSurpriseCheck";
import { useQuery } from "@tanstack/react-query";
import { pb } from "../../api/client";
import { formatDateTimeShort } from "../../utils/format";
import type { User } from "@shared/types";

export default function SurpriseCheckAdmin() {
  const [name, setName] = useState("Kiểm tra đột xuất");
  const [notes, setNotes] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: activeCampaigns = [], isLoading: campaignsLoading } = useActiveCampaigns();
  const startMutation = useStartSurpriseCheck();
  const closeMutation = useCloseSurpriseCheck();

  const activeCampaign = activeCampaigns.length > 0 ? activeCampaigns[0] : null;

  // Fetch all users for target selection
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users", "list"],
    queryFn: async () => {
      const users = await pb.collection("users").getFullList<User>({
        filter: "verified=true && disabled=false",
        sort: "name",
        expand: "department_id,role_id",
      });
      return users;
    },
  });

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync({
        name,
        notes,
        windowMinutes,
      });
      setShowCreateForm(false);
      setName("Kiểm tra đột xuất");
      setNotes("");
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = async (campaignId?: string) => {
    try {
      await closeMutation.mutateAsync(campaignId);
      setSelectedResult(null);
    } catch {
      // Error handled by mutation
    }
  };

  if (selectedResult) {
    return <ResultsView campaignId={selectedResult} onBack={() => setSelectedResult(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Kiểm tra đột xuất
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Quản lý các chiến dịch kiểm tra nhân sự đột xuất
          </p>
        </div>
        {!activeCampaign && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition-all hover:from-amber-600 hover:to-red-600 hover:shadow-xl"
          >
            <AlertTriangle className="h-4 w-4" />
            Bắt đầu kiểm tra
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-2xl border border-amber-200/50 bg-amber-50/30 p-6 shadow-sm dark:border-amber-800/50 dark:bg-amber-900/10">
          <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Tạo chiến dịch kiểm tra mới
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tên chiến dịch
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-sm text-slate-800 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Ghi chú (tùy chọn)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-sm text-slate-800 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                placeholder="Lý do kiểm tra..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Thời gian phản hồi (phút)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(parseInt(e.target.value) || 15)}
                className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-sm text-slate-800 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Nhân viên phải phản hồi trong khoảng thời gian này
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStart}
                disabled={startMutation.isPending || !name.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:from-amber-600 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Bắt đầu kiểm tra ({allUsers.length - 1} người)
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active campaign */}
      {campaignsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : activeCampaign ? (
        <div className="rounded-2xl border border-red-200/50 bg-red-50/30 p-6 shadow-sm dark:border-red-800/50 dark:bg-red-900/10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-rose-500 shadow-lg shadow-red-500/30">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {activeCampaign.getString?.("name") || activeCampaign.name || "Kiểm tra đang diễn ra"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Bắt đầu: {formatDateTimeShort(activeCampaign.getString?.("started_at") || activeCampaign.started_at || "")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedResult(activeCampaign.id)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
              >
                <Eye className="h-3 w-3" />
                Kết quả
              </button>
              <button
                onClick={() => handleClose(activeCampaign.id)}
                disabled={closeMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {closeMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
                Kết thúc
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/50 bg-white/30 p-12 text-center shadow-sm dark:border-slate-700/50 dark:bg-slate-800/30">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h3 className="mb-1 text-lg font-semibold text-slate-700 dark:text-slate-200">
            Không có chiến dịch đang hoạt động
          </h3>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nhấn &quot;Bắt đầu kiểm tra&quot; để tạo chiến dịch mới
          </p>
        </div>
      )}

      {/* Stats summary */}
      {!activeCampaign && !showCreateForm && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/50 bg-white/30 p-4 text-center shadow-sm dark:border-slate-700/50 dark:bg-slate-800/30">
            <Users className="mx-auto mb-2 h-6 w-6 text-indigo-400" />
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{allUsers.length}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Tổng nhân viên</p>
          </div>
          <div className="rounded-2xl border border-slate-200/50 bg-white/30 p-4 text-center shadow-sm dark:border-slate-700/50 dark:bg-slate-800/30">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {activeCampaigns.length}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Chiến dịch đã tạo</p>
          </div>
          <div className="rounded-2xl border border-slate-200/50 bg-white/30 p-4 text-center shadow-sm dark:border-slate-700/50 dark:bg-slate-800/30">
            <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-amber-400" />
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">0</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Đang hoạt động</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Results view for a specific campaign */
function ResultsView({
  campaignId,
  onBack,
}: {
  campaignId: string;
  onBack: () => void;
}) {
  const { data: results, isLoading } = useSurpriseCheckResults(campaignId);
  useSurpriseCheckResultsRealtime(campaignId);
  const closeMutation = useCloseSurpriseCheck();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="py-12 text-center text-slate-400">
        Không tìm thấy dữ liệu
      </div>
    );
  }

  const respondedList = results.details.filter((d) => d.responded);
  const notRespondedList = results.details.filter((d) => !d.responded);
  const responseRate = results.total > 0 ? Math.round((results.responded / results.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Quay lại"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {results.campaign.name}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {formatDateTimeShort(results.campaign.started_at)}
              {results.campaign.ended_at && ` → ${formatDateTimeShort(results.campaign.ended_at)}`}
            </p>
          </div>
        </div>
        {results.campaign.status === "active" && (
          <button
            onClick={() => closeMutation.mutateAsync(campaignId)}
            disabled={closeMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
          >
            <Square className="h-3 w-3" />
            Kết thúc
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tổng" value={results.total} icon={Users} color="indigo" />
        <StatCard label="Đã phản hồi" value={results.responded} icon={CheckCircle2} color="emerald" />
        <StatCard label="Chưa phản hồi" value={results.not_responded} icon={XCircle} color="red" />
        <StatCard label="Tỷ lệ" value={`${responseRate}%`} icon={ShieldCheck} color={responseRate >= 80 ? "emerald" : responseRate >= 50 ? "amber" : "red"} />
      </div>

      {/* Not responded list */}
      {notRespondedList.length > 0 && (
        <div className="rounded-2xl border border-red-200/50 bg-red-50/30 p-4 dark:border-red-800/50 dark:bg-red-900/10">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
            <XCircle className="h-4 w-4" />
            Chưa phản hồi ({notRespondedList.length})
          </h3>
          <div className="space-y-2">
            {notRespondedList.map((d) => (
              <div key={d.user_id} className="flex items-center justify-between rounded-xl bg-white/60 px-4 py-2.5 dark:bg-slate-800/60">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {d.user_name || d.user_id}
                  </p>
                  {d.department && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{d.department}</p>
                  )}
                </div>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/40 dark:text-red-300">
                  Vắng mặt
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Responded list */}
      {respondedList.length > 0 && (
        <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/30 p-4 dark:border-emerald-800/50 dark:bg-emerald-900/10">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Đã phản hồi ({respondedList.length})
          </h3>
          <div className="space-y-2">
            {respondedList.map((d) => (
              <div key={d.user_id} className="flex items-center justify-between rounded-xl bg-white/60 px-4 py-2.5 dark:bg-slate-800/60">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {d.user_name || d.user_id}
                  </p>
                  {d.department && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{d.department}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                    ✓ Có mặt
                  </span>
                  {d.responded_at && (
                    <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                      {formatDateTimeShort(d.responded_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  color: "indigo" | "emerald" | "red" | "amber";
}) {
  const colors = {
    indigo: "from-indigo-400 to-indigo-500 shadow-indigo-500/30",
    emerald: "from-emerald-400 to-emerald-500 shadow-emerald-500/30",
    red: "from-red-400 to-red-500 shadow-red-500/30",
    amber: "from-amber-400 to-amber-500 shadow-amber-500/30",
  };
  return (
    <div className="rounded-2xl border border-slate-200/50 bg-white/30 p-4 text-center shadow-sm dark:border-slate-700/50 dark:bg-slate-800/30">
      <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${colors[color]} shadow-lg`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}
