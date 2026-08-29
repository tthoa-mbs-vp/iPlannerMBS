export interface ColumnDef {
  key: string;
  label: string;
}

interface ExcelOptions {
  title?: string;
  highlightHeader?: boolean;
  sheetName?: string;
  groupBy?: (row: Record<string, any>) => string;
}

function toRows<T extends Record<string, any>>(data: T[], columns: ColumnDef[]): Record<string, any>[] {
  return data.map((item) => {
    const row: Record<string, any> = {};
    for (const col of columns) {
      row[col.label] = item[col.key] ?? "";
    }
    return row;
  });
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

export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ColumnDef[],
  filename: string,
  options: ExcelOptions = {}
) {
  const XLSX = await import("xlsx");
  const labels = columns.map((c) => c.label);
  const rows = toRows(data, columns);

  const aoa: (string | number | boolean)[][] = [];
  if (options.title) aoa.push([options.title]);
  aoa.push(labels);

  const groupHeaderRows: number[] = [];
  if (options.groupBy) {
    const groups = new Map<string, any[]>();
    rows.forEach((r) => {
      const g = options.groupBy!(r) || "—";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(r);
    });
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "vi"));
    for (const [name, items] of sorted) {
      groupHeaderRows.push(aoa.length);
      aoa.push([name]);
      items.forEach((item) => aoa.push(labels.map((l) => item[l] ?? "")));
    }
  } else {
    rows.forEach((r) => aoa.push(labels.map((l) => r[l] ?? "")));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const titleRow = 0;
  const headerRow = options.title ? 1 : 0;

  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length * 2, 15) }));

  if (options.title || options.highlightHeader || groupHeaderRows.length > 0) {
    ws["!rows"] = [];
    if (options.title) ws["!rows"][titleRow] = { hpt: 30 };
    if (options.highlightHeader) ws["!rows"][headerRow] = { hpt: 22 };
  }

  if (options.title) {
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: labels.length - 1 } });
    const cell = ws[XLSX.utils.encode_cell({ r: titleRow, c: 0 })];
    if (cell) {
      cell.s = {
        font: { bold: true, sz: 14, color: { rgb: "1e293b" } },
        alignment: { horizontal: "center" },
      };
    }
  }

  if (groupHeaderRows.length > 0) {
    for (const r of groupHeaderRows) {
      ws["!merges"] = ws["!merges"] || [];
      ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: labels.length - 1 } });
      const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (cell) {
        cell.s = {
          font: { bold: true, sz: 12, color: { rgb: "4f46e5" } },
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || filename.slice(0, 31));
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  columns: ColumnDef[],
  filename: string
) {
  const rows = toRows(data, columns);
  const labels = columns.map((c) => c.label);
  const lines = [labels.join(",")];
  rows.forEach((r) => {
    lines.push(labels.map((l) => `"${String(r[l] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToJson<T>(data: T[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

// ---- EXPORT COLUMN DEFINITIONS ----

export const PLAN_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Tên kế hoạch" },
  { key: "leader", label: "Chủ nhiệm" },
  { key: "host_dept", label: "Phòng ban" },
  { key: "start_date", label: "Ngày bắt đầu" },
  { key: "end_date", label: "Ngày kết thúc" },
  { key: "status", label: "Trạng thái" },
  { key: "progress", label: "Tiến độ (%)" },
];

export const TASK_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Tên nhiệm vụ" },
  { key: "executor", label: "Người thực hiện" },
  { key: "supervisor", label: "Người giám sát" },
  { key: "plan_name", label: "Kế hoạch" },
  { key: "deadline", label: "Hạn hoàn thành" },
  { key: "status", label: "Trạng thái" },
  { key: "is_recurring", label: "Lặp lại" },
  { key: "is_ad_hoc", label: "Đột xuất" },
  { key: "is_high_impact", label: "Quan trọng" },
];

export const DEPT_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Mã phòng ban" },
  { key: "name", label: "Tên phòng ban" },
  { key: "is_counted", label: "Tính KPI" },
];

export const ROLE_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Mã chức vụ" },
  { key: "name", label: "Tên chức vụ" },
  { key: "level", label: "Cấp bậc" },
  { key: "view_scope", label: "Phạm vi xem" },
];

export const USER_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "email", label: "Email" },
  { key: "name", label: "Họ tên" },
  { key: "username", label: "Tên đăng nhập" },
  { key: "department", label: "Phòng ban" },
  { key: "role", label: "Chức vụ" },
  { key: "verified", label: "Đã xác minh" },
  { key: "disabled", label: "Đã vô hiệu" },
];

export const GROUP_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Mã tổ" },
  { key: "name", label: "Tên tổ" },
  { key: "description", label: "Mô tả" },
  { key: "department", label: "Phòng ban" },
  { key: "member_count", label: "Số thành viên" },
];

// ---- IMPORT HELPERS ----

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importFromExcel(
  file: File,
  columns: ColumnDef[],
  onRow: (row: Record<string, any>, index: number) => Promise<{ action: "created" | "updated" | "error"; message?: string }>
): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  if (data.length < 2) return { created: 0, updated: 0, errors: [{ row: 0, message: "File trống hoặc không có dữ liệu" }] };

  const headerRow = data[0];
  const labelToKey = new Map<string, string>();
  columns.forEach((c) => {
    const idx = headerRow.findIndex((h: unknown) => String(h ?? '').trim() === c.label);
    if (idx >= 0) labelToKey.set(String(idx), c.key);
  });

  const result: ImportResult = { created: 0, updated: 0, errors: [] };
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every((c: unknown) => c === null || c === undefined || c === '')) continue;
    const mapped: Record<string, any> = {};
    labelToKey.forEach((key, idx) => {
      mapped[key] = row[parseInt(idx)];
    });
    try {
      const res = await onRow(mapped, i);
      if (res.action === "created") result.created++;
      else if (res.action === "updated") result.updated++;
      else if (res.message) result.errors.push({ row: i + 1, message: res.message });
    } catch (err: unknown) {
      result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Lỗi không xác định" });
    }
  }
  return result;
}

export function sanitizeRow(row: Record<string, any>, allowedKeys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      out[key] = row[key];
    }
  }
  return out;
}

export const ALLOWED_IMPORT_FIELDS: Record<string, string[]> = {
  departments: ["code", "name", "is_counted"],
  roles: ["code", "name", "level", "view_scope", "can_add_plans", "can_edit_plans", "can_delete_plans", "can_add_tasks", "can_edit_tasks", "can_delete_tasks", "can_manage", "can_approve_leave", "can_view_salary"],
  users: ["email", "name", "username", "department_id", "role_id", "verified"],
  plans: ["name", "description", "leader_id", "host_dept_id", "start_date", "end_date", "status", "is_sudden", "is_high_impact"],
  tasks: ["name", "description", "plan_id", "category", "host_dept_id", "executor_id", "supervisor_id", "start_date", "deadline", "status", "is_recurring"],
};
