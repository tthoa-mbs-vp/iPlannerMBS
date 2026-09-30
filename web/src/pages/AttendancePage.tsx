import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import {
  useAttendanceLogs,
  useAttendanceConfigs,
  useCheckIn,
  useCheckOut,
} from "../hooks/useAttendance";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Wifi,
  Settings,
  ShieldCheck,
} from "lucide-react";
import WifiConfigModal from "../components/attendance/WifiConfigModal";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import { SkeletonTable } from "../components/shared/Skeleton";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_STYLES } from "../utils/constants";
import type { AttendanceStatus } from "@shared/types";

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.expand?.role_id?.can_manage;

  const { data: logs = [], isLoading, error: logsError, refetch: refetchLogs } = useAttendanceLogs(user?.id);
  const { data: configs = [] } = useAttendanceConfigs();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");

  const activeConfigs = configs.filter((c) => c.is_active);

  useEffect(() => { usePageTitleStore.getState().setTitle("Chấm công & Điểm danh"); }, []);

  // Set default selected config (render-time adjustment, avoids setState-in-effect cascade)
  if (activeConfigs.length > 0 && !selectedConfigId) {
    setSelectedConfigId(activeConfigs[0].id);
  }

  const activeConfig = activeConfigs.find((c) => c.id === selectedConfigId) || activeConfigs[0];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.check_in?.startsWith(todayStr));

  const handleCheckIn = () => {
    if (!user) return;
    const ssid = activeConfig ? activeConfig.wifi_ssid : "";
    checkInMutation.mutate({
      user_id: user.id,
      ssid,
      bssid: activeConfig?.wifi_bssid,
      config: activeConfig,
      notes: activeConfig ? `Tại ${activeConfig.office_name}` : "Check-in WiFi",
    });
  };

  const handleCheckOut = () => {
    if (todayLog?.id) {
      checkOutMutation.mutate(todayLog.id);
    }
  };

  const onTimeCount = logs.filter((l) => l.status === "on_time").length;
  const lateCount = logs.filter((l) => l.status === "late").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Chấm công & Điểm danh WiFi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Xác thực vị trí làm việc qua mạng WiFi công ty và theo dõi nghĩa vụ công
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              Cấu hình WiFi
            </button>
          )}

          {!todayLog ? (
            <button
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Wifi className="h-4 w-4" />
              {checkInMutation.isPending ? "Đang check-in..." : "Check-in WiFi Vào ca"}
            </button>
          ) : !todayLog.check_out ? (
            <button
              onClick={handleCheckOut}
              disabled={checkOutMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-700 disabled:opacity-50 transition"
            >
              <Clock className="h-4 w-4" />
              {checkOutMutation.isPending ? "Đang check-out..." : "Check-out Ra ca"}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Đã hoàn thành công hôm nay
            </div>
          )}
        </div>
      </div>

      {/* WiFi Status Widget Card */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white p-5 shadow-sm dark:border-blue-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
              <Wifi className="h-6 w-6" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                {todayLog ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-300 dark:bg-slate-500"></span>
                )}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base dark:text-slate-100">
                  {activeConfig ? activeConfig.office_name : "Mạng WiFi Văn phòng MBS"}
                </h3>
                {todayLog ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Hợp lệ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-600/60 dark:text-slate-300">
                    <Wifi className="h-3.5 w-3.5" /> Chấm công qua mạng nội bộ
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  SSID: <strong className="text-blue-700 font-mono dark:text-blue-400">{activeConfig?.wifi_ssid || "—"}</strong>
                </span>
                <span>
                  Ca làm: <strong>{activeConfig?.work_start_time || "08:00"} - {activeConfig?.work_end_time || "17:30"}</strong> (+{activeConfig?.late_tolerance_minutes || 15}m ân hạn)
                </span>
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 self-end md:self-center">
            {activeConfigs.length > 1 && (
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                {activeConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.office_name} ({cfg.wifi_ssid})
                  </option>
                ))}
              </select>
            )}

          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-700/80 dark:bg-slate-900">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-blue-100/40 via-indigo-100/30 to-transparent opacity-60 transition-all duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Tổng ngày đã công</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{logs.length}</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-700/80 dark:bg-slate-900">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-100/40 via-teal-100/30 to-transparent opacity-60 transition-all duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 p-2.5 shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Đúng giờ</p>
              <p className="text-2xl font-bold text-emerald-600">{onTimeCount}</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-700/80 dark:bg-slate-900">
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-amber-100/40 via-orange-100/30 to-transparent opacity-60 transition-all duration-500 group-hover:scale-150" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-2.5 shadow-lg shadow-amber-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Đi muộn / Về sớm</p>
              <p className="text-2xl font-bold text-amber-500">{lateCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Nhật ký Chấm công Chi tiết</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">{logs.length} bản ghi</span>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : logsError ? (
          <ErrorState message="Không thể tải nhật ký chấm công" subMessage="Vui lòng thử lại sau" onRetry={() => refetchLogs()} />
        ) : logs.length === 0 ? (
          <EmptyState icon={Clock} message="Chưa có nhật ký chấm công nào" subMessage="Chấm công để bắt đầu theo dõi" size="sm" className="py-10" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Ngày</th>
                  <th className="px-6 py-3.5">Vào ca</th>
                  <th className="px-6 py-3.5">Ra ca</th>
                  <th className="px-6 py-3.5">Phương thức & WiFi</th>
                  <th className="px-6 py-3.5">Ghi chú & Thiết bị</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="even:bg-slate-50/70 hover:bg-slate-50/50 transition dark:even:bg-slate-800/40 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                      {new Date(log.check_in).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium dark:text-slate-200">
                      {new Date(log.check_in).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium dark:text-slate-200">
                      {log.check_out
                        ? new Date(log.check_out).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:border-blue-800 dark:text-blue-300">
                        {log.method === "gps" ? <MapPin className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                        {log.method.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs text-xs text-slate-600 dark:text-slate-300">
                      <div className="truncate font-medium text-slate-700 dark:text-slate-200" title={log.notes}>
                        {log.notes || "—"}
                      </div>
                      {log.device_info && (
                        <div className="truncate text-[11px] text-slate-400 mt-0.5 dark:text-slate-500" title={log.device_info}>
                          {log.device_info.split("|")[0]}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ATTENDANCE_STATUS_STYLES[log.status as AttendanceStatus]}`}
                      >
                        {log.status === "on_time" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {ATTENDANCE_STATUS_LABELS[log.status as AttendanceStatus]}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-amber-600" /> {ATTENDANCE_STATUS_LABELS[log.status as AttendanceStatus]}
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfigModal && <WifiConfigModal onClose={() => setShowConfigModal(false)} />}
    </div>
  );
}
