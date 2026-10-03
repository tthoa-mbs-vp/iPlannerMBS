import { useMemo, useState } from "react";
import {
  usePresentUsers,
  usePresenceCampaigns,
  useStartPresenceCampaign,
  useStopPresenceCampaign,
  useRunPresenceCheck,
  usePresenceCheckLogs,
} from "../../hooks/usePresence";
import { useDepartments } from "../../hooks/useDepartments";
import { Radio, Play, Square, RefreshCw, Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import { btn } from "../../utils/buttonClasses";
import ManagerHeader from "../shared/ManagerHeader";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import { format } from "date-fns";
import { vi } from "date-fns/locale/vi";
import type { PresenceCampaignSummary } from "@shared/types";

export default function PresenceManager() {
  const { data: presentUsers = [], isLoading: presentLoading } = usePresentUsers();
  const { data: campaigns = [], isLoading: campaignsLoading } = usePresenceCampaigns();
  const { data: departments = [] } = useDepartments();

  const [campaignName, setCampaignName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const startCampaign = useStartPresenceCampaign();
  const stopCampaign = useStopPresenceCampaign();
  const runCheck = useRunPresenceCheck();

  const activeCampaign = campaigns.find((c) => c.status === "active") || null;
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || activeCampaign || campaigns[0];
  const { data: checkLogs = [] } = usePresenceCheckLogs(selectedCampaign?.id);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    departments.forEach((d) => { m[d.id] = d.name; });
    return m;
  }, [departments]);

  const presentCount = presentUsers.length;
  const totalOnline = campaignsLoading ? 0 : presentCount;

  const handleStart = () => {
    startCampaign.mutate({ name: campaignName || undefined });
    setCampaignName("");
  };

  const handleStop = () => {
    if (!activeCampaign) return;
    stopCampaign.mutate({ id: activeCampaign.id });
  };

  const handleRunCheck = () => {
    if (!selectedCampaign) return;
    runCheck.mutate(selectedCampaign.id);
  };

  return (
    <div className="space-y-6">
      <ManagerHeader
        icon={<Radio className="h-5 w-5 text-white" />}
        gradient="from-rose-500 to-red-600"
        shadow="shadow-rose-500/30"
        title="Đợt kiểm tra hiện diện"
        count={totalOnline}
        countUnit="người có mặt"
        subtitle="Người hồi đáp heartbeat trong cửa sổ đợt kiểm tra được tính là có mặt"
      >
        <button
          onClick={handleStop}
          disabled={!activeCampaign || stopCampaign.isPending}
          className={`${btn.add} bg-rose-600 hover:bg-rose-700`}
        >
          <Square className="h-4 w-4" />
          Đóng đợt
        </button>
        <button
          onClick={handleStart}
          disabled={!!activeCampaign || startCampaign.isPending}
          className={btn.add}
        >
          <Play className="h-4 w-4" />
          Kích hoạt đợt kiểm tra
        </button>
      </ManagerHeader>

      {/* Active campaign banner */}
      {activeCampaign ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{activeCampaign.name}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Đang hoạt động từ {format(new Date(activeCampaign.started_at), "HH:mm dd/MM/yyyy", { locale: vi })}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            {presentCount} có mặt
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          <Radio className="h-4 w-4 text-slate-400" />
          Chưa có đợt kiểm tra nào đang hoạt động. Kích hoạt để mở cửa sổ nhận heartbeat.
          <div className="ml-auto flex items-center gap-2">
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Tên đợt kiểm tra (tuỳ chọn)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
            <button onClick={handleStart} disabled={startCampaign.isPending} className={btn.add}>
              <Play className="h-4 w-4" />
              Kích hoạt
            </button>
          </div>
        </div>
      )}

      {/* Who is online right now */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Đang có mặt ngay bây giờ</h3>
          </div>
          <span className="text-xs text-slate-400">heartbeat trong 60s qua</span>
        </div>
        {presentLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : presentUsers.length === 0 ? (
          <EmptyState icon={Users} message="Chưa có ai gửi heartbeat. Hãy mở app mobile để bắt đầu." />
        ) : (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {presentUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{u.name}</p>
                  <p className="truncate text-xs text-slate-400">{u.department_id ? deptMap[u.department_id] || "—" : "—"}</p>
                </div>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {format(new Date(u.last_seen_at), "HH:mm:ss")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign history */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Lịch sử đợt kiểm tra</h3>
          </div>
        </div>

        {campaignsLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Clock} message="Chưa có đợt kiểm tra nào" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {campaigns.slice(0, 10).map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                selected={selectedCampaign?.id === c.id}
                onSelect={() => setSelectedCampaignId(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected campaign results */}
      {selectedCampaign && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                Kết quả: {selectedCampaign.name}
              </h3>
            </div>
            <button
              onClick={handleRunCheck}
              disabled={runCheck.isPending}
              className={btn.export}
            >
              <RefreshCw className={`h-4 w-4 ${runCheck.isPending ? "animate-spin" : ""}`} />
              Chạy kiểm tra
            </button>
          </div>

          {checkLogs.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="Chưa có kết quả. Bấm 'Chạy kiểm tra' để đánh giá ai đã hồi đáp trong cửa sổ đợt." />
          ) : (
            <div className="max-h-96 overflow-auto p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="px-2 py-2 text-left text-xs font-bold text-slate-500">Người dùng</th>
                    <th className="px-2 py-2 text-left text-xs font-bold text-slate-500">Phòng ban</th>
                    <th className="px-2 py-2 text-left text-xs font-bold text-slate-500">Trạng thái</th>
                    <th className="px-2 py-2 text-left text-xs font-bold text-slate-500">Hồi đáp lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {checkLogs.map((log) => (
                    <tr key={log.user_id} className="border-b border-slate-50 last:border-0 even:bg-slate-100/60 dark:border-slate-800 dark:even:bg-slate-800/40">
                      <td className="px-2 py-2 font-medium text-slate-700 dark:text-slate-200">{log.name}</td>
                      <td className="px-2 py-2 text-slate-400">{log.department_id ? deptMap[log.department_id] || "—" : "—"}</td>
                      <td className="px-2 py-2">
                        {log.responded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Có mặt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                            <XCircle className="h-3 w-3" /> Vắng mặt
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {log.responded_at ? format(new Date(log.responded_at), "HH:mm dd/MM/yyyy", { locale: vi }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  selected,
  onSelect,
}: {
  campaign: PresenceCampaignSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusBadge =
    campaign.status === "active" ? (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
        Đang hoạt động
      </span>
    ) : (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
        Đã đóng
      </span>
    );

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{campaign.name}</p>
          {statusBadge}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {format(new Date(campaign.started_at), "HH:mm dd/MM/yyyy", { locale: vi })}
          {campaign.ended_at ? ` → ${format(new Date(campaign.ended_at), "HH:mm dd/MM/yyyy", { locale: vi })}` : ""}
          {campaign.started_by_name ? ` · ${campaign.started_by_name}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          {campaign.responded} có mặt
        </span>
        <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          {campaign.absent} vắng
        </span>
      </div>
    </button>
  );
}
