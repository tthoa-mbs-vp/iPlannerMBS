import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import {
  useAttendanceLogs,
  useAttendanceConfigs,
  useCheckIn,
  useCheckOut,
} from "../../hooks/useAttendance";
import {
  Clock,
  CheckCircle2,
  Wifi,
  ShieldCheck,
} from "lucide-react";

export default function MAttendancePage() {
  const user = useAuthStore((s) => s.user);
  const { data: logs = [], isLoading } = useAttendanceLogs(user?.id);
  const { data: configs = [] } = useAttendanceConfigs();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [selectedConfigId, setSelectedConfigId] = useState<string>("");

  const activeConfigs = configs.filter((c) => c.is_active);

  // Set default selected config (render-time adjustment, avoids setState-in-effect cascade)
  if (activeConfigs.length > 0 && !selectedConfigId) {
    setSelectedConfigId(activeConfigs[0].id);
  }

  const activeConfig =
    activeConfigs.find((c) => c.id === selectedConfigId) || activeConfigs[0];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.check_in?.startsWith(todayStr));

  const handleCheckIn = () => {
    if (!user) return;
    checkInMutation.mutate({
      user_id: user.id,
      ssid: activeConfig?.wifi_ssid || "",
      bssid: activeConfig?.wifi_bssid,
      config: activeConfig,
      notes: activeConfig
        ? `Tại ${activeConfig.office_name}`
        : "Check-in WiFi",
    });
  };

  const handleCheckOut = () => {
    if (todayLog?.id) {
      checkOutMutation.mutate(todayLog.id);
    }
  };

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const now = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4 p-4">
      <div className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{today}</p>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{now}</p>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 text-center shadow-sm dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
          {!todayLog ? (
            <Clock className="h-10 w-10 text-indigo-600" />
          ) : !todayLog.check_out ? (
            <Clock className="h-10 w-10 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          )}
        </div>

        <p className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">
          {!todayLog
            ? "Chưa check-in"
            : !todayLog.check_out
              ? "Đã check-in"
              : "Đã hoàn thành"}
        </p>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          {!todayLog
            ? "Bấm nút bên dưới để chấm công vào ca"
            : !todayLog.check_out
              ? "Đừng quên check-out khi kết thúc ca"
              : "Cảm ơn bạn đã làm việc hôm nay"}
        </p>

        {!todayLog ? (
          <button
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending}
            className="mx-auto flex items-center gap-3 rounded-xl bg-indigo-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
          >
            <Wifi className="h-5 w-5" />
            {checkInMutation.isPending ? "Đang xử lý..." : "CHECK-IN VÀO CA"}
          </button>
        ) : !todayLog.check_out ? (
          <button
            onClick={handleCheckOut}
            disabled={checkOutMutation.isPending}
            className="mx-auto flex items-center gap-3 rounded-xl bg-amber-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-95 disabled:opacity-50"
          >
            <Clock className="h-5 w-5" />
            {checkOutMutation.isPending ? "Đang xử lý..." : "CHECK-OUT RA CA"}
          </button>
        ) : (
          <div className="mx-auto flex items-center gap-2 rounded-xl bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
            Đã hoàn thành công hôm nay
          </div>
        )}
      </div>

      {activeConfig && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
              <Wifi className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {activeConfig.office_name}
                </p>
                {todayLog ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <ShieldCheck className="h-3 w-3" /> Hợp lệ
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Wifi className="h-3 w-3" /> Chấm công qua mạng nội bộ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                SSID: {activeConfig.wifi_ssid} | Ca: {activeConfig.work_start_time} -{" "}
                {activeConfig.work_end_time}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeConfigs.length > 1 && (
        <select
          value={selectedConfigId}
          onChange={(e) => setSelectedConfigId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {activeConfigs.map((cfg) => (
            <option key={cfg.id} value={cfg.id}>
              {cfg.office_name} ({cfg.wifi_ssid})
            </option>
          ))}
        </select>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Lịch sử chấm công
          </h2>
        </div>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Đang tải...</div>
        ) : logs.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Chưa có lịch sử
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {new Date(log.check_in).toLocaleDateString("vi-VN")}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <span>
                      Vào:{" "}
                      {new Date(log.check_in).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {log.check_out && (
                      <span>
                        Ra:{" "}
                        {new Date(log.check_out).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    log.status === "on_time"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  }`}
                >
                  {log.status === "on_time" ? "Đúng giờ" : "Đi muộn"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
