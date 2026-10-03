import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fullSchema, collections, postPatches, PREREQ_NAMES } from "../../scripts/schema-defs.mjs";

/**
 * schema-defs.mjs là nguồn schema DUY NHẤT (sau khi gỡ create-collections.mjs
 * vốn khai báo trùng và đã lệch). pb-schema.json là snapshot của một instance
 * cụ thể — nó giữ id thật (`pbc_<random>`) mà `sync-schema.mjs` cần để import
 * đúng chứ không tạo collection trùng, nên không sinh tự động từ defs được.
 *
 * Bù lại: test này khẳng định hai nguồn không lệch nhau về FIELD NGHIỆP VỤ, để
 * khi thêm/sửa một field thì quên cập nhật nơi kia sẽ bị chặn ngay.
 *
 * `id` / `created` / `updated` là field hệ thống PocketBase tự thêm, không
 * thuộc định nghĩa nghiệp vụ nên bỏ qua. Collection `users` không nằm trong
 * `collections` vì PocketBase tự tạo; nó được `syncUsers()` patch lúc chạy.
 */

const snapshot = JSON.parse(
  readFileSync(resolve(__dirname, "../../scripts/pb-schema.json"), "utf-8"),
) as { id: string; name: string; fields: { name: string; type: string }[] }[];

const SYSTEM_FIELDS = new Set(["id", "created", "updated"]);
const businessFields = (fields: { name: string }[]) =>
  fields.map((f) => f.name).filter((n) => !SYSTEM_FIELDS.has(n)).sort();

describe("schema-defs là nguồn schema duy nhất", () => {
  it("mọi collection trong schema-defs có id bắt đầu bằng pbc_ hoặc là users", () => {
    for (const c of collections) {
      expect(c.id.startsWith("pbc_") || c.id === "_pb_users_auth_", `${c.name} có id ${c.id}`).toBe(true);
    }
  });

  it("id của collection là duy nhất", () => {
    const ids = collections.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tên collection là duy nhất", () => {
    const names = collections.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("postPatches chỉ tham chiếu collection có thật", () => {
    const names = new Set(collections.map((c) => c.name));
    for (const p of postPatches) {
      expect(names.has(p.collection), `postPatch trỏ tới collection không tồn tại: ${p.collection}`).toBe(true);
    }
  });

  it("PREREQ_NAMES chỉ gồm collection có thật", () => {
    const names = new Set(collections.map((c) => c.name));
    for (const n of PREREQ_NAMES) {
      expect(names.has(n), `PREREQ_NAME không có trong definitions: ${n}`).toBe(true);
    }
  });

  it("relation không trỏ tới collection không có trong definitions (trừ users)", () => {
    const names = new Set(collections.map((c) => c.id));
    for (const c of collections) {
      for (const f of c.fields) {
        if (f.type !== "relation") continue;
        const target = (f as { collectionId?: string }).collectionId;
        if (!target) continue;
        expect(
          names.has(target) || target === "_pb_users_auth_",
          `${c.name}.${f.name} trỏ relation tới "${target}" không tồn tại`,
        ).toBe(true);
      }
    }
  });
});

describe("schema-defs khớp snapshot pb-schema.json", () => {
  it("không collection nào lệch danh sách field nghiệp vụ", () => {
    const defs = new Map(fullSchema().map((c) => [c.name, c]));
    const mismatches: string[] = [];

    for (const snap of snapshot) {
      if (snap.name === "users") continue; // do syncUsers() patch lúc chạy
      const def = defs.get(snap.name);
      if (!def) {
        mismatches.push(`${snap.name}: có trong snapshot nhưng không có trong schema-defs`);
        continue;
      }
      const a = businessFields(snap.fields);
      const b = businessFields(def.fields);
      if (a.join(",") !== b.join(",")) {
        mismatches.push(`${snap.name}: snapshot=[${a.join(",")}] schema-defs=[${b.join(",")}]`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("mọi collection trong schema-defs đều có trong snapshot", () => {
    const snapNames = new Set(snapshot.map((c) => c.name));
    const missing = collections.map((c) => c.name).filter((n) => !snapNames.has(n));
    expect(missing).toEqual([]);
  });
});