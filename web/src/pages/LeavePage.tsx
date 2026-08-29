import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useLeaveRequests, useLeaveBalance, useCreateLeaveRequest, useUpdateLeaveRequest, useUpdateLeaveStatus, useDeleteLeaveRequest } from "../hooks/useLeaveRequests";
import { Calendar, Plus, CheckCircle, XCircle, Clock, Pencil, Users, User as UserIcon, Trash2 } from "lucide-react";
import type { LeaveType, User, LeaveRequest, LeavePeriod, LeaveStatus } from "@shared/types";
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_STYLES } from "../utils/constants";
import { formatDate } from "../utils/format";
import LeaveInlineForm from "../components/leave/LeaveInlineForm";
import TabBar, { type Tab } from "../components/shared/TabBar";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import { SkeletonTable } from "../components/shared/Skeleton";

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm / BHXH",
  unpaid: "Nghỉ không lương",
  maternity: "Nghỉ thai sản",
  special: "Nghỉ việc riêng",
};

const PERIOD_LABELS: Record<LeavePeriod, string> = {
  full: "Cả ngày",
  morning: "Sáng",
  afternoon: "Chiều",
};

function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

function canApproveLeave(user: User | null, req: LeaveRequest): boolean {
  if (!user) return false;
  const role = user.expand?.role_id;
  if (!role) return false;
  if (role.can_manage) return true;
  if (!role.can_approve_leave) return false;
  if (role.approval_scope === "all") return true;
  if (role.approval_scope === "department") {
    return req.total_days < 3 && !!req.expand?.user_id?.department_id && req.expand.user_id.department_id === user.department_id;
  }
  return false;
}

export default function LeavePage() {
  const user = useAuthStore((s) => s.user);
  const [viewTab, setViewTab] = useState<"chung" | "personal">("personal");
  const { data: requests = [], isLoading, error: requestsError, refetch: refetchRequests } = useLeaveRequests(viewTab === "personal" ? "personal" : "all", user?.id);
  const { data: balance } = useLeaveBalance(user?.id);
  const createMutation = useCreateLeaveRequest();
  const updateMutation = useUpdateLeaveRequest();
  const updateStatusMutation = useUpdateLeaveStatus();
  const deleteMutation = useDeleteLeaveRequest();

  useEffect(() => { usePageTitleStore.getState().setTitle("Quản lý Nghỉ phép"); }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const switchTab = (tab: "chung" | "personal") => { setViewTab(tab); setShowForm(false); setEditingId(null); };
  const tabs: Tab[] = [
    { key: "chung", label: "Chung", icon: Users, gradient: "from-sky-500 to-cyan-600" },
    { key: "personal", label: "Cá nhân", icon: UserIcon, gradient: "from-violet-500 to-purple-600" },
  ];
  const visibleRequests = viewTab === "personal" ? requests.filter((r) => r.user_id === user?.id) : requests;
  const todayStr = new Date().toISOString().slice(0, 10);
  const onLeaveNow = requests.filter((r) => {
    if (r.status !== "approved") return false;
    return todayStr >= r.start_date.slice(0, 10) && todayStr <= r.end_date.slice(0, 10);
  });

  const handleCreate = async (data: { leave_type: LeaveType; start_date: string; end_date: string; total_days: number; reason: string; period: LeavePeriod }) => {
    await createMutation.mutateAsync({ ...data, user_id: user?.id });
    setShowForm(false);
  };

  const handleUpdate = async (data: { leave_type: LeaveType; start_date: string; end_date: string; total_days: number; reason: string; period: LeavePeriod }) => {
    if (!editingId) return;
    await updateMutation.mutateAsync({ id: editingId, ...data });
    setEditingId(null);
  };

  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, status: "approved", approver_id: user?.id });
  };

  const handleReject = (id: string) => {
    updateStatusMutation.mutate({ id, status: "rejected", approver_id: user?.id });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Xóa đơn xin nghỉ phép này?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Global tabs */}
      <TabBar
        variant="page"
        tabs={tabs}
        active={viewTab}
        onChange={(k) => switchTab(k as "chung" | "personal")}
        counts={{
          chung: requests.length,
          personal: requests.filter((r) => r.user_id === user?.id).length,
        }}
      />

      {viewTab === "personal" ? (
        /* Balance Card */
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-blue-200">Quỹ phép năm 2026</p>
              <h2 className="mt-1 text-2xl font-bold">{user?.name || user?.email}</h2>
            </div>
            <Calendar className="h-10 w-10 text-blue-200/50" />
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-blue-400/30 pt-4 text-center">
            <div>
              <p className="text-xs text-blue-200">Tổng quỹ phép</p>
              <p className="text-xl font-bold">{formatDays(balance?.total_days ?? 12)} ngày</p>
            </div>
            <div>
              <p className="text-xs text-blue-200">Đã sử dụng</p>
              <p className="text-xl font-bold text-amber-300">{formatDays(balance?.used_days ?? 0)} ngày</p>
            </div>
            <div>
              <p className="text-xs text-blue-200">Còn lại</p>
              <p className="text-xl font-bold text-emerald-300">{formatDays(balance?.remaining_days ?? 12)} ngày</p>
            </div>
          </div>
        </div>
      ) : (
        /* On leave now card */
        <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden dark:border-emerald-900/50 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Đang nghỉ phép hiện tại</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Ngày {formatDate(new Date().toISOString())}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              {onLeaveNow.length} người
            </span>
          </div>
          <div className="p-6">
            {onLeaveNow.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {onLeaveNow.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                      {(r.expand?.user_id?.name || r.expand?.user_id?.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.expand?.user_id?.name || r.expand?.user_id?.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(r.start_date)} - {formatDate(r.end_date)}
                        {r.period && r.period !== "full" && ` · ${PERIOD_LABELS[r.period]}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Không có ai đang nghỉ phép hôm nay</div>
            )}
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {viewTab === "personal" ? "Đơn xin nghỉ của tôi" : "Danh sách Đơn xin nghỉ phép"}
          </h2>
          {viewTab === "personal" && !showForm && !editingId && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition">
              <Plus className="h-4 w-4" />
              Đăng ký
            </button>
          )}
        </div>
        {showForm && (
          <div className="px-6 pt-4">
            <LeaveInlineForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              pending={createMutation.isPending}
            />
          </div>
        )}
        {isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : requestsError ? (
          <ErrorState message="Không thể tải danh sách đơn nghỉ phép" subMessage="Vui lòng thử lại sau" onRetry={() => refetchRequests()} />
        ) : visibleRequests.length === 0 ? (
          <EmptyState
            icon={Calendar}
            message={viewTab === "personal" ? "Bạn chưa có đơn xin nghỉ phép nào" : "Chưa có đơn xin nghỉ phép nào"}
            subMessage="Tạo đơn nghỉ phép bằng nút Đăng ký"
            size="sm"
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Người nộp</th>
                  <th className="px-6 py-3.5">Loại phép</th>
                  <th className="px-6 py-3.5">Thời gian</th>
                  <th className="px-6 py-3.5">Lý do</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visibleRequests.map((req) => (
                  editingId === req.id ? (
                    <tr key={req.id}>
                      <LeaveInlineForm
                        tableMode
                        requesterName={req.expand?.user_id?.name || req.expand?.user_id?.email || "Cá nhân"}
                        initialValues={{
                          leave_type: req.leave_type,
                          start_date: req.start_date,
                          end_date: req.end_date,
                          reason: req.reason,
                          period: req.period,
                        }}
                        onSubmit={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        pending={updateMutation.isPending}
                        title="Sửa đơn nghỉ phép"
                      />
                    </tr>
                  ) : (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-100">
                        {req.expand?.user_id?.name || req.expand?.user_id?.email || "Cá nhân"}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{LEAVE_TYPE_LABELS[req.leave_type] || req.leave_type}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div>
                          <div>{formatDate(req.start_date)}{req.period === "full" || !req.period ? ` - ${formatDate(req.end_date)}` : ""}</div>
                          {req.period && req.period !== "full" && (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                              {PERIOD_LABELS[req.period]} · {formatDays(req.total_days)} ngày
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate dark:text-slate-300">{req.reason}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${LEAVE_STATUS_STYLES[req.status as LeaveStatus]}`}>
                          {req.status === "approved" ? <CheckCircle className="h-3 w-3" /> : req.status === "rejected" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {LEAVE_STATUS_LABELS[req.status as LeaveStatus]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {req.status === "pending" && req.user_id === user?.id && (
                            <button onClick={() => setEditingId(req.id)} aria-label="Chỉnh sửa đơn" className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          {req.status === "pending" && req.user_id !== user?.id && canApproveLeave(user, req) && (
                            <>
                              <button onClick={() => handleApprove(req.id)}
                                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                                Duyệt
                              </button>
                              <button onClick={() => handleReject(req.id)}
                                className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700">
                                Từ chối
                              </button>
                            </>
                          )}
                          {req.status === "pending" && req.user_id === user?.id && (
                            <button onClick={() => handleDelete(req.id)} title="Xóa đơn"
                              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/40 dark:hover:text-rose-400">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
