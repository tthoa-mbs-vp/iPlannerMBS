import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../api/client";
import { Settings, Clock, CheckCircle, AlertTriangle, Play } from "lucide-react";

interface AutoApproveConfig {
  enabled: boolean;
  delay_days: number;
}

interface AutoApproveRunResult {
  success: boolean;
  tasks_approved: number;
  extension_proposals_approved: number;
  cancellation_proposals_approved: number;
  delay_days: number;
  enabled: boolean;
}

export default function AutoApproveSettings() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [delayDays, setDelayDays] = useState(2);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRunResult, setShowRunResult] = useState<AutoApproveRunResult | null>(null);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["auto-approve-settings"],
    queryFn: async (): Promise<AutoApproveConfig> => {
      const res = await pb.send("/api/custom/auto-approve-settings", {
        method: "GET",
      });
      return res;
    },
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; delay_days: number }) => {
      return pb.send("/api/custom/auto-approve-settings", {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-approve-settings"] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  // Manual run mutation
  const runMutation = useMutation({
    mutationFn: async (): Promise<AutoApproveRunResult> => {
      return pb.send("/api/custom/auto-approve-run", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      setShowRunResult(data);
      setTimeout(() => setShowRunResult(null), 5000);
    },
  });

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setDelayDays(settings.delay_days);
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({ enabled, delay_days: delayDays });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Tự động phê duyệt
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cấu hình tự động xác nhận Hoàn thành, Gia hạn và Hủy nhiệm vụ
          </p>
        </div>
      </div>

      {/* Success message */}
      {showSuccess && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm text-emerald-700 dark:text-emerald-300">
            Đã lưu cài đặt thành công!
          </span>
        </div>
      )}

      {/* Manual run result */}
      {showRunResult && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Kết quả chạy tự động phê duyệt:
            </span>
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
            <p>• Nhiệm vụ hoàn thành: {showRunResult.tasks_approved}</p>
            <p>• Đề xuất gia hạn được duyệt: {showRunResult.extension_proposals_approved}</p>
            <p>• Đề xuất hủy được duyệt: {showRunResult.cancellation_proposals_approved}</p>
          </div>
        </div>
      )}

      {/* Main settings card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Kích hoạt tự động phê duyệt
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khi bật, các nhiệm vụ và đề xuất sẽ được tự động phê duyệt sau khoảng thời gian cấu hình
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled
                  ? "bg-indigo-600"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Delay days configuration */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Thời gian chờ trước khi phê duyệt
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-[200px]">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={delayDays}
                  onChange={(e) => setDelayDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 2)))}
                  className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  disabled={!enabled}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Clock className="h-4 w-4 text-slate-400" />
                </div>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">ngày</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mặc định: 2 ngày. Khoảng thời gian từ khi tạo đề xuất/đề nghị đến khi tự động phê duyệt.
            </p>
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Lưu ý quan trọng:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Nhiệm vụ ở trạng thái <strong>"Chờ phê duyệt"</strong> sẽ được chuyển sang <strong>"Hoàn thành"</strong></li>
                  <li>Đề xuất <strong>"Gia hạn"</strong> sẽ tự động duyệt và cập nhật hạn mới</li>
                  <li>Đề xuất <strong>"Hủy"</strong> sẽ tự động duyệt và hủy nhiệm vụ</li>
                  <li>Kiểm tra định kỳ chạy mỗi 30 phút</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with save button */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-4 w-4" />
            {runMutation.isPending ? "Đang chạy..." : "Chạy ngay"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Đang lưu...
              </>
            ) : (
              "Lưu cài đặt"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
