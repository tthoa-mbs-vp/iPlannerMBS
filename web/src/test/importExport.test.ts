import { describe, it, expect } from "vitest";
import {
  PLAN_EXPORT_COLUMNS,
  TASK_EXPORT_COLUMNS,
  DEPT_EXPORT_COLUMNS,
  ROLE_EXPORT_COLUMNS,
  USER_EXPORT_COLUMNS,
} from "../utils/importExport";

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
