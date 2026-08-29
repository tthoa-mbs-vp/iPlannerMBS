export function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

export function formatDateShort(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function formatDateLong(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
}

export function formatDateTime(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
}

export function formatDateTimeShort(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric", year: "numeric" });
}

export function formatTimeShort(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function formatMonthYear(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}

export function formatMonthYearShort(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" });
}

export function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDateTime(iso);
}

export function toInputDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function isTaskOverdue(task: { status: string; deadline: string }): boolean {
  if (task.status === "completed" || task.status === "cancelled") return false;
  const d = new Date(task.deadline);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}

export const contractTypes = [
  { value: "full_time", label: "Toàn thời gian" },
  { value: "part_time", label: "Bán thời gian" },
  { value: "probation", label: "Thử việc" },
  { value: "internship", label: "Thực tập" },
  { value: "contractor", label: "Hợp đồng dịch vụ" },
];

export function contractLabel(value?: string) {
  return contractTypes.find((c) => c.value === value)?.label || value || "—";
}
