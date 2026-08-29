import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load the PocketBase hooks helper file in this sandbox. helpers.js only uses
// $app inside request-time handlers; its pure helpers evaluate cleanly in Node.
const helpersPath = resolve(__dirname, "../../../backend/pb_hooks/helpers.js");
const source = readFileSync(helpersPath, "utf-8");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let H: any;

beforeAll(() => {
  const fakeModule = { exports: {} as Record<string, unknown> };
  const factory = new Function(
    "module",
    "exports",
    `${source}
    return {
      pub: module.exports,
      _arr: _arr,
      _str: _str,
      _ipToInt: _ipToInt,
      _computeKpi: _computeKpi,
    };`
  );
  H = factory(fakeModule, fakeModule.exports);
});

describe("pb_hooks/helpers — arr/json helpers", () => {
  it("_arr passes arrays through", () => {
    expect(H._arr(["a", "b"])).toEqual(["a", "b"]);
  });
  it("_arr wraps single values", () => {
    expect(H._arr("a")).toEqual(["a"]);
  });
  it("_arr returns empty for falsy", () => {
    expect(H._arr(null)).toEqual([]);
    expect(H._arr(undefined)).toEqual([]);
    expect(H._arr("")).toEqual([]);
  });

  it("pub.jsonArr parses raw JSON string", () => {
    expect(H.pub.jsonArr('["192.168.1.0/24"]')).toEqual(["192.168.1.0/24"]);
  });
  it("pub.jsonArr decodes PB byte array of '[]'", () => {
    const emptyJsonBytes = "[]".split("").map((c) => c.charCodeAt(0));
    expect(H.pub.jsonArr(emptyJsonBytes)).toEqual([]);
  });
  it("pub.jsonArr decodes PB byte array of a JSON array", () => {
    const bytes = '["a","b"]'.split("").map((c) => c.charCodeAt(0));
    expect(H.pub.jsonArr(bytes)).toEqual(["a", "b"]);
  });
  it("pub.jsonArr returns real parsed arrays unchanged", () => {
    expect(H.pub.jsonArr(["x"])).toEqual(["x"]);
  });
  it("pub.jsonArr returns [] for null/undefined/invalid", () => {
    expect(H.pub.jsonArr(null)).toEqual([]);
    expect(H.pub.jsonArr(undefined)).toEqual([]);
    expect(H.pub.jsonArr("{invalid")).toEqual([]);
  });

  it("pub.eq compares scalars and arrays", () => {
    expect(H.pub.eq("a", "a")).toBe(true);
    expect(H.pub.eq("a", "b")).toBe(false);
    expect(H.pub.eq(["x"], ["x"])).toBe(true);
    expect(H.pub.eq(["x"], ["y"])).toBe(false);
    expect(H.pub.eq(["x"], ["y", "z"])).toBe(false);
  });

  it("pub.taskFields excludes weight after removal", () => {
    expect(H.pub.taskFields).not.toContain("weight");
    expect(H.pub.taskFields).toContain("status");
    expect(H.pub.taskFields).toContain("rating");
  });
});

describe("pb_hooks/helpers — IP verification (attendance WiFi)", () => {
  it("_ipToInt parses valid IPv4", () => {
    expect(H._ipToInt("192.168.1.1")).toBe(3232235777);
  });
  it("_ipToInt rejects invalid octets and formats", () => {
    expect(H._ipToInt("999.1.1.1")).toBeNull();
    expect(H._ipToInt("not-an-ip")).toBeNull();
    expect(H._ipToInt("192.168.1")).toBeNull();
  });

  it("pub.isPrivateIp accepts private ranges", () => {
    expect(H.pub.isPrivateIp("10.0.0.5")).toBe(true);
    expect(H.pub.isPrivateIp("172.16.0.1")).toBe(true);
    expect(H.pub.isPrivateIp("172.31.255.255")).toBe(true);
    expect(H.pub.isPrivateIp("192.168.1.100")).toBe(true);
    expect(H.pub.isPrivateIp("127.0.0.1")).toBe(true);
    expect(H.pub.isPrivateIp("::1")).toBe(true);
    expect(H.pub.isPrivateIp("fd00::1")).toBe(true);
  });
  it("pub.isPrivateIp rejects public IPs", () => {
    expect(H.pub.isPrivateIp("8.8.8.8")).toBe(false);
    expect(H.pub.isPrivateIp("172.32.0.1")).toBe(false); // outside /12
    expect(H.pub.isPrivateIp("11.0.0.1")).toBe(false);
    expect(H.pub.isPrivateIp("")).toBe(false);
  });

  it("pub.ipInList matches exact IP", () => {
    expect(H.pub.ipInList("192.168.1.10", ["192.168.1.10"])).toBe(true);
    expect(H.pub.ipInList("192.168.1.11", ["192.168.1.10"])).toBe(false);
  });
  it("pub.ipInList matches wildcard *", () => {
    expect(H.pub.ipInList("1.2.3.4", ["*"])).toBe(true);
  });
  it("pub.ipInList matches CIDR ranges", () => {
    expect(H.pub.ipInList("192.168.1.55", ["192.168.1.0/24"])).toBe(true);
    expect(H.pub.ipInList("192.168.2.55", ["192.168.1.0/24"])).toBe(false);
    expect(H.pub.ipInList("10.0.5.9", ["10.0.0.0/16"])).toBe(true);
  });
  it("pub.ipInList handles empty ip and list safely", () => {
    expect(H.pub.ipInList("", ["*"])).toBe(false);
    expect(H.pub.ipInList("1.2.3.4", [])).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(H.pub.ipInList("1.2.3.4", undefined as any)).toBe(false);
  });
});

describe("pb_hooks/helpers — _computeKpi (server-side, thang diem 10)", () => {
  function makeRecord(rating: number) {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    const now = new Date().toISOString();
    return {
      getBool: (_k: string) => false,
      getString: (k: string) => (k === "status" ? "completed" : k === "completed_at" ? now : ""),
      getFloat: (k: string) => (k === "rating" ? rating : 0),
      deadline: future,
    };
  }

  it("full rating 10 gives final = base for normal on-time task", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = H._computeKpi(makeRecord(10) as any);
    expect(kpi.base_score).toBe(10);
    expect(kpi.progress_score).toBe(100);
    expect(kpi.final_score).toBe(10);
  });

  it("legacy rating 5 yields half of result contribution", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi5 = H._computeKpi(makeRecord(5) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi10 = H._computeKpi(makeRecord(10) as any);
    expect(kpi5.final_score).toBe(6.5);
    expect(kpi5.final_score).toBeLessThan(kpi10.final_score);
  });

  it("important task applies difficulty coeff 1.2", () => {
    const rec = makeRecord(10);
    rec.getString = (k: string) =>
      k === "category" ? "important" : k === "status" ? "completed" : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpi = H._computeKpi(rec as any);
    expect(kpi.difficulty_coeff).toBe(1.2);
    expect(kpi.final_score).toBe(12);
  });
});
