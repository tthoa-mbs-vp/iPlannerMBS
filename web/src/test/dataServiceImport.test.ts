import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ created: [] as { collection: string; data: Record<string, unknown> }[] }));

vi.mock("../api/client", () => ({
  pb: {
    collection: vi.fn((name: string) => ({
      getFullList: vi.fn(async () => {
        if (name === "departments") return [{ id: "dept-kt", code: "KT" }];
        if (name === "roles") return [{ id: "role-tp", code: "TP" }];
        return [];
      }),
      create: vi.fn((d: Record<string, unknown>) => {
        h.created.push({ collection: name, data: d });
        return { ...d, id: "new-id" };
      }),
    })),
    authStore: { record: { id: "admin" } },
  },
}));

import { importFromFile, COLLECTION_PASTE_HINTS } from "../services/dataService";

describe("users import resolves codes to ids", () => {
  it("maps department/role codes to record ids", async () => {
    const json = JSON.stringify([
      { Email: "test@mbs.com", "Mật khẩu": "Abc@12345", "Họ tên": "Test User", "Mã phòng ban": "KT", "Mã chức vụ": "TP" },
    ]);
    const file = new File([json], "users.json", { type: "application/json" });
    const result = await importFromFile(file, "users");
    expect(result.success).toBe(1);
    const createdUser = h.created.find((c) => c.collection === "users");
    expect(createdUser).toBeTruthy();
    expect(createdUser?.data.department_id).toBe("dept-kt");
    expect(createdUser?.data.role_id).toBe("role-tp");
  });

  it("passes through raw ids when already valid", async () => {
    const json = JSON.stringify([
      { Email: "test2@mbs.com", "Mật khẩu": "Abc@12345", "Họ tên": "Test 2", "Mã phòng ban": "dept-kt", "Mã chức vụ": "role-tp" },
    ]);
    const file = new File([json], "users.json", { type: "application/json" });
    await importFromFile(file, "users");
    const createdUser = h.created.find((c) => c.collection === "users" && c.data.email === "test2@mbs.com");
    expect(createdUser?.data.department_id).toBe("dept-kt");
    expect(createdUser?.data.role_id).toBe("role-tp");
  });

  it("users paste hint uses mã chức vụ / mã phòng ban", () => {
    const hint = COLLECTION_PASTE_HINTS.users;
    expect(hint).toContain("Mã chức vụ");
    expect(hint).toContain("Mã phòng ban");
    expect(hint).not.toContain("Chức vụ");
  });
});
