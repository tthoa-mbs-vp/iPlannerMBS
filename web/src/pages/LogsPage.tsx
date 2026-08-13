import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useSystemLogs } from "../hooks/useSystemLogs";
import { formatDateTime } from "../utils/format";
import Spinner from "../components/shared/Spinner";
import ErrorState from "../components/shared/ErrorState";
import EmptyState from "../components/shared/EmptyState";

export default function LogsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const isAdmin = role?.can_manage;
  const [page, setPage] = useState(1);
  const { data: logData, isLoading, error: logsError } = useSystemLogs(page);

  useEffect(() => {
    usePageTitleStore.getState().setConfig({ title: "Nhật ký hệ thống", backTo: "/admin" });
    return () => { usePageTitleStore.getState().clear(); };
  }, []);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  if (logsError) return <ErrorState message="Không thể tải nhật ký" />;
  if (isLoading) return <Spinner color="border-rose-500" />;

  return (
    <div className="flex h-full flex-col gap-5">
      {logData && logData.items.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">{logData.totalItems} bản ghi</span>
          </div>
          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="overflow-x-auto overflow-y-auto h-full">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-rose-50 to-pink-50 sticky top-0 dark:from-rose-950/50 dark:to-pink-950/50">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase dark:text-slate-300">Thời gian</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase dark:text-slate-300">Người dùng</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase dark:text-slate-300">Hành động</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase dark:text-slate-300">Mục tiêu</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase dark:text-slate-300">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logData.items.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 even:bg-slate-50 hover:bg-rose-50/30 text-sm dark:border-slate-800 dark:even:bg-slate-800/40 dark:hover:bg-rose-950/20">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(log.created)}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium dark:text-slate-100">{log.expand?.user_id?.name || log.expand?.user_id?.email || log.user_id}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.target}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">{log.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {logData.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Trang {page} / {logData.totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Trước
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= logData.totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={Activity} message="Chưa có nhật ký nào" />
      )}
    </div>
  );
}
