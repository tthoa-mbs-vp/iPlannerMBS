import { useState } from "react";
import { X, Plus, Pencil, Trash2, Check, Wifi, Clock, ShieldCheck } from "lucide-react";
import {
  useAttendanceConfigs,
  useCreateAttendanceConfig,
  useUpdateAttendanceConfig,
  useDeleteAttendanceConfig,
} from "../../hooks/useAttendance";
import type { AttendanceConfig } from "@shared/types";

interface Props {
  onClose: () => void;
}

// Matches a single IPv4 or IPv4 CIDR entry (e.g. 192.168.1.5, 192.168.1.0/24).
const IP_ENTRY_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/;

function isValidIpEntry(entry: string): boolean {
  if (entry === "*") return true; // allow any IP (server-side wildcard)
  if (entry.includes(":")) return true; // IPv6 — passed through to the server as exact match
  const m = entry.match(IP_ENTRY_RE);
  if (!m) return false;
  if ([m[1], m[2], m[3], m[4]].some((o) => Number(o) > 255)) return false;
  if (m[6] !== undefined && Number(m[6]) > 32) return false;
  return true;
}

export default function WifiConfigModal({ onClose }: Props) {
  const { data: configs = [], isLoading } = useAttendanceConfigs();
  const createMutation = useCreateAttendanceConfig();
  const updateMutation = useUpdateAttendanceConfig();
  const deleteMutation = useDeleteAttendanceConfig();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [officeName, setOfficeName] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiBssid, setWifiBssid] = useState("");
  const [allowedIps, setAllowedIps] = useState("");
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("17:30");
  const [lateTolerance, setLateTolerance] = useState(15);
  const [isActive, setIsActive] = useState(true);
  const [ipError, setIpError] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setOfficeName("");
    setWifiSsid("");
    setWifiBssid("");
    setAllowedIps("");
    setWorkStartTime("08:00");
    setWorkEndTime("17:30");
    setLateTolerance(15);
    setIsActive(true);
    setIpError("");
  };

  const startEdit = (cfg: AttendanceConfig) => {
    setEditingId(cfg.id);
    setIsAdding(false);
    setOfficeName(cfg.office_name || "");
    setWifiSsid(cfg.wifi_ssid || "");
    setWifiBssid(cfg.wifi_bssid || "");
    setAllowedIps(Array.isArray(cfg.allowed_ips) ? cfg.allowed_ips.join(", ") : "");
    setWorkStartTime(cfg.work_start_time || "08:00");
    setWorkEndTime(cfg.work_end_time || "17:30");
    setLateTolerance(cfg.late_tolerance_minutes ?? 15);
    setIsActive(cfg.is_active ?? true);
    setIpError("");
  };

  const handleSave = async () => {
    if (!officeName.trim() || !wifiSsid.trim()) return;

    const ipsArr = allowedIps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // The server silently skips malformed entries — validate up front so a typo
    // cannot silently lock everyone out of check-in (empty list = private-range fallback).
    const invalid = ipsArr.filter((ip) => !isValidIpEntry(ip));
    if (invalid.length > 0) {
      setIpError(`Định dạng không hợp lệ: ${invalid.join(", ")}`);
      return;
    }

    const payload: Partial<AttendanceConfig> = {
      office_name: officeName.trim(),
      wifi_ssid: wifiSsid.trim(),
      wifi_bssid: wifiBssid.trim() || undefined,
      allowed_ips: ipsArr,
      work_start_time: workStartTime,
      work_end_time: workEndTime,
      late_tolerance_minutes: Number(lateTolerance) || 15,
      is_active: isActive,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa cấu hình WiFi "${name}"?`)) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100 dark:bg-slate-900 dark:border-slate-700">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:border-slate-700 dark:from-blue-950/40 dark:to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cấu hình WiFi Chấm công</h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">Quản lý các mạng WiFi & Giờ làm việc hợp lệ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top action bar */}
          {!isAdding && !editingId && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Danh sách WiFi hợp lệ ({configs.length})
              </span>
              <button
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition"
              >
                <Plus className="h-4 w-4" /> Thêm điểm WiFi mới
              </button>
            </div>
          )}

          {/* Form Create/Edit */}
          {(isAdding || editingId) && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5 space-y-4 dark:border-blue-700 dark:bg-blue-900/20">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3 dark:border-blue-700">
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                  {editingId ? "Chỉnh sửa Cấu hình WiFi" : "Thêm Điểm WiFi Chấm công mới"}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                >
                  Hủy bỏ
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Tên Văn phòng / Chi nhánh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    placeholder="VD: Văn phòng chính - Tầng 5"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Tên Mạng WiFi (SSID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="VD: Office WiFi"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    MAC Address Router (BSSID - Không bắt buộc)
                  </label>
                  <input
                    type="text"
                    value={wifiBssid}
                    onChange={(e) => setWifiBssid(e.target.value)}
                    placeholder="VD: 00:11:22:33:44:55"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    IP mạng nội bộ được phép chấm công (Phân cách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={allowedIps}
                    onChange={(e) => {
                      setAllowedIps(e.target.value);
                      if (ipError) setIpError("");
                    }}
                    placeholder="VD: 192.168.1.0/24, 192.168.1.5"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600 ${ipError ? "border-red-400 dark:border-red-500" : "border-slate-300"}`}
                  />
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    Hỗ trợ IP đơn (192.168.1.5), dải CIDR (192.168.1.0/24) hoặc * (mọi IP). Để trống = cho phép mọi IP trong mạng nội bộ.
                  </p>
                  {ipError && (
                    <p className="mt-1 text-[11px] font-medium text-red-500 dark:text-red-400">{ipError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Giờ vào ca chính thức
                  </label>
                  <input
                    type="time"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Giờ ra ca chính thức
                  </label>
                  <input
                    type="time"
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 dark:text-slate-200">
                    Ân hạn đi muộn (phút)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={lateTolerance}
                    onChange={(e) => setLateTolerance(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                    />
                    Kích hoạt điểm chấm công này
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-blue-100 dark:border-blue-700">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition"
                >
                  <Check className="h-4 w-4" />
                  {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
                </button>
              </div>
            </div>
          )}

          {/* Configs List */}
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-300">Đang tải cấu hình...</div>
          ) : configs.length === 0 && !isAdding ? (
            <div className="py-12 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl dark:text-slate-500 dark:border-slate-700">
              <Wifi className="mx-auto h-8 w-8 text-slate-300 mb-2 dark:text-slate-600" />
              Chưa có cấu hình WiFi nào. Nhấn "Thêm điểm WiFi mới" để tạo.
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border transition ${
                    cfg.is_active
                      ? "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
                      : "border-slate-100 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-800/60"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm dark:text-slate-100">{cfg.office_name}</span>
                      {cfg.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" /> Đang hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Tắt
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                      <span className="flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400">
                        <Wifi className="h-3 w-3" /> SSID: {cfg.wifi_ssid}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Ca làm: {cfg.work_start_time} - {cfg.work_end_time} (+{cfg.late_tolerance_minutes || 15}m)
                      </span>
                      {cfg.allowed_ips && cfg.allowed_ips.length > 0 && (
                        <span>IPs: {cfg.allowed_ips.join(", ")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => startEdit(cfg)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                      title="Chỉnh sửa"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cfg.id, cfg.office_name)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-red-400"
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
