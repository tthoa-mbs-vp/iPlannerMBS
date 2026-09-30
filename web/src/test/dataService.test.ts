import { describe, it, expect, vi } from "vitest";
import { COLLECTION_FIELDS, COLLECTION_LABELS, EXPORT_COLLECTIONS } from "../services/dataService";

vi.mock("../api/client", () => ({
  pb: {
    collection: vi.fn(() => ({
      getFullList: vi.fn(),
      create: vi.fn((d: Record<string, unknown>) => ({ ...d, id: "mock-id" })),
    })),
    authStore: { record: { id: "admin" } },
  },
}));

describe("dataService constants", () => {
  it("COLLECTION_FIELDS contains all 11 collections", () => {
    const collections = Object.keys(COLLECTION_FIELDS);
    expect(collections).toContain("departments");
    expect(collections).toContain("roles");
    expect(collections).toContain("users");
    expect(collections).toContain("plans");
    expect(collections).toContain("tasks");
    expect(collections).toContain("proposals");
    expect(collections).toContain("comments");
    expect(collections).toContain("kpi_scores");
    expect(collections).toContain("professional_groups");
    expect(collections).toContain("archived_tasks");
    expect(collections).toContain("archived_plans");
    expect(collections.length).toBe(11);
  });

  it("COLLECTION_LABELS has Vietnamese labels", () => {
    expect(COLLECTION_LABELS.tasks).toBe("Nhiệm vụ");
    expect(COLLECTION_LABELS.plans).toBe("Kế hoạch");
    expect(COLLECTION_LABELS.departments).toBe("Phòng ban");
  });

  it("EXPORT_COLLECTIONS has value and label for each", () => {
    expect(EXPORT_COLLECTIONS.length).toBe(11);
    for (const c of EXPORT_COLLECTIONS) {
      expect(c).toHaveProperty("value");
      expect(c).toHaveProperty("label");
    }
  });

  it("tasks collection has expected fields", () => {
    const fields = COLLECTION_FIELDS.tasks;
    expect(fields).toContain("name");
    expect(fields).toContain("status");
    expect(fields).toContain("executor_id");
    expect(fields).toContain("deadline");
  });

  it("importFromFile parses JSON data", async () => {
    const { importFromFile } = await import("../services/dataService");
    const json = JSON.stringify([
      { name: "Dept A", description: "Test" },
      { name: "Dept B", description: "Test 2" },
    ]);
    const file = new File([json], "test.json", { type: "application/json" });
    const result = await importFromFile(file, "departments");
    expect(result.collection).toBe("departments");
    expect(result.total).toBe(2);
  });

  it("importFromFile throws on empty data", async () => {
    const { importFromFile } = await import("../services/dataService");
    const file = new File(["[]"], "empty.json", { type: "application/json" });
    await expect(importFromFile(file, "tasks")).rejects.toThrow("File không chứa dữ liệu");
  });
});
