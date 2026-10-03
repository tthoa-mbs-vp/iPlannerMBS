import { useEffect, useState, useMemo } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Info, MessageSquare, User, CalendarDays, Award, Users, Pencil, Trash2, FileText, Download, Clock, Activity, Paperclip, X, Check, AlertTriangle } from "lucide-react";
import { pb, getFileUrl } from "../api/client";
import { useTask, useUpdateTask, useSoftDeleteTask } from "../hooks/useTasks";
import { useComments, useCreateComment } from "../hooks/useComments";
import { useUsers } from "../hooks/useDepartments";
import { calculateKpi } from "../utils/kpi";
import { taskInUserGroups, userGroupIds } from "../utils/groupScope";
import ProposalSection from "../components/proposals/ProposalSection";
import CommentSection from "../components/tasks/CommentSection";
import TaskInlineForm from "../components/tasks/TaskInlineForm";
import Modal from "../components/shared/Modal";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_STATUS_COLORS,
  getRatingLabel,
  RATING_DEFAULT,
  RATING_MAX,
  RATING_MIN,
  RATING_SCALE,
} from "../utils/constants";
import { isTaskOverdue } from "../utils/format";
import { exportAttachmentsZip, exportTaskReportPdf, collectTaskAttachments, safeFilename } from "../utils/exportTaskReport";
import type { KpiScore, SystemLog, Task, TaskCategory, TaskStatus, User as UserType } from "@shared/types";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];

function Card({ icon: Icon, title, accent, children }: { icon: React.ComponentType<{ className?: string }>; title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col h-full">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 ${accent || "bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/60 dark:to-slate-800/30"}`}>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent ? "bg-white/90 shadow-sm dark:bg-white/10" : "bg-slate-200/60 dark:bg-slate-800"}`}>
          <Icon className={`h-4 w-4 ${accent ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400 dark:text-slate-500"}`} />
        </div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {children}
      </div>
    </div>
  );
}

function InfoCardBody({ task, users, canEdit, canDelete, onEdit, onDelete, onApprove, onComplete }: { task: Task; users?: UserType[]; canEdit?: boolean; canDelete?: boolean; onEdit: () => void; onDelete: () => void; onApprove?: () => void; onComplete?: () => void; }) {
  const user = useAuthStore((s) => s.user);
  const updateTask = useUpdateTask();
  const taskId = task.id;

  const handleTake = async () => {
    try {
      await updateTask.mutateAsync({ id: taskId, data: { status: "in_progress" } });
    } catch {
      // error toast handled by useMutationWithToast
    }
  };

  const handleComplete = () => {
    onComplete?.();
  };

  const handleApprove = () => {
    onApprove?.();
  };

  const handleReject = async () => {
    try {
      await updateTask.mutateAsync({ id: taskId, data: { status: "in_progress" } });
    } catch {
      // error toast handled by useMutationWithToast
    }
  };

  const isExecutor = user?.id === task.executor_id;
  const planLeaderId = task.expand?.plan_id?.leader_id;
  const isApprover = user?.id === task.supervisor_id || (planLeaderId && user?.id === planLeaderId);
  const progressPercent = task.status === "completed" ? 100 : task.status === "pending_approval" ? 75 : task.status === "in_progress" ? 50 : 0;
  const isOverdue = isTaskOverdue(task);

  const userName = (field: string) => {
    const expandVal = task.expand ? (task.expand as Record<string, unknown>)[field] : undefined;
    const taskVal = (task as unknown as Record<string, unknown>)[field];
    const u = (expandVal as { name?: string; email?: string } | undefined)
      || users?.find((x) => x.id === taskVal);
    return u?.name || u?.email || "—";
  };

  const collabNames = () => {
    const expanded = task.expand?.collaborator_ids;
    if (Array.isArray(expanded) && expanded.length) return expanded.filter(Boolean).map((u) => u.name || u.email).filter(Boolean).join(", ");
    const ids = task.collaborator_ids;
    if (Array.isArray(ids) && ids.length) return ids.map((cid) => { const u = users?.find((x) => x.id === cid); return u?.name || u?.email; }).filter(Boolean).join(", ");
    if (typeof ids === "string" && ids) { const u = users?.find((x) => x.id === ids); return u?.name || u?.email || "—"; }
    return "—";
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{task.name}</p>
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canEdit && (
                <button onClick={onEdit}
                  className="flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-500/40 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                  Sửa
                </button>
              )}
              {canDelete && (
                <button onClick={onDelete}
                  className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              )}
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{task.description || "—"}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"><User className="h-3 w-3" /> Người thực hiện</label>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{userName("executor_id")}</p>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"><User className="h-3 w-3" /> Người giám sát</label>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{userName("supervisor_id")}</p>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"><CalendarDays className="h-3 w-3" /> Ngày bắt đầu</label>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{new Date(task.start_date).toLocaleDateString("vi-VN")}</p>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"><CalendarDays className="h-3 w-3" /> Hạn chót</label>
          <p className={`text-sm font-medium ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}`}>
            {new Date(task.deadline).toLocaleDateString("vi-VN")}
            {isOverdue && <span className="ml-1 text-xs text-rose-500 dark:text-rose-400">(Quá hạn)</span>}
          </p>
        </div>
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"><Award className="h-3 w-3" /> Phân loại</label>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {task.is_ad_hoc && task.is_high_impact ? "Đột xuất + Quan trọng" : task.is_ad_hoc ? "Đột xuất" : task.is_high_impact ? "Quan trọng" : "Thường"}
          </p>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"><Users className="h-3 w-3" /> Người phối hợp</label>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{collabNames()}</p>
        </div>
      </div>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* Status & actions */}
      <div className="flex items-center justify-between">
        <span className={`inline-block rounded-full px-3.5 py-1 text-xs font-bold ${TASK_STATUS_STYLES[task.status as TaskStatus] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
          {TASK_STATUS_LABELS[task.status as TaskStatus] || task.status}
        </span>
        {task.status === "not_started" && isExecutor && (
          <button onClick={handleTake}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all">
            Nhận nhiệm vụ
          </button>
        )}
        {task.status === "in_progress" && (
          <button onClick={handleComplete}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all">
            Hoàn thành
          </button>
        )}
        {task.status === "pending_approval" && isApprover && (
          <div className="flex gap-1.5">
            <button onClick={handleApprove}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all">
              Phê duyệt
            </button>
            <button onClick={handleReject}
              className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-red-500/20 hover:from-red-600 hover:to-rose-700 active:scale-95 transition-all">
              Từ chối
            </button>
          </div>
        )}
        {task.status === "pending_approval" && !isApprover && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Đang chờ phê duyệt</span>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Tiến độ</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{progressPercent}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-full rounded-full bg-gradient-to-r ${TASK_STATUS_COLORS[task.status as TaskStatus] || "from-slate-400 to-slate-500"} transition-all duration-500`}
            style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

function KpiTab({ task, taskId }: { task?: Task; taskId: string }) {
  const { data: kpiScores } = useQuery({
    queryKey: ["kpi_score", taskId],
    queryFn: async () => {
      const records = await pb.collection("kpi_scores").getFullList<KpiScore>({
        filter: `task_id="${taskId}"`,
      });
      return records[0] || null;
    },
    enabled: !!taskId,
  });

  const r = kpiScores || (task ? calculateKpi(task) : null);
  const isStored = !!kpiScores;

  const scheduleLabel = (v: number) => v >= 100 ? "Đúng hạn" : v >= 80 ? "Trễ 1-3 ngày" : v >= 60 ? "Trễ 4-5 ngày" : v > 0 ? "Trễ >5 ngày" : "—";

  return (
    <div className="space-y-4">
      {r ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{isStored ? (r.final_score?.toFixed(1) || "—") : "—"}</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Điểm thực tế</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{r.base_score || "—"}</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Điểm cơ bản</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500">Hệ số khó</label>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{r.difficulty_coeff ? `${(r.difficulty_coeff * 100).toFixed(0)}%` : "—"}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500">Điểm tối đa</label>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{(r.max_converted_score ?? Math.round((r.base_score || 0) * (r.difficulty_coeff || 1) * 10) / 10).toFixed(1)}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500">Mức tiến độ</label>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200" title={isStored && r.progress_score != null ? scheduleLabel(r.progress_score) : "—"}>{isStored && r.progress_score != null ? r.progress_score : "—"}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500">Mức kết quả</label>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{isStored && r.result_rating ? getRatingLabel(r.result_rating) : "—"}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có điểm KPI</p>
      )}
    </div>
  );
}

function FilesTab({ task, taskId }: { task?: Task; taskId: string }) {
  const { data: comments, isLoading } = useComments(taskId);
  const [exporting, setExporting] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);

  const files = (comments || []).flatMap((c) =>
    (c.files || []).map((fn) => ({
      commentId: c.id,
      filename: fn,
      authorName: c.expand?.user_id?.name || c.expand?.user_id?.email || "—",
      createdAt: c.created,
    }))
  ).reverse();

  const handleExport = async () => {
    if (!task) return;
    setExporting(true);
    try {
      await exportTaskReportPdf([task], comments || [], {
        title: `BÁO CÁO NHIỆM VỤ: ${task.name}`,
        meta: task.expand?.plan_id?.name || "Nhiệm vụ độc lập",
        filename: safeFilename(task.name),
        includeSignature,
      });
      const attachments = collectTaskAttachments(task, comments || []);
      if (attachments.length > 0) {
        await exportAttachmentsZip(attachments, `${safeFilename(task.name)}-files`);
      }
    } catch {
      // error handled by toast-free silent failure; keep UI state safe
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải...</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
            {files.length} file đính kèm
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={includeSignature}
              onChange={(e) => setIncludeSignature(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-indigo-600" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Ký xác nhận</span>
          </label>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Đang xuất..." : "Xuất báo cáo + file"}
        </button>
      </div>
      {files.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400 dark:text-slate-500">
          <FileText className="mb-3 h-10 w-10" />
          <p className="text-sm">Chưa có file đính kèm</p>
        </div>
      ) : (
        <>
          {files.map((f) => {
            const url = getFileUrl("comments", f.commentId, f.filename);
            const ext = f.filename.split(".").pop()?.toLowerCase() || "";
            const isImage = IMAGE_EXTS.includes(ext);
            return (
              <a key={`${f.commentId}-${f.filename}`} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-all group">
                {isImage ? (
                  <img src={url + "?thumb=80x80"} alt=""
                    className="h-10 w-10 rounded-lg object-cover shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                    <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" title={f.filename}>
                    {f.filename.split("_").pop() || f.filename}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {f.authorName} · {new Date(f.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <Download className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
              </a>
            );
          })}
        </>
      )}
    </div>
  );
}

function LogTab({ taskId, taskName }: { taskId: string; taskName: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["system_logs", "task", taskId],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const escapedName = taskName.replace(/"/g, '\\"');
      return pb.collection("system_logs").getFullList<SystemLog>({
        sort: "-created",
        expand: "user_id",
        filter: `(target ~ "${taskId}") || (target ~ "${escapedName}")`,
      });
    },
    enabled: !!taskId,
    staleTime: 30_000,
    retry: 3,
  });

  if (isLoading) return <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải...</p>;

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-slate-400 dark:text-slate-500">
        <Activity className="mb-3 h-10 w-10" />
        <p className="text-sm">Chưa có nhật ký</p>
      </div>
    );
  }

  const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    "Tạo nhiệm vụ": FileText,
    "Sửa nhiệm vụ": Pencil,
    "Xóa nhiệm vụ (soft)": Trash2,
  };

  return (
    <div className="space-y-0">
      {logs.map((log, idx) => {
        const Icon = actionIcons[log.action] || Activity;
        const isLast = idx === logs.length - 1;
        return (
          <div key={log.id} className="relative flex gap-3 pb-4">
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
            )}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              log.action.includes("Tạo") ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" :
              log.action.includes("Sửa") ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" :
              log.action.includes("Xóa") ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" :
              "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500"
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{log.action}</p>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  {new Date(log.created).toLocaleString("vi-VN")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{log.target}</p>
              {log.expand?.user_id && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  <Clock className="inline h-3 w-3 mr-0.5" />
                  {log.expand.user_id.name || log.expand.user_id.email}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TaskDetailPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: task, isLoading, error: taskError } = useTask(taskId || "");
  const { data: users } = useUsers();
  const deleteTask = useSoftDeleteTask();
  const updateTask = useUpdateTask();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leftTab, setLeftTab] = usePersistedState<"info" | "files" | "log" | "kpi">(`task_tab_${taskId || "new"}`, "info");
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(RATING_DEFAULT);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeContent, setCompleteContent] = useState("");
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);
  const createComment = useCreateComment();

  const handleCompleteWithEvidence = async () => {
    if (!taskId || !task || !user) return;
    setShowCompleteDialog(false);
    try {
      if (completeContent.trim() || completeFiles.length > 0) {
        await createComment.mutateAsync({
          data: { task_id: taskId, user_id: user.id, content: completeContent.trim() || "[Hoàn thành nhiệm vụ]" },
          files: completeFiles.length > 0 ? completeFiles : undefined,
          taskId,
        });
      }
      await updateTask.mutateAsync({ id: taskId, data: { status: "pending_approval" } });
      setCompleteContent("");
      setCompleteFiles([]);
    } catch {
      // error toast handled by useMutationWithToast
    }
  };

  const confirmApprove = async () => {
    if (!taskId || !task || !user) return;
    const now = new Date().toISOString();
    setShowRating(false);
    try {
      await updateTask.mutateAsync({
        id: taskId,
        data: { status: "completed", completed_at: now, rating: selectedRating, rated_by_id: user!.id, rated_at: now },
      });
    } catch {
      // error toast handled by useMutationWithToast
    }
  };

  const canEdit = user?.expand?.role_id?.can_edit_tasks;
  const canDelete = user?.expand?.role_id?.can_delete_tasks;
  const canManage = user?.expand?.role_id?.can_manage;
  const viewScope = user?.expand?.role_id?.view_scope;
  const userDeptId = user?.expand?.department_id?.id;
  const myGroupIds = userGroupIds(user);

  const canViewTask = useMemo(() => {
    if (!task || !user) return true;
    if (viewScope === "all") return true;
    if (viewScope === "personal") return task.executor_id === user.id || task.supervisor_id === user.id || (task.collaborator_ids || []).includes(user.id) || task.expand?.plan_id?.leader_id === user.id;
    if (viewScope === "group") return taskInUserGroups(task, myGroupIds);
    if (viewScope === "department") {
      if (!userDeptId) return false;
      const plan = task.expand?.plan_id;
      return task.host_dept_id === userDeptId || (plan?.partner_dept_ids || []).includes(userDeptId);
    }
    return true;
  }, [task, user, viewScope, userDeptId, myGroupIds]);

  const eligibleUsers = useMemo(() => {
    if (!task || !users) return [];
    const deptIds = new Set<string>();
    if (task.host_dept_id) deptIds.add(task.host_dept_id);
    const plan = task.expand?.plan_id;
    if (plan?.host_dept_id) deptIds.add(plan.host_dept_id);
    if (plan?.partner_dept_ids) {
      (Array.isArray(plan.partner_dept_ids) ? plan.partner_dept_ids : [plan.partner_dept_ids]).forEach((id: string) => deptIds.add(id));
    }
    return users.filter((u) =>
      u.department_id && deptIds.has(u.department_id) && u.expand?.role_id?.level !== "leadership"
    );
  }, [task, users]);

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await deleteTask.mutateAsync(taskId);
      navigate("/tasks");
    } catch {
      // error toast handled by useMutationWithToast
    }
  };

  useEffect(() => {
    if (task) {
      usePageTitleStore.getState().setConfig({
        title: task.name,
        backTo: () => navigate(-1),
        badge: { label: TASK_STATUS_LABELS[task.status], className: TASK_STATUS_STYLES[task.status] },
      });
    }
    return () => { usePageTitleStore.getState().clear(); };
  }, [task, navigate]);

  return (
    <div className="flex h-full flex-col gap-5">
      {taskError ? (
        <div className="flex flex-col items-center py-12 text-red-500">
          <p className="text-sm font-medium">Không thể tải nhiệm vụ</p>
          <p className="mt-1 text-xs text-red-400">{taskError?.message || "Vui lòng thử lại"}</p>
        </div>
      ) : isLoading || !task ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        </div>
      ) : !canViewTask ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
          <AlertTriangle className="mb-3 h-10 w-10" />
          <p className="text-sm font-medium">Bạn không có quyền xem nhiệm vụ này.</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-5 min-h-0">
          {/* Left: Info card with internal tabs */}
          <div className="w-1/2 min-w-0">
            <Card icon={Info} title="Thông tin" accent="bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/40">
              <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 p-1 mb-4">
                {(canManage
                  ? ["info" as const, "files" as const, "log" as const, "kpi" as const]
                  : ["info" as const, "files" as const, "kpi" as const]
                ).map((tab) => {
                  const tabColor = tab === "info" ? "from-blue-500 to-indigo-600" : tab === "files" ? "from-amber-500 to-orange-600" : tab === "log" ? "from-rose-500 to-pink-600" : "from-emerald-500 to-teal-600";
                  return (
                    <button key={tab} onClick={() => setLeftTab(tab)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                        leftTab === tab
                          ? `bg-gradient-to-r ${tabColor} text-white shadow-lg`
                          : "text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200"
                      }`}>
                      {tab === "info" ? "Chi tiết" : tab === "files" ? "File liên quan" : tab === "log" ? "Nhật ký" : "Điểm KPI"}
                    </button>
                  );
                })}
              </div>
              {(leftTab === "log" && !canManage ? "info" : leftTab) === "info" ? (
                <div className="space-y-4">
                  {showEditForm ? (
                    <TaskInlineForm
                      initialValues={{
                        name: task.name,
                        description: task.description,
                        category: task.category,
                        is_ad_hoc: task.is_ad_hoc,
                        is_high_impact: task.is_high_impact,
                        executor_id: task.executor_id,
                        supervisor_id: task.supervisor_id,
                        collaborator_ids: Array.isArray(task.collaborator_ids) ? task.collaborator_ids : [],
                        start_date: task.start_date,
                        deadline: task.deadline,
                        is_recurring: task.is_recurring,
                      }}
                      onSubmit={async (data) => {
                        const formData = {
                          name: data.name,
                          description: data.description,
                          category: data.category as TaskCategory,
                          is_ad_hoc: data.is_ad_hoc,
                          is_high_impact: data.is_high_impact,
                          executor_id: data.executor_id,
                          supervisor_id: data.supervisor_id || undefined,
                          start_date: data.start_date,
                          deadline: data.deadline,
                          is_recurring: data.is_recurring,
                          collaborator_ids: data.collaborator_ids.length > 0 ? data.collaborator_ids : [],
                        };
                        await updateTask.mutateAsync({ id: task.id, data: formData });
                        setShowEditForm(false);
                      }}
                      onCancel={() => setShowEditForm(false)}
                      pending={updateTask.isPending}
                      eligibleUsers={eligibleUsers}
                      accentColor="indigo"
                      size="md"
                      showRecurring
                      title="Lưu thay đổi"
                      planId={task.plan_id}
                      planName={task.expand?.plan_id?.name}
                    />
                  ) : (
                  <>
                    <InfoCardBody task={task} users={users}
                      canEdit={canEdit} canDelete={canDelete}
                      onEdit={() => setShowEditForm(true)}
                      onDelete={() => setShowDeleteConfirm(true)}
                      onApprove={() => { setSelectedRating(3); setShowRating(true); }}
                      onComplete={() => setShowCompleteDialog(true)} />
                    <hr className="border-slate-100 dark:border-slate-800" />
                    <ProposalSection
                      taskId={taskId || ""}
                      taskName={task?.name}
                      executorId={task?.executor_id}
                      supervisorId={task?.supervisor_id}
                    />
                  </>
                  )}
                </div>
              ) : leftTab === "files" ? (
                <FilesTab task={task} taskId={taskId || ""} />
              ) : leftTab === "log" ? (
                <LogTab taskId={taskId || ""} taskName={task?.name || ""} />
              ) : (
                <KpiTab task={task} taskId={taskId || ""} />
              )}
            </Card>
          </div>

          {/* Right: Báo cáo & thảo luận */}
          <div className="w-1/2 min-w-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow-sm dark:bg-white/10">
                <MessageSquare className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Báo cáo & thảo luận</h3>
            </div>
            <div className="flex-1 min-h-0">
              <CommentSection
                taskId={taskId || ""}
                taskStatus={task?.status}
              />
            </div>
          </div>
        </div>
      )}

      {showRating && (
        <Modal title="Đánh giá kết quả" onClose={() => setShowRating(false)} maxWidth="sm" accentColor="amber">
          <div className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Chọn xếp loại cho nhiệm vụ này</p>
            <div className="mt-4 grid grid-cols-10 gap-1">
              {RATING_SCALE.map((value) => (
                <button key={value} onClick={() => setSelectedRating(value)}
                  aria-pressed={selectedRating === value}
                  title={getRatingLabel(value)}
                  className={`h-9 rounded-lg text-sm font-bold transition-all ${
                    selectedRating === value
                      ? "bg-amber-400 text-white shadow-md"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-amber-100 dark:hover:bg-slate-700"
                  }`}>
                  {value}
                </button>
              ))}
            </div>
            <div className="mt-3 text-center">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{getRatingLabel(selectedRating)}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Thang {RATING_MIN}–{RATING_MAX} · mặc định {RATING_DEFAULT}/10</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowRating(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Hủy</button>
              <button onClick={confirmApprove}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
                Xác nhận
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCompleteDialog && (
        <Modal title="Hoàn thành nhiệm vụ" onClose={() => setShowCompleteDialog(false)} accentColor="emerald">
          <div className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Nhập nội dung báo cáo hoặc đính kèm file kết quả minh chứng</p>
            <textarea value={completeContent} onChange={(e) => setCompleteContent(e.target.value)}
              placeholder="Nhập nội dung báo cáo..."
              className="mt-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 min-h-[100px] resize-none" />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => document.getElementById("complete-file-input")?.click()}
                className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Paperclip className="h-3.5 w-3.5" /> Đính kèm file
              </button>
              <input id="complete-file-input" type="file" multiple className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={(e) => {
                  if (e.target.files) setCompleteFiles([...completeFiles, ...Array.from(e.target.files)]);
                  e.target.value = "";
                }} />
              {completeFiles.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{completeFiles.length} file đã chọn</span>
              )}
            </div>
            {completeFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {completeFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                    {f.name}
                    <button onClick={() => setCompleteFiles(completeFiles.filter((_, j) => j !== i))}
                      className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowCompleteDialog(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Hủy</button>
              <button onClick={handleCompleteWithEvidence}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
                <Check className="h-4 w-4" /> Gửi & Hoàn thành
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal title="Xác nhận xoá" onClose={() => setShowDeleteConfirm(false)} maxWidth="sm" accentColor="rose">
          <div className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Bạn có chắc chắn muốn xoá nhiệm vụ này?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Hủy</button>
              <button onClick={handleDelete} disabled={deleteTask.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteTask.isPending ? "Đang xoá..." : "Xóa"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
