import type { TaskStatus, PlanStatus, LeaveStatus, AttendanceStatus } from "@shared/types";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Chưa thực hiện",
  in_progress: "Đang làm",
  pending_approval: "Chờ duyệt",
  completed: "Hoàn thành",
  proposed_extension: "Đề xuất gia hạn",
  proposed_cancellation: "Đề xuất hủy",
  cancelled: "Đã hủy",
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  not_started: "bg-slate-100 text-slate-600 border border-slate-200/80",
  in_progress: "bg-gradient-to-r from-blue-50 to-indigo-100 text-blue-700 border border-blue-200/80",
  pending_approval: "bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-700 border border-amber-200/80",
  completed: "bg-gradient-to-r from-emerald-50 to-teal-100 text-emerald-700 border border-emerald-200/80",
  proposed_extension: "bg-gradient-to-r from-purple-50 to-violet-100 text-purple-700 border border-purple-200/80",
  proposed_cancellation: "bg-gradient-to-r from-rose-50 to-red-100 text-rose-700 border border-rose-200/80",
  cancelled: "bg-slate-100 text-slate-600 border border-slate-200/80",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: "from-slate-500 to-slate-600",
  in_progress: "from-blue-500 to-indigo-600",
  pending_approval: "from-amber-500 to-orange-600",
  completed: "from-emerald-500 to-teal-600",
  proposed_extension: "from-purple-500 to-violet-600",
  proposed_cancellation: "from-rose-500 to-red-600",
  cancelled: "from-slate-400 to-slate-500",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  not_started: "Chưa làm",
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
  cancelled: "Đã hủy",
};

export const TASK_STATUS_HEX: Record<TaskStatus, string> = {
  not_started: "#64748b",
  in_progress: "#6366f1",
  pending_approval: "#f59e0b",
  completed: "#10b981",
  proposed_extension: "#8b5cf6",
  proposed_cancellation: "#f97316",
  cancelled: "#94a3b8",
};

export const PLAN_STATUS_HEX: Record<PlanStatus, string> = {
  not_started: "#64748b",
  in_progress: "#6366f1",
  completed: "#10b981",
  paused: "#f59e0b",
  cancelled: "#ef4444",
};

export const PLAN_STATUS_STYLES: Record<PlanStatus, string> = {
  not_started: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border border-slate-300/60",
  in_progress: "bg-gradient-to-r from-blue-50 to-indigo-100 text-blue-700 border border-blue-200/80",
  completed: "bg-gradient-to-r from-emerald-50 to-teal-100 text-emerald-700 border border-emerald-200/80",
  paused: "bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-700 border border-amber-200/80",
  cancelled: "bg-gradient-to-r from-rose-50 to-red-100 text-rose-700 border border-rose-200/80",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const LEAVE_STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  on_time: "Đúng giờ",
  late: "Đi muộn",
  early_leave: "Về sớm",
  absent: "Vắng mặt",
};

export const ATTENDANCE_STATUS_STYLES: Record<AttendanceStatus, string> = {
  on_time: "bg-emerald-100 text-emerald-700",
  late: "bg-amber-100 text-amber-700",
  early_leave: "bg-blue-100 text-blue-700",
  absent: "bg-rose-100 text-rose-700",
};

export function getRatingBadgeStyle(rating: number): string {
  const r = Math.round(rating);
  if (r >= 4) return "bg-emerald-100 text-emerald-700";
  if (r >= 3) return "bg-blue-100 text-blue-700";
  if (r >= 2) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

