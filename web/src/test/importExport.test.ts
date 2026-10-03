import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PLAN_EXPORT_COLUMNS,
  TASK_EXPORT_COLUMNS,
  DEPT_EXPORT_COLUMNS,
  ROLE_EXPORT_COLUMNS,
  USER_EXPORT_COLUMNS,
  exportToJSON,
  exportToCSV,
} from "../utils/importExport";

/** Ghi lại blob + tên file mà hàm export tạo ra, thay cho việc tải file thật. */
interface Captured { blob: Blob; filename: string }
const captured: Captured[] = [];

function stubDownload() {
  captured.length = 0;
  // Chỉ chặt 2 hàm tĩnh của URL — stub cả global `URL` sẽ phá `new URL()` mà
  // các thư viện khác dùng.
  vi.spyOn(URL, "createObjectURL").mockImplementation(((blob: Blob) => {
    captured.push({ blob, filename: "" });
    return "blob:mock";
  }) as unknown as typeof URL.createObjectURL);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  // anchor tạo ra để bấm tải — chặn để jsdom không cố điều hướng
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
}

beforeEach(stubDownload);
afterEach(() => vi.restoreAllMocks());

const COLS = [{ key: "name", label: "Tên" }, { key: "status", label: "Trạng thái" }];
const ROWS = [
  { name: "Nhiệm vụ A", status: "in_progress", extra: "bỏ qua" },
  { name: "Nhiệm vụ B", status: undefined },
];

describe("importExport column definitions", () => {
  it("PLAN_EXPORT_COLUMNS has correct structure", () => {
    expect(PLAN_EXPORT_COLUMNS).toBeInstanceOf(Array);
    expect(PLAN_EXPORT_COLUMNS.length).toBeGreaterThan(0);
    expect(PLAN_EXPORT_COLUMNS[0]).toHaveProperty("key");
    expect(PLAN_EXPORT_COLUMNS[0]).toHaveProperty("label");
  });

  it("TASK_EXPORT_COLUMNS has task-specific columns", () => {
    const labels = TASK_EXPORT_COLUMNS.map((c) => c.label);
    expect(labels).toContain("Tên nhiệm vụ");
    expect(labels).toContain("Trạng thái");
    expect(labels).toContain("Hạn hoàn thành");
  });

  it("DEPT_EXPORT_COLUMNS has department columns", () => {
    const keys = DEPT_EXPORT_COLUMNS.map((c) => c.key);
    expect(keys).toContain("code");
    expect(keys).toContain("name");
  });

  it("ROLE_EXPORT_COLUMNS has role columns", () => {
    const keys = ROLE_EXPORT_COLUMNS.map((c) => c.key);
    expect(keys).toContain("level");
    expect(keys).toContain("view_scope");
  });

  it("USER_EXPORT_COLUMNS has user columns", () => {
    const keys = USER_EXPORT_COLUMNS.map((c) => c.key);
    expect(keys).toContain("email");
    expect(keys).toContain("name");
  });
});

describe("exportToJSON", () => {
  it("chỉ xuất các cột khai báo, bỏ qua key thừa và thay null bằng chuỗi rỗng", async () => {
    exportToJSON(ROWS, COLS, "ke-hoach");
    const text = await captured[0].blob.text();
    expect(JSON.parse(text)).toEqual([
      { "Tên": "Nhiệm vụ A", "Trạng thái": "in_progress" },
      { "Tên": "Nhiệm vụ B", "Trạng thái": "" },
    ]);
    expect(text).not.toContain("bỏ qua");
  });
});

describe("exportToCSV", () => {
  it("tiền tố BOM để Excel đọc đúng tiếng Việt, header là nhãn cột", async () => {
    await exportToCSV(ROWS, COLS, "ke-hoach");
    // blob.text() tự bỏ BOM khi giải mã UTF-8, nên phải đọc byte thô.
    const bytes = new Uint8Array(await captured[0].blob.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await captured[0].blob.text();
    const lines = text.trim().split("\n");
    expect(lines[0]).toBe("Tên,Trạng thái");
    expect(lines[1]).toContain("Nhiệm vụ A");
  });
});

describe("exportToExcel", () => {
  it("ghi file .xlsx qua writeFile của thư viện", async () => {
    const writeFile = vi.fn();
    vi.doMock("xlsx", () => ({
      utils: {
        aoa_to_sheet: (aoa: unknown[]) => ({ "XLSX_aoa": aoa }),
        json_to_sheet: (rows: unknown[]) => ({ "XLSX_rows": rows }),
        sheet_to_csv: () => "",
        book_new: () => ({}),
        book_append_sheet: vi.fn(),
        encode_cell: ({ r, c }: { r: number; c: number }) => `R${r}C${c}`,
      },
      writeFile,
    }));
    vi.resetModules();
    const { exportToExcel: fresh } = await import("../utils/importExport");
    await fresh(ROWS, COLS, "ke-hoach");
    expect(writeFile).toHaveBeenCalled();
    expect(String(writeFile.mock.calls[0][1])).toBe("ke-hoach.xlsx");
    vi.doUnmock("xlsx");
    vi.resetModules();
  });
});
