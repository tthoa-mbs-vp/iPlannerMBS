import { describe, it, expect } from "vitest";
import {
  APPS,
  appById,
  appOwnsPath,
  appsForRole,
  defaultAppIdFor,
  resolveAppId,
  type RoleFlags,
} from "../config/apps";

const NV: RoleFlags = {};
const TRUONGPHONG: RoleFlags = { view_scope: "department" } as RoleFlags;
const HR: RoleFlags = { can_view_salary: true };
const ADMIN: RoleFlags = { can_manage: true };

describe("sổ app — cổng vào chung", () => {
  it("có đúng 3 app: Kế hoạch, Nhân sự, Quản trị", () => {
    expect(APPS.map((a) => a.name)).toEqual(["Kế hoạch", "Nhân sự", "Quản trị"]);
  });

  it("mỗi app có tên, tagline và trang chủ riêng", () => {
    for (const a of APPS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.tagline.length).toBeGreaterThan(0);
      expect(a.home.startsWith("/")).toBe(true);
      expect(a.sections.length).toBeGreaterThan(0);
    }
    // Trang chủ phải khác nhau, nếu không "mỗi người đến app tương ứng" vô nghĩa.
    expect(new Set(APPS.map((a) => a.home)).size).toBe(APPS.length);
  });

  it("giao diện dùng chung: app nào cũng có mục Hướng dẫn", () => {
    for (const a of APPS) {
      const labels = a.sections.flatMap((s) => s.items.map((i) => i.label));
      expect(labels).toContain("Hướng dẫn");
    }
  });
});

describe("ai vào được app nào", () => {
  it("nhân viên chỉ vào được app Kế hoạch", () => {
    expect(appsForRole(NV).map((a) => a.id)).toEqual(["plans"]);
    expect(appsForRole(TRUONGPHONG).map((a) => a.id)).toEqual(["plans"]);
  });

  it("nhân sự vào được Kế hoạch + Nhân sự, không vào Quản trị", () => {
    expect(appsForRole(HR).map((a) => a.id)).toEqual(["plans", "hr"]);
  });

  it("quản trị vào được cả ba app", () => {
    expect(appsForRole(ADMIN).map((a) => a.id)).toEqual(["plans", "hr", "admin"]);
  });

  it("chưa đăng nhập (role undefined) chỉ thấy app Kế hoạch", () => {
    expect(appsForRole(undefined).map((a) => a.id)).toEqual(["plans"]);
  });
});

describe("đăng nhập thì mở app nào", () => {
  it("quản trị → Quản trị, nhân sự → Nhân sự, còn lại → Kế hoạch", () => {
    expect(defaultAppIdFor(ADMIN)).toBe("admin");
    expect(defaultAppIdFor(HR)).toBe("hr");
    expect(defaultAppIdFor(NV)).toBe("plans");
    expect(defaultAppIdFor(TRUONGPHONG)).toBe("plans");
    expect(defaultAppIdFor(undefined)).toBe("plans");
  });
});

describe("lựa chọn app đã lưu", () => {
  it("giữ lựa chọn khi còn hợp lệ", () => {
    expect(resolveAppId(ADMIN, "hr")).toBe("hr");
    expect(resolveAppId(HR, "plans")).toBe("plans");
  });

  it("bỏ lựa chọn không còn hợp lệ — ví dụ đổi role, không mở nhầm app", () => {
    // Người dùng từng lưu "admin" rồi bị hạ quyền còn nhân viên.
    expect(resolveAppId(NV, "admin")).toBe("plans");
    expect(resolveAppId(NV, "hr")).toBe("plans");
    // Trường hợp ngược lại: lưu app "plans" rồi lên quản trị vẫn hợp lệ.
    expect(resolveAppId(ADMIN, "plans")).toBe("plans");
  });

  it("lựa chọn rác / null thì lùi về app mặc định", () => {
    expect(resolveAppId(HR, null)).toBe("hr");
    expect(resolveAppId(HR, "khong-ton-tai")).toBe("hr");
  });
});

describe("AppBoundary — route thuộc app nào", () => {
  const plans = appById("plans")!;
  const hr = appById("hr")!;
  const admin = appById("admin")!;

  it("nhận trang và trang chi tiết của app", () => {
    expect(appOwnsPath(plans, "/plans")).toBe(true);
    expect(appOwnsPath(plans, "/plans/abc123")).toBe(true);
    expect(appOwnsPath(plans, "/tasks")).toBe(true);
    expect(appOwnsPath(plans, "/tasks/t1")).toBe(true);
    expect(appOwnsPath(hr, "/hr")).toBe(true);
    expect(appOwnsPath(hr, "/hr/u1")).toBe(true);
    expect(appOwnsPath(admin, "/admin/data")).toBe(true);
  });

  it("không lẫn tiền tố: /plansXYZ không thuộc app Kế hoạch", () => {
    expect(appOwnsPath(plans, "/plansXYZ")).toBe(false);
    expect(appOwnsPath(plans, "/admin")).toBe(false);
    expect(appOwnsPath(hr, "/hrabc")).toBe(false);
    expect(appOwnsPath(hr, "/plans")).toBe(false);
    expect(appOwnsPath(admin, "/hr")).toBe(false);
  });
});

describe("phân quyền trong menu", () => {
  it("mục Nhân sự đánh dấu hrOnly để ẩn với người không có quyền", () => {
    const hrItem = appById("hr")!.sections
      .flatMap((s) => s.items)
      .find((i) => i.to === "/hr");
    expect(hrItem?.hrOnly).toBe(true);
  });

  it("app Quản trị đánh dấu toàn bộ mục là adminOnly", () => {
    const items = appById("admin")!.sections.flatMap((s) => s.items).filter((i) => i.to);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.adminOnly)).toBe(true);
  });
});
