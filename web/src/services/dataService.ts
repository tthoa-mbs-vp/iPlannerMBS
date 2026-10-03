import { pb } from "../api/client";

/** PocketBase record — untyped API response. */
type PBRecord = Record<string, unknown>;

const COLLECTION_FIELDS: Record<string, string[]> = {
  departments: ["id", "code", "name", "is_counted", "leader_id", "created", "updated"],
  roles: ["id", "name", "description", "code", "level", "view_scope", "can_add_plans", "can_edit_plans", "can_delete_plans", "can_add_tasks", "can_edit_tasks", "can_delete_tasks", "can_manage", "can_approve_leave", "approval_scope", "can_view_salary", "created", "updated"],
  users: ["id", "email", "name", "avatar", "role_id", "department_id", "group_ids", "reminder_days", "disabled", "verified", "created", "updated"],
  plans: ["id", "name", "description", "leader_id", "host_dept_id", "partner_dept_ids", "group_id", "start_date", "end_date", "status", "is_sudden", "is_high_impact", "is_deleted", "progress", "created", "updated"],
  tasks: ["id", "name", "description", "plan_id", "category", "host_dept_id", "executor_id", "supervisor_id", "collaborator_ids", "status", "start_date", "deadline", "is_recurring", "recurring_type", "recurring_value", "is_deleted", "is_ad_hoc", "is_high_impact", "coordinating_dept_id", "completed_at", "rating", "rated_by_id", "rated_at", "created", "updated"],
  proposals: ["id", "task_id", "type", "reason", "status", "requester_id", "approver_id", "new_deadline", "created", "updated"],
  comments: ["id", "task_id", "user_id", "content", "files", "quote_id", "created", "updated"],
  kpi_scores: ["id", "task_id", "base_score", "difficulty_coeff", "progress_score", "result_rating", "final_score", "max_converted_score", "created", "updated"],
  professional_groups: ["id", "code", "name", "description", "department_id", "created", "updated"],
  archived_tasks: ["id", "original_id", "name", "description", "plan_id", "executor_id", "supervisor_id", "approver_id", "status", "priority", "start_date", "due_date", "completion_date", "progress", "archived_at", "created"],
  archived_plans: ["id", "original_id", "name", "description", "leader_id", "host_dept_id", "partner_dept_ids", "group_id", "start_date", "end_date", "status", "is_sudden", "is_high_impact", "progress", "archived_at", "created"],
};

// C9: credentials are only accepted on user import (admin-only path), never exposed in export/template.
const IMPORT_ONLY_FIELDS: Record<string, string[]> = {
  users: ["password", "passwordConfirm"],
};

const COLLECTION_LABELS: Record<string, string> = {
  departments: "Phòng ban",
  roles: "Chức vụ",
  users: "Người dùng",
  plans: "Kế hoạch",
  tasks: "Nhiệm vụ",
  proposals: "Đề xuất",
  comments: "Bình luận",
  kpi_scores: "Điểm KPI",
  professional_groups: "Tổ chuyên môn",
  archived_tasks: "Nhiệm vụ đã lưu trữ",
  archived_plans: "Kế hoạch đã lưu trữ",
};

const COLLECTION_PASTE_HINTS: Record<string, string[]> = {
  departments: ["Mã phòng", "Tên phòng", "Tính báo cáo"],
  roles: ["Mã chức vụ", "Tên chức vụ", "Cấp bậc", "Phạm vi xem", "Quản trị"],
  users: ["Email", "Mật khẩu", "Họ tên", "Mã phòng ban", "Mã chức vụ", "Nhắc hạn (ngày)"],
  plans: ["Tên kế hoạch", "Mô tả", "Ngày bắt đầu", "Ngày kết thúc", "Trạng thái", "Tiến độ (%)"],
  tasks: ["Tên nhiệm vụ", "Mô tả", "Phân loại", "Ngày bắt đầu", "Hạn hoàn thành", "Trạng thái"],
  proposals: ["Lý do", "Hạn mới"],
  comments: ["Nội dung"],
  kpi_scores: ["Điểm cơ bản", "Hệ số khó"],
  professional_groups: ["Mã tổ", "Tên tổ", "Mô tả", "Mã phòng cha"],
};

export const EXPORT_COLLECTIONS = Object.keys(COLLECTION_FIELDS).map((key) => ({
  value: key,
  label: COLLECTION_LABELS[key],
}));

function flattenRecord(record: PBRecord): PBRecord {
  const flat: PBRecord = {};
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (key === "expand" || key === "@expand") continue;
    if (key === "collectionId" || key === "collectionName") continue;
    if (Array.isArray(val)) {
      flat[key] = val.join(", ");
    } else if (val && typeof val === "object" && "id" in val) {
      flat[key] = String((val as { id: unknown }).id);
    } else {
      flat[key] = val ?? "";
    }
  }
  return flat;
}

export async function exportCollection(
  collectionName: string,
  format: "xlsx" | "csv" | "json",
): Promise<void> {
  const records = await pb.collection(collectionName).getFullList({
    sort: "-created",
    requestKey: `export-${collectionName}`,
  });
  const data = records.map(flattenRecord);
  const fields = COLLECTION_FIELDS[collectionName] || Object.keys(data[0] || {});
  const filename = `${collectionName}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "json") {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${filename}.json`);
    return;
  }

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data, { header: fields });
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${filename}.csv`);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, collectionName);
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, `${filename}.xlsx`);
  }
}

function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/javascript:/gi, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  collection: string;
  total: number;
  success: number;
  errors: { row: number; message: string }[];
}

function parseFieldErrors(err: unknown): string {
  const e = err as { data?: Record<string, { message?: string } | unknown>; message?: string } | null;
  if (e?.data && typeof e.data === "object") {
    const fieldErrors: string[] = [];
    for (const [field, info] of Object.entries(e.data)) {
      const msg = (info && typeof info === "object" && "message" in info) ? String((info as { message?: string }).message || "") : "";
      const label = FIELD_TO_LABEL[field] || field;
      if (msg) fieldErrors.push(`[${label}] ${msg}`);
    }
    if (fieldErrors.length > 0) return fieldErrors.join("; ");
  }
  return e?.message || "Lỗi không xác định";
}

function sanitizeRow(
  row: PBRecord,
  allowedFields: string[],
  collectionName?: string,
): { clean: PBRecord } | { error: string } {
  const clean: PBRecord = {};
  for (let key of Object.keys(row)) {
    const originalKey = key;
    if (!allowedFields.includes(key)) {
      const mapped = (collectionName && COLLECTION_LABEL_TO_FIELD[collectionName]?.[key]) || LABEL_TO_FIELD[key];
      if (mapped && allowedFields.includes(mapped)) key = mapped;
      else continue;
    }
    if (key === "id" || key === "created" || key === "updated") continue;
    let val = row[originalKey];
    if (typeof val === "string" && val.includes(", ") && allowedFields.includes(key) && key.endsWith("_ids")) {
      val = val.split(", ").filter(Boolean);
    }
    if (key === "collaborator_ids" && typeof val === "string") {
      val = [val];
    }
    if (typeof val === "string") {
      val = sanitizeString(val);
    }
    clean[key] = val;
  }
  if (Object.keys(clean).length === 0) {
    return { error: "Không có dữ liệu hợp lệ" };
  }
  return { clean };
}

async function importRecords(
  records: PBRecord[],
  collectionName: string,
): Promise<ImportResult> {
  const result: ImportResult = { collection: collectionName, total: records.length, success: 0, errors: [] };
  const allowedFields = [...(COLLECTION_FIELDS[collectionName] || []), ...(IMPORT_ONLY_FIELDS[collectionName] || [])];

  let deptRefs: Map<string, string> | null = null;
  let roleRefs: Map<string, string> | null = null;
  if (collectionName === "users") {
    try {
      const [depts, roles] = await Promise.all([
        pb.collection("departments").getFullList<{ id: string; code: string }>(),
        pb.collection("roles").getFullList<{ id: string; code: string }>(),
      ]);
      deptRefs = new Map();
      for (const d of depts) {
        deptRefs.set(d.code, d.id);
        deptRefs.set(d.id, d.id);
      }
      roleRefs = new Map();
      for (const r of roles) {
        roleRefs.set(r.code, r.id);
        roleRefs.set(r.id, r.id);
      }
    } catch {
      deptRefs = null;
      roleRefs = null;
    }
  }

  type SanitizedEntry = { clean: PBRecord; rowIndex: number } | { error: string; rowIndex: number };
  const sanitized: SanitizedEntry[] = [];
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (collectionName === "users" && row.disabled) continue;
    const out = sanitizeRow(row, allowedFields, collectionName);
    if ("clean" in out && collectionName === "users") {
      if (out.clean.password && !out.clean.passwordConfirm) out.clean.passwordConfirm = out.clean.password;
      if (out.clean.department_id && deptRefs) {
        out.clean.department_id = deptRefs.get(String(out.clean.department_id).trim()) ?? out.clean.department_id;
      }
      if (out.clean.role_id && roleRefs) {
        out.clean.role_id = roleRefs.get(String(out.clean.role_id).trim()) ?? out.clean.role_id;
      }
    }
    sanitized.push({ ...out, rowIndex: i });
  }

  const CHUNK = 10;
  for (let start = 0; start < sanitized.length; start += CHUNK) {
    const chunk = sanitized.slice(start, start + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((entry) => {
        if ("error" in entry) return Promise.reject(new Error(entry.error));
        return pb.collection(collectionName).create(entry.clean);
      }),
    );
    for (let j = 0; j < results.length; j++) {
      const entry = chunk[j];
      const res = results[j];
      if (res.status === "fulfilled") {
        result.success++;
      } else {
        result.errors.push({ row: entry.rowIndex + 1, message: parseFieldErrors(res.reason) });
      }
    }
  }

  return result;
}

export async function importFromFile(
  file: File,
  collectionName: string,
): Promise<ImportResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let records: PBRecord[] = [];

  if (ext === "json") {
    const text = await file.text();
    records = JSON.parse(text);
  } else if (ext === "csv") {
    const XLSX = await import("xlsx");
    const text = await file.text();
    const wb = XLSX.read(text, { type: "string", raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json(ws);
  } else if (ext === "xlsx") {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json(ws);
  } else {
    throw new Error(`Unsupported file format: .${ext}`);
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("File không chứa dữ liệu");
  }

  return importRecords(records, collectionName);
}

export async function importFromPasteData(
  text: string,
  collectionName: string,
): Promise<ImportResult> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Cần ít nhất dòng tiêu đề và 1 dòng dữ liệu");

  const sep = lines[0].includes("\t") ? "\t" : "|";
  const headers = lines[0].split(sep).map((h) => h.trim());
  const records: PBRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map((v) => v.trim());
    const row: PBRecord = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j] ?? "";
    }
    records.push(row);
  }

  return importRecords(records, collectionName);
}

export function downloadTemplate(collectionName: string): void {
  const fields = (COLLECTION_FIELDS[collectionName] || []).filter((f) => f !== "id" && f !== "created" && f !== "updated");
  const fieldToLabel: Record<string, string> = {};
  for (const [label, field] of Object.entries({ ...COLLECTION_LABEL_TO_FIELD[collectionName], ...LABEL_TO_FIELD })) {
    if (!fieldToLabel[field]) fieldToLabel[field] = label;
  }
  const headers = fields.map((f) => fieldToLabel[f] || f);
  const bom = "\uFEFF";
  const csv = bom + headers.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${collectionName}-template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const LABEL_TO_FIELD: Record<string, string> = {
  "Tên kế hoạch": "name",
  "Mô tả": "description",
  "Ngày bắt đầu": "start_date",
  "Ngày kết thúc": "end_date",
  "Trạng thái": "status",
  "Tiến độ (%)": "progress",
  "Đột xuất": "is_sudden",
  "Trọng điểm": "is_high_impact",
  "Tên nhiệm vụ": "name",
  "Phân loại": "category",
  "Hạn hoàn thành": "deadline",
  "Lặp lại": "is_recurring",
  "Mã phòng": "code",
  "Tên phòng": "name",
  "Tính báo cáo": "is_counted",
  "Mã chức vụ": "code",
  "Tên chức vụ": "name",
  "Cấp bậc": "level",
  "Phạm vi xem": "view_scope",
  "Quản trị": "can_manage",
  "Email": "email",
  "Mật khẩu": "password",
  "Họ tên": "name",
  "Mã phòng ban": "department_id",
  "Phòng ban": "department_id",
  "Chức vụ": "role_id",
  "Nhắc hạn (ngày)": "reminder_days",
};

const COLLECTION_LABEL_TO_FIELD: Record<string, Record<string, string>> = {
  users: {
    "Mã chức vụ": "role_id",
  },
};

const FIELD_TO_LABEL: Record<string, string> = {};
for (const [label, field] of Object.entries(LABEL_TO_FIELD)) {
  if (!FIELD_TO_LABEL[field]) FIELD_TO_LABEL[field] = label;
}

export { COLLECTION_FIELDS, COLLECTION_LABELS, COLLECTION_PASTE_HINTS };
