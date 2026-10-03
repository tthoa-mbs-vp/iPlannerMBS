import type { TaskStatus, PlanStatus, LeaveStatus, LeaveType, LeavePeriod, AttendanceStatus } from "@shared/types";

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

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm / BHXH",
  unpaid: "Nghỉ không lương",
  maternity: "Nghỉ thai sản",
  special: "Nghỉ việc riêng",
};

export const PERIOD_LABELS: Record<LeavePeriod, string> = {
  full: "Cả ngày",
  morning: "Sáng",
  afternoon: "Chiều",
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

// ─── Thang KPI 1–10 ──────────────────────────────────────────────────────────
// Nguồn duy nhất cho thang xếp loại. Trước đây mỗi component tự khai báo một
// bản `RATING_LABELS` 1–5 riêng (4 bản sao trong repo) nên dễ lệch nhau.
// `tasks.rating` được migration 1799100000_widen_task_rating_to_10.js mở
// rộng lên max 10 để khớp với công thức `_kpi-formula.cjs` (rating / 10.0).

export const RATING_MIN = 1;
export const RATING_MAX = 10;
/** Xếp loại mặc định khi mở hộp thoại đánh giá — tương đương "Khá". */
export const RATING_DEFAULT = 6;

export const RATING_LABELS: Record<number, string> = {
  1: "Rất kém",
  2: "Kém",
  3: "Dưới kỳ vọng",
  4: "Chưa đạt",
  5: "Trung bình",
  6: "Khá",
  7: "Tốt",
  8: "Rất tốt",
  9: "Xuất sắc",
  10: "Vượt trội",
};

/** Màu biểu đồ theo xếp loại 1–10, cùng thứ tự với RATING_LABELS. */
export const RATING_COLORS: readonly string[] = [
  "#dc2626", // 1  đỏ
  "#ea580c", // 2  cam đậm
  "#f59e0b", // 3  hổ phách
  "#eab308", // 4  vàng
  "#84cc16", // 5  lime
  "#22c55e", // 6  xanh lá
  "#10b981", // 7  emerald
  "#14b8a6", // 8  teal
  "#06b6d4", // 9  cyan
  "#3b82f6", // 10 xanh dương
];

/** Danh sách xếp loại 1–10, dùng cho vòng lặp render sao/nút. */
export const RATING_SCALE: readonly number[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => RATING_MIN + i,
);

/** Nhãn của một xếp loại, có fallback về chính số điểm. */
export function getRatingLabel(rating: number): string {
  return RATING_LABELS[Math.round(rating)] ?? String(rating);
}

/** Kẹp một giá trị về khoảng hợp lệ của thang 1–10. */
export function clampRating(rating: number): number {
  if (!Number.isFinite(rating)) return RATING_MIN;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(rating)));
}

/**
 * Quy điểm trung bình (final_score, thang 10) về xếp loại 1–10.
 * Trước thang 10, hàm này dùng ngưỡng `>=10 ? 5 : >=7 ? 4 : ...` nên mọi điểm
 * dưới 10 đều bị dồn về 1–4. Giờ quy đổi trực tiếp rồi kẹp trong 1–10.
 */
export function ratingFromAvgScore(avgScore: number): number {
  if (!Number.isFinite(avgScore) || avgScore <= 0) return RATING_MIN;
  return clampRating(avgScore);
}

export function getRatingBadgeStyle(rating: number): string {
  const r = clampRating(rating);
  if (r >= 8) return "bg-emerald-100 text-emerald-700";
  if (r >= 6) return "bg-blue-100 text-blue-700";
  if (r >= 4) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

