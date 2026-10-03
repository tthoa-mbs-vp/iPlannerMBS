import { getFileUrl } from "../api/client";
import { TASK_STATUS_LABELS } from "./constants";
import { exportHtmlToPdf, type PdfInfoBlock, type PdfSummaryItem } from "./exportPdf";
import type { Comment, Task } from "@shared/types";

export interface TaskReportRow {
  name: string;
  plan: string;
  host_dept: string;
  executor: string;
  supervisor: string;
  collaborators: string;
  category: string;
  start_date: string;
  deadline: string;
  status: string;
  is_high_impact: string;
  file_count: number;
  rating: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  normal: "Thường xuyên",
  sudden: "Đột xuất",
  important: "Trọng điểm",
};

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

export function userName(u?: { name?: string; email?: string }): string {
  return u?.name || u?.email || "—";
}

export function buildTaskReportRow(task: Task): TaskReportRow {
  const collaborators = (task.expand?.collaborator_ids || [])
    .map((c) => c.name || c.email)
    .filter(Boolean)
    .join(", ");
  return {
    name: task.name,
    plan: task.expand?.plan_id?.name || "Nhiệm vụ độc lập",
    host_dept: task.expand?.host_dept_id?.name || "—",
    executor: userName(task.expand?.executor_id),
    supervisor: userName(task.expand?.supervisor_id),
    collaborators: collaborators || "—",
    category: CATEGORY_LABELS[task.category] || task.category,
    start_date: fmtDate(task.start_date),
    deadline: fmtDate(task.deadline),
    status: TASK_STATUS_LABELS[task.status] || task.status,
    is_high_impact: task.is_high_impact ? "Có" : "Không",
    file_count: 0,
    rating: task.rating ? String(task.rating) : "—",
  };
}

export interface TaskAttachment {
  taskId: string;
  taskName: string;
  commentId: string;
  filename: string;
  url: string;
}

export interface TaskReportPdfOptions {
  title: string;
  meta?: string;
  summary?: PdfSummaryItem[];
  filename: string;
  landscape?: boolean;
  includeSignature?: boolean;
  signatureRoles?: { label: string; name?: string }[];
}

function sanitizeFolderName(name: string): string {
  return (name || "Nhiệm vụ").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 60) || "Nhiệm vụ";
}

export function collectTaskAttachments(task: Task, comments: Comment[]): TaskAttachment[] {
  return comments
    .filter((c) => c.task_id === task.id)
    .flatMap((c) =>
      (c.files || []).map((fn) => ({
        taskId: task.id,
        taskName: task.name,
        commentId: c.id,
        filename: fn,
        url: getFileUrl("comments", c.id, fn),
      }))
    );
}

export function buildTaskInfoBlock(task: Task): PdfInfoBlock {
  const row = buildTaskReportRow(task);
  return {
    title: row.name,
    fields: [
      { label: "Kế hoạch", value: row.plan },
      { label: "Phòng chủ trì", value: row.host_dept },
      { label: "Người thực hiện", value: row.executor },
      { label: "Người giám sát", value: row.supervisor },
      { label: "Phối hợp", value: row.collaborators },
      { label: "Phân loại", value: row.category },
      { label: "Ngày bắt đầu", value: row.start_date },
      { label: "Hạn hoàn thành", value: row.deadline },
      { label: "Trạng thái", value: row.status },
      { label: "Trọng điểm", value: row.is_high_impact },
      { label: "Xếp loại", value: row.rating },
    ],
  };
}

export function buildDiscussionItems(comments: Comment[]): { author: string; time: string; content: string; files?: string[] }[] {
  return comments.map((c) => ({
    author: userName(c.expand?.user_id),
    time: new Date(c.created).toLocaleString("vi-VN"),
    content: c.content || "",
    files: c.files || [],
  }));
}

export function defaultSignatureRoles(task: Task): { label: string; name?: string }[] {
  return [
    { label: "Người giám sát", name: userName(task.expand?.supervisor_id) },
    { label: "Người thực hiện", name: userName(task.expand?.executor_id) },
  ];
}

export async function exportTaskReportPdf(
  tasks: Task[],
  comments: Comment[],
  opts: TaskReportPdfOptions
): Promise<void> {
  const infoBlocks = tasks.map((t) => buildTaskInfoBlock(t));
  const discussionItems = buildDiscussionItems(comments);
  const signatureRoles = opts.includeSignature === false
    ? []
    : (opts.signatureRoles && opts.signatureRoles.length ? opts.signatureRoles : defaultSignatureRoles(tasks[0]));

  await exportHtmlToPdf({
    title: opts.title,
    meta: opts.meta,
    summary: opts.summary,
    infoBlocks,
    discussionItems,
    signatureTitle: "KÝ XÁC NHẬN",
    signatureRoles,
    filename: opts.filename,
    landscape: opts.landscape,
  });
}

export async function exportAttachmentsZip(
  attachments: TaskAttachment[],
  filename: string
): Promise<void> {
  // JSZip ~100 KB: chỉ nạp khi thật sự đóng gói file, không kéo theo mỗi
  // lần mở trang chi tiết nhiệm vụ.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const att of attachments) {
    const folder = sanitizeFolderName(att.taskName);
    const displayName = att.filename.split("_").pop() || att.filename;
    try {
      const res = await fetch(att.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      zip.folder(folder)!.file(displayName, blob);
    } catch {
      // skip files that cannot be fetched
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string): string {
  return (name || "bao-cao").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 60) || "bao-cao";
}
