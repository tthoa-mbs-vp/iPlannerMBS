import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, FileSpreadsheet, FileText, Code, Loader2, Database, Archive, Play, RefreshCw, AlertTriangle } from "lucide-react";
import { exportCollection, EXPORT_COLLECTIONS, COLLECTION_FIELDS } from "../../services/dataService";
import { pb } from "../../api/client";
import { useToastStore } from "../../stores/toastStore";
const ImportModal = lazy(() => import("./ImportModal"));
import TabBar from "../shared/TabBar";

const FORMATS = [
  { value: "xlsx" as const, label: "Excel (.xlsx)", icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50" },
  { value: "csv" as const, label: "CSV (.csv)", icon: FileText, color: "text-blue-600 bg-blue-50" },
  { value: "json" as const, label: "JSON (.json)", icon: Code, color: "text-amber-600 bg-amber-50" },
];

export default function DataImportExport() {
  const addToast = useToastStore((s) => s.addToast);
  const [tab, setTab] = useState<"export" | "import" | "backup" | "archive">("export");
  const [selCollection, setSelCollection] = useState(EXPORT_COLLECTIONS[0].value);
  const [selFormat, setSelFormat] = useState<"xlsx" | "csv" | "json">("xlsx");
  const [exporting, setExporting] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);

  const [backingUp, setBackingUp] = useState(false);
  const [backupData, setBackupData] = useState<Record<string, any[]> | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [archiveRestoring, setArchiveRestoring] = useState(false);
  const [archiveRestoreResult, setArchiveRestoreResult] = useState<string | null>(null);

  const archiveStatsQuery = useQuery({
    queryKey: ["archive-stats"],
    queryFn: async () => {
      const res = await pb.send("/api/custom/archive-stats", { method: "GET" });
      return res;
    },
    enabled: tab === "archive",
  });
  const archivedListsQuery = useQuery({
    queryKey: ["archive-lists"],
    queryFn: async () => {
      const [plans, tasks] = await Promise.all([
        pb.collection("archived_plans").getFullList({ sort: "-archived_at", requestKey: "archived-plans" }),
        pb.collection("archived_tasks").getFullList({ sort: "-archived_at", requestKey: "archived-tasks" }),
      ]);
      return { plans, tasks };
    },
    enabled: tab === "archive",
  });

  const archiveStats = archiveStatsQuery.data ?? null;
  const loadingStats = archiveStatsQuery.isFetching;
  const archivedPlans = archivedListsQuery.data?.plans ?? [];
  const archivedTasks = archivedListsQuery.data?.tasks ?? [];
  const loadingArchiveList = archivedListsQuery.isFetching;

  const handleArchiveRestore = async () => {
    if (selectedPlanIds.size === 0 && selectedTaskIds.size === 0) return;
    const planCount = selectedPlanIds.size;
    const taskCount = selectedTaskIds.size;
    if (!window.confirm(`Khôi phục ${planCount} Kế hoạch và ${taskCount} Nhiệm vụ từ kho lưu trữ? Kế hoạch được khôi phục sẽ kèm theo toàn bộ nhiệm vụ đã lưu trữ của nó.`)) return;
    setArchiveRestoring(true);
    setArchiveRestoreResult(null);
    try {
      const res = await pb.send("/api/custom/restore-archive", {
        method: "POST",
        body: JSON.stringify({
          plan_ids: Array.from(selectedPlanIds),
          task_ids: Array.from(selectedTaskIds),
          restore_plan_tasks: true,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const r = res.result || {};
      const errMsg = (r.errors?.length ? ` Có ${r.errors.length} lỗi.` : "");
      setArchiveRestoreResult(`Khôi phục thành công: ${r.restored_plans || 0} Kế hoạch, ${r.restored_tasks || 0} nhiệm vụ, ${r.restored_comments || 0} bình luận.${errMsg}`);
      setSelectedPlanIds(new Set());
      setSelectedTaskIds(new Set());
      archiveStatsQuery.refetch();
      archivedListsQuery.refetch();
    } catch (err: unknown) {
      setArchiveRestoreResult(`Lỗi: ${err instanceof Error ? err.message : "Thao tác thất bại"}`);
    }
    setArchiveRestoring(false);
  };

  const togglePlan = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunArchive = async (dryRun: boolean) => {
    setArchiving(true);
    setArchiveResult(null);
    try {
      const res = await pb.send("/api/custom/archive-tasks", {
        method: "POST",
        body: JSON.stringify({ months: 6, dry_run: dryRun }),
        headers: { "Content-Type": "application/json" },
      });
      if (dryRun) {
        setArchiveResult(`Kiểm tra thử: Có ${res.result?.eligible_count || 0} nhiệm vụ và ${res.result?.eligible_plans_count || 0} Kế hoạch (>6 tháng) sẵn sàng lưu trữ.`);
      } else {
        setArchiveResult(`Lưu trữ thành công! Đã chuyển ${res.result?.archived_tasks || 0} nhiệm vụ, ${res.result?.archived_comments || 0} bình luận và ${res.result?.archived_plans || 0} Kế hoạch sang bảng lưu trữ.`);
        archiveStatsQuery.refetch();
      }
    } catch (err: unknown) {
      setArchiveResult(`Lỗi: ${err instanceof Error ? err.message : "Thao tác thất bại"}`);
    }
    setArchiving(false);
  };


  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCollection(selCollection, selFormat);
    } catch (e) { addToast("error", "Xuất dữ liệu thất bại"); console.error(e); }
    setExporting(false);
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const collections = Object.keys(COLLECTION_FIELDS);
      const results = await Promise.all(
        collections.map(async (name) => {
          const records = await pb.collection(name).getFullList({ sort: "-created", requestKey: `backup-${name}` });
          return [name, records] as const;
        }),
      );
      const data: Record<string, any[]> = {};
      for (const [name, records] of results) data[name] = records;
      setBackupData(data);
    } catch (e) { addToast("error", "Sao lưu thất bại"); console.error(e); }
    setBackingUp(false);
  };

  const handleDownloadBackup = () => {
    if (!backupData) return;
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mbs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    if (!window.confirm("Khôi phục dữ liệu sẽ tạo mới các bản ghi từ file backup. Tiếp tục?")) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const text = await restoreFile.text();
      const data = JSON.parse(text);
      let totalCreated = 0;
      for (const [collection, records] of Object.entries(data)) {
        if (!Array.isArray(records)) continue;
        for (const record of records) {
          const clean: Record<string, any> = { ...record };
          delete clean.id;
          delete clean.created;
          delete clean.updated;
          delete clean.collectionId;
          delete clean.collectionName;
          delete clean.expand;
          delete clean["@expand"];
          await pb.collection(collection).create(clean);
          totalCreated++;
        }
      }
      setRestoreResult(`Đã khôi phục ${totalCreated} bản ghi thành công`);
    } catch (err: unknown) {
      setRestoreResult(`Lỗi: ${err instanceof Error ? err.message : "Không thể khôi phục"}`);
    }
    setRestoring(false);
  };

  return (
    <div className="space-y-6">
        <TabBar
          tabs={[
            { key: "export", label: "Xuất dữ liệu", gradient: "from-blue-500 to-indigo-600" },
            { key: "import", label: "Nhập dữ liệu", gradient: "from-emerald-500 to-teal-600" },
            { key: "backup", label: "Sao lưu & Phục hồi", gradient: "from-amber-500 to-orange-600" },
            { key: "archive", label: "Lưu trữ & Tối ưu", gradient: "from-purple-500 to-violet-600" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as "export" | "import" | "backup" | "archive")}
          size="sm"
        />

      {tab === "export" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Xuất dữ liệu theo bảng</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Chọn bảng và định dạng để xuất dữ liệu</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Bảng dữ liệu</label>
              <select value={selCollection} onChange={(e) => setSelCollection(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {EXPORT_COLLECTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Định dạng</label>
              <div className="flex gap-1.5">
                {FORMATS.map((fmt) => {
                  const Icon = fmt.icon;
                  return (
                    <button key={fmt.value} onClick={() => setSelFormat(fmt.value)}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        selFormat === fmt.value
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}>
                      <Icon className="h-3.5 w-3.5" />
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? "Đang xuất..." : "Xuất file"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60 text-center">
          <Upload className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
          <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Nhập dữ liệu từ file</h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Hỗ trợ .csv và .json — tải file mẫu để biết cấu trúc</p>
          <button onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
            <Upload className="h-4 w-4" />
            Mở cửa sổ nhập
          </button>
          {showImportModal && <Suspense fallback={null}><ImportModal onClose={() => setShowImportModal(false)} /></Suspense>}
        </div>
      )}

      {tab === "backup" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <Database className="mb-2 h-6 w-6 text-teal-500" />
            <p className="mb-1 text-sm font-medium text-slate-800 dark:text-slate-100">Sao lưu toàn bộ</p>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Xuất tất cả bảng ra một file JSON</p>
            <div className="flex gap-2">
              <button onClick={handleBackup} disabled={backingUp}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors">
                <Download className="h-3.5 w-3.5" />
                {backingUp ? "Đang sao lưu..." : "Tạo bản sao lưu"}
              </button>
              {backupData && (
                <button onClick={handleDownloadBackup}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  Tải xuống
                </button>
              )}
            </div>
            {backupData && (
              <p className="mt-2 text-xs text-emerald-600">
                Đã sao lưu {Object.values(backupData).reduce((s, arr) => s + arr.length, 0)} bản ghi
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <Upload className="mb-2 h-6 w-6 text-indigo-500" />
            <p className="mb-1 text-sm font-medium text-slate-800 dark:text-slate-100">Khôi phục từ file</p>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Tải lên file JSON sao lưu để khôi phục</p>
            <div className="flex gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                {restoreFile ? restoreFile.name : "Chọn file"}
                <input type="file" accept=".json" className="hidden"
                  onChange={(e) => { setRestoreFile(e.target.files?.[0] || null); setRestoreResult(null); }} />
              </label>
              <button onClick={handleRestore} disabled={!restoreFile || restoring}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {restoring ? "Đang khôi phục..." : "Khôi phục"}
              </button>
            </div>
            {restoreResult && (
              <p className={`mt-2 text-xs ${restoreResult.startsWith("Lỗi") ? "text-red-600" : "text-emerald-600"}`}>
                {restoreResult}
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "archive" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-800 dark:bg-purple-950/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100">Lưu trữ Nhiệm vụ cũ (&gt; 6 tháng)</h3>
                </div>
                <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                  <strong>Ưu tiên hàng đầu:</strong> Kế hoạch và Nhiệm vụ đang trong Thùng rác được lưu trữ trước, không phụ thuộc trạng thái hay thời gian. Sau đó dọn dẹp các nhiệm vụ Hoàn thành (`completed`) hoặc Đã hủy (`cancelled`) cập nhật trước 6 tháng, chuyển sang kho `archived_tasks` và `archived_comments`. Khi toàn bộ nhiệm vụ của một Kế hoạch đã được lưu trữ, Kế hoạch đó cũng được chuyển sang `archived_plans` để giữ CSDL tinh gọn.
                </p>
              </div>
              <button onClick={() => archiveStatsQuery.refetch()} disabled={loadingStats}
                className="flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:bg-slate-900 dark:text-purple-300 dark:hover:bg-purple-950/40 disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? "animate-spin" : ""}`} /> Làm mới
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-slate-900">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Nhiệm vụ đủ điều kiện lưu trữ (&gt;6 tháng)</p>
                <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-300">
                  {loadingStats ? "..." : archiveStats?.eligible_count ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-white p-3 shadow-sm dark:border-purple-800 dark:bg-slate-900">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Kế hoạch đủ điều kiện lưu trữ</p>
                <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-300">
                  {loadingStats ? "..." : archiveStats?.eligible_plans_count ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-3 shadow-sm dark:bg-slate-900">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Nhiệm vụ đã lưu trữ (Kho)</p>
                <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {loadingStats ? "..." : archiveStats?.archived_tasks_count ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-3 shadow-sm dark:bg-slate-900">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Kế hoạch đã lưu trữ (Kho)</p>
                <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {loadingStats ? "..." : archiveStats?.archived_plans_count ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-3 shadow-sm dark:bg-slate-900">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Bình luận đã lưu trữ (Kho)</p>
                <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {loadingStats ? "..." : archiveStats?.archived_comments_count ?? 0}
                </p>
              </div>
            </div>

            {archiveStats?.warnings && archiveStats.warnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Cảnh báo bảo toàn Kế hoạch ({archiveStats.warnings.length} Kế hoạch bị tạm giữ lưu trữ):</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-amber-700 max-h-40 overflow-y-auto dark:text-amber-300">
                  {archiveStats.warnings.map((w: { plan_name: string; reason: string }, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="font-bold">•</span>
                      <span><strong>{w.plan_name}:</strong> {w.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 border-t border-purple-200/60 pt-4">
              <button onClick={() => handleRunArchive(true)} disabled={archiving}
                className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:bg-slate-900 dark:text-purple-300 dark:hover:bg-purple-950/40 disabled:opacity-50 transition-colors">
                <Play className="h-3.5 w-3.5" />
                Kiểm tra thử (Dry Run)
              </button>
              <button onClick={() => handleRunArchive(false)} disabled={archiving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
                {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                {archiving ? "Đang xử lý..." : "Thực hiện lưu trữ ngay"}
              </button>
            </div>

            {archiveResult && (
              <p className={`mt-3 text-xs font-medium ${archiveResult.startsWith("Lỗi") ? "text-rose-600" : "text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"}`}>
                {archiveResult}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-800 dark:bg-indigo-950/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Khôi phục từ kho lưu trữ</h3>
                </div>
                <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                  Chọn Kế hoạch / Nhiệm vụ đã lưu trữ để đưa trở lại bảng dữ liệu đang hoạt động. Khôi phục Kế hoạch sẽ kèm theo toàn bộ nhiệm vụ đã lưu trữ của Kế hoạch đó (cùng bình luận).
                </p>
              </div>
              <button onClick={() => archivedListsQuery.refetch()} disabled={loadingArchiveList}
                className="flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40 disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingArchiveList ? "animate-spin" : ""}`} /> Làm mới
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Kế hoạch đã lưu trữ ({archivedPlans.length})
                  </p>
                  <button onClick={() => {
                    if (selectedPlanIds.size === archivedPlans.length) setSelectedPlanIds(new Set());
                    else setSelectedPlanIds(new Set(archivedPlans.map((p) => p.id)));
                  }} className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                    {selectedPlanIds.size === archivedPlans.length && archivedPlans.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingArchiveList ? (
                    <p className="p-3 text-xs text-slate-400 dark:text-slate-500">Đang tải...</p>
                  ) : archivedPlans.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400 dark:text-slate-500">Chưa có dữ liệu.</p>
                  ) : (
                    archivedPlans.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-2 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/30">
                        <input type="checkbox" checked={selectedPlanIds.has(p.id)} onChange={() => togglePlan(p.id)} className="h-3.5 w-3.5 accent-indigo-600" />
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">{p.name}</span>
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{p.status}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Nhiệm vụ đã lưu trữ ({archivedTasks.length})
                  </p>
                  <button onClick={() => {
                    if (selectedTaskIds.size === archivedTasks.length) setSelectedTaskIds(new Set());
                    else setSelectedTaskIds(new Set(archivedTasks.map((t) => t.id)));
                  }} className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                    {selectedTaskIds.size === archivedTasks.length && archivedTasks.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingArchiveList ? (
                    <p className="p-3 text-xs text-slate-400 dark:text-slate-500">Đang tải...</p>
                  ) : archivedTasks.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400 dark:text-slate-500">Chưa có dữ liệu.</p>
                  ) : (
                    archivedTasks.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-2 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/30">
                        <input type="checkbox" checked={selectedTaskIds.has(t.id)} onChange={() => toggleTask(t.id)} className="h-3.5 w-3.5 accent-indigo-600" />
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">{t.name}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t.status}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-indigo-200/60 pt-4">
              <button onClick={handleArchiveRestore} disabled={archiveRestoring || (selectedPlanIds.size === 0 && selectedTaskIds.size === 0)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
                {archiveRestoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {archiveRestoring ? "Đang khôi phục..." : `Khôi phục đã chọn (${selectedPlanIds.size + selectedTaskIds.size})`}
              </button>
            </div>

            {archiveRestoreResult && (
              <p className={`mt-3 text-xs font-medium ${archiveRestoreResult.startsWith("Lỗi") ? "text-rose-600" : "text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"}`}>
                {archiveRestoreResult}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
