export interface ColumnDef {
  key: string;
  label: string;
}

/** Generic row used by export helpers. */
type RowData = Record<string, unknown>;

interface ExcelOptions {
  title?: string;
  highlightHeader?: boolean;
  sheetName?: string;
  groupBy?: (row: RowData) => string;
}

function toRows<T extends RowData>(data: T[], columns: ColumnDef[]): RowData[] {
  return data.map((item) => {
    const row: RowData = {};
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

export async function exportToExcel<T extends RowData>(
  data: T[],
  columns: ColumnDef[],
  filename: string,
  options: ExcelOptions = {}
) {
  const XLSX = await import("xlsx");
  const labels = columns.map((c) => c.label);
  const rows = toRows(data, columns);

  const aoa: (string | number | boolean | null)[][] = [];
  if (options.title) aoa.push([options.title]);
  aoa.push(labels);

  const groupHeaderRows: number[] = [];
  if (options.groupBy) {
    const groups = new Map<string, RowData[]>();
    rows.forEach((r) => {
      const g = options.groupBy!(r) || "—";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(r);
    });
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "vi"));
    for (const [name, items] of sorted) {
      groupHeaderRows.push(aoa.length);
      aoa.push([name]);
      items.forEach((item) => aoa.push(labels.map((l) => String(item[l] ?? ""))));
    }
  } else {
    rows.forEach((r) => aoa.push(labels.map((l) => String(r[l] ?? ""))));
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
        font: { bold: true, sz: 14, color: { rgb: "1E3A8A" } },
        fill: { patternType: "solid", fgColor: { rgb: "DBEAFE" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }

  if (options.highlightHeader) {
    for (let c = 0; c < labels.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
    }
  }

  if (groupHeaderRows.length > 0) {
    ws["!merges"] = ws["!merges"] || [];
    for (const r of groupHeaderRows) {
      ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: labels.length - 1 } });
      ws["!rows"]![r] = { hpt: 20 };
      const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: "1E40AF" } },
          fill: { patternType: "solid", fgColor: { rgb: "DBEAFE" } },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || filename);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToCSV<T extends RowData>(
  data: T[],
  columns: ColumnDef[],
  filename: string
) {
  const XLSX = await import("xlsx");
  const rows = toRows(data, columns);

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const bom = "\uFEFF";
  downloadBlob(new Blob([bom + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export function exportToJSON<T extends RowData>(
  data: T[],
  columns: ColumnDef[],
  filename: string
) {
  const rows = toRows(data, columns);
  downloadBlob(
    new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
    `${filename}.json`,
  );
}

export const PLAN_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Tên kế hoạch" },
  { key: "description", label: "Mô tả" },
  { key: "start_date", label: "Ngày bắt đầu" },
  { key: "end_date", label: "Ngày kết thúc" },
  { key: "status", label: "Trạng thái" },
  { key: "progress", label: "Tiến độ (%)" },
  { key: "is_sudden", label: "Đột xuất" },
  { key: "is_high_impact", label: "Trọng điểm" },
];

export const TASK_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Tên nhiệm vụ" },
  { key: "description", label: "Mô tả" },
  { key: "category", label: "Phân loại" },
  { key: "start_date", label: "Ngày bắt đầu" },
  { key: "deadline", label: "Hạn hoàn thành" },
  { key: "status", label: "Trạng thái" },
  { key: "is_recurring", label: "Lặp lại" },
  { key: "is_ad_hoc", label: "Đột xuất" },
  { key: "is_high_impact", label: "Trọng điểm" },
  { key: "rating", label: "Xếp loại" },
];

export const DEPT_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Mã phòng" },
  { key: "name", label: "Tên phòng" },
  { key: "is_counted", label: "Tính báo cáo" },
];

export const ROLE_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Mã chức vụ" },
  { key: "name", label: "Tên chức vụ" },
  { key: "description", label: "Mô tả" },
  { key: "level", label: "Cấp bậc" },
  { key: "view_scope", label: "Phạm vi xem" },
  { key: "can_manage", label: "Quản trị" },
  { key: "can_approve_leave", label: "Duyệt nghỉ phép" },
  { key: "can_view_salary", label: "Xem lương" },
  { key: "approval_scope", label: "Phạm vi duyệt" },
];

export const USER_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "email", label: "Email" },
  { key: "name", label: "Họ tên" },
  { key: "department", label: "Phòng ban" },
  { key: "role", label: "Chức vụ" },
  { key: "groups", label: "Tổ chuyên môn" },
  { key: "verified", label: "Trạng thái" },
  { key: "reminder_days", label: "Nhắc hạn (ngày)" },
];

export const GROUP_EXPORT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Mã tổ" },
  { key: "name", label: "Tên tổ" },
  { key: "description", label: "Mô tả" },
  { key: "department", label: "Phòng cha" },
  { key: "member_count", label: "Số thành viên" },
];
