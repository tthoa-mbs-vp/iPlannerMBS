import { useState } from "react";
import { useProposalsByTask, useCreateProposal, useUpdateProposal, useWithdrawProposal } from "../../hooks/useProposals";
import { useUpdateTask } from "../../hooks/useTasks";
import { useAuthStore } from "../../stores/authStore";
import { useToastStore } from "../../stores/toastStore";
import DateField from "../shared/DateField";
import { formatDate } from "../../utils/format";
import type { Proposal } from "@shared/types";

interface Props {
  taskId: string;
  taskName?: string;
  executorId?: string;
  supervisorId?: string;
}

export default function ProposalSection({ taskId, supervisorId }: Props) {
  const { data: proposals } = useProposalsByTask(taskId);
  const user = useAuthStore((s) => s.user);
  const canManage = user?.expand?.role_id?.can_manage;
  const addToast = useToastStore((s) => s.addToast);
  const updateTask = useUpdateTask();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const withdrawProposal = useWithdrawProposal();
  const [showForm, setShowForm] = useState<"extension" | "cancellation" | null>(null);
  const [reason, setReason] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  const handlePropose = async (type: "extension" | "cancellation") => {
    if (!reason) return;
    try {
      await createProposal.mutateAsync({
        task_id: taskId,
        type,
        reason,
        new_deadline: type === "extension" ? new Date(newDeadline).toISOString() : undefined,
        status: "pending",
        requester_id: user?.id,
        approver_id: "",
      } as Partial<Proposal>);
      setShowForm(null);
      setReason("");
      setNewDeadline("");
    } catch (e) { addToast("error", "Không thể gửi đề xuất"); console.error(e); }
  };

  const handleApprove = async (proposal: Proposal) => {
    try {
      await updateProposal.mutateAsync({ id: proposal.id, data: { status: "approved" } });
      if (proposal.type === "extension") {
        await updateTask.mutateAsync({ id: taskId, data: { deadline: proposal.new_deadline, status: "in_progress" } });
      } else {
        await updateTask.mutateAsync({ id: taskId, data: { status: "cancelled" } });
      }
    } catch (e) { addToast("error", "Không thể duyệt đề xuất"); console.error(e); }
  };

  const handleReject = async (proposal: Proposal) => {
    try {
      await updateProposal.mutateAsync({ id: proposal.id, data: { status: "rejected" } });
      await updateTask.mutateAsync({ id: taskId, data: { status: "in_progress" } });
    } catch (e) { addToast("error", "Không thể từ chối đề xuất"); console.error(e); }
  };

  const pendingProposals = proposals?.filter((p) => p.status === "pending") || [];
  const resolvedProposals = proposals?.filter((p) => p.status !== "pending") || [];
  const canApprove = canManage || (!!user && supervisorId === user.id);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400 dark:text-slate-500">Đề xuất</label>
        {!showForm && (
          <div className="flex gap-1.5">
            <button onClick={() => setShowForm("extension")}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors dark:border-blue-900/40 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/40">
              Gia hạn
            </button>
            <button onClick={() => setShowForm("cancellation")}
              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100 transition-colors dark:border-rose-900/40 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-800/40">
              Hủy bỏ
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {showForm === "extension" ? "Đề xuất gia hạn" : "Đề xuất hủy bỏ"}
          </p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do..." rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
          {showForm === "extension" && (
            <DateField value={newDeadline} onChange={setNewDeadline} />
          )}
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setShowForm(null)}
              className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 transition-colors dark:text-slate-300 dark:hover:bg-slate-700">Hủy</button>
            <button onClick={() => handlePropose(showForm)} disabled={!reason || (showForm === "extension" && !newDeadline)}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">Gửi</button>
          </div>
        </div>
      )}

      {pendingProposals.map((p) => (
        <div key={p.id} className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/40">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {p.type === "extension" ? "Gia hạn" : "Hủy bỏ"} — Chờ duyệt
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">{p.reason}</p>
          {p.new_deadline && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
              Hạn mới: {formatDate(p.new_deadline)}
            </p>
          )}
          <div className="mt-2 flex gap-1.5">
            {canApprove && (
              <>
                <button onClick={() => handleApprove(p)}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition-colors">Duyệt</button>
                <button onClick={() => handleReject(p)}
                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 transition-colors">Từ chối</button>
              </>
            )}
            {p.requester_id === user?.id && (
              <button onClick={() => withdrawProposal.mutate(p.id)} disabled={withdrawProposal.isPending}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">Rút lại</button>
            )}
          </div>
        </div>
      ))}

      {resolvedProposals.map((p) => (
        <div key={p.id} className="mb-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${p.status === "approved" ? "text-emerald-600 dark:text-emerald-300" : "text-red-500 dark:text-red-400"}`}>
              {p.type === "extension" ? "Gia hạn" : "Hủy bỏ"} — {p.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{p.reason}</p>
        </div>
      ))}

      {(!proposals || proposals.length === 0) && !showForm && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Chưa có đề xuất nào</p>
      )}
    </div>
  );
}
