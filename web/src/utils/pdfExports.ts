import type { Plan, Task, TaskStatus, PlanStatus } from "@shared/types";
import { PLAN_STATUS_LABELS, TASK_STATUS_LABELS } from "./constants";
import { exportHtmlToPdf } from "./exportPdf";

function fmtPlanDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

function yesNo(v: boolean): string {
  return v ? "Có" : "Không";
}

export async function exportToPdfPlans(plans: Plan[], landscape = false) {
  const rows = plans.map((p) => [
    p.name,
    p.expand?.host_dept_id?.name || "",
    fmtPlanDate(p.start_date),
    fmtPlanDate(p.end_date),
    PLAN_STATUS_LABELS[p.status as PlanStatus] || p.status,
    `${p.progress}%`,
    yesNo(p.is_sudden),
    yesNo(p.is_high_impact),
  ]);
  await exportHtmlToPdf({
    title: "DANH SÁCH KẾ HOẠCH",
    meta: `Tổng số: ${rows.length}`,
    landscape,
    summary: [{ label: "Tổng kế hoạch", value: rows.length }],
    columns: [
      { label: "Tên kế hoạch" },
      { label: "Phòng chủ trì" },
      { label: "Ngày bắt đầu", align: "center" },
      { label: "Ngày kết thúc", align: "center" },
      { label: "Trạng thái", align: "center" },
      { label: "Tiến độ (%)", align: "center" },
      { label: "Đột xuất", align: "center" },
      { label: "Trọng điểm", align: "center" },
    ],
    rows,
    filename: "ke-hoach",
  });
}

export async function exportToPdfTasks(tasks: Task[], landscape = false) {
  const rows = tasks.map((t) => [
    t.name,
    t.expand?.plan_id?.name || "",
    t.expand?.executor_id?.name || "",
    t.category || "",
    fmtPlanDate(t.start_date),
    fmtPlanDate(t.deadline),
    TASK_STATUS_LABELS[t.status as TaskStatus] || t.status,
    yesNo(!!t.is_recurring),
    yesNo(!!t.is_ad_hoc),
    yesNo(!!t.is_high_impact),
    t.rating ?? "",
  ]);
  await exportHtmlToPdf({
    title: "DANH SÁCH NHIỆM VỤ",
    meta: `Tổng số: ${rows.length}`,
    landscape,
    summary: [{ label: "Tổng nhiệm vụ", value: rows.length }],
    columns: [
      { label: "Tên nhiệm vụ" },
      { label: "Kế hoạch" },
      { label: "Người thực hiện" },
      { label: "Phân loại" },
      { label: "Ngày bắt đầu", align: "center" },
      { label: "Hạn hoàn thành", align: "center" },
      { label: "Trạng thái", align: "center" },
      { label: "Lặp lại", align: "center" },
      { label: "Đột xuất", align: "center" },
      { label: "Trọng điểm", align: "center" },
      { label: "Xếp loại", align: "center" },
    ],
    rows,
    filename: "nhiem-vu",
  });
}
