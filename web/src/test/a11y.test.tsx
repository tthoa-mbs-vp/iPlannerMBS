import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "../components/layout/Header";
import { usePageTitleStore } from "../stores/pageTitleStore";

/**
 * Regression cho pass a11y (docs/review-2026-08.md §3.4):
 *  1. index.html không được khoá zoom (WCAG 1.4.4).
 *  2. Mọi nút icon-only trong Header phải có accessible name.
 *  3. Không có input controlled (`checked`) thiếu `onChange` — React cảnh báo
 *     "read-only field" và người dùng không đổi được trạng thái bằng bàn phím.
 */

/**
 * Thu thập thẻ `<input>` với phần thân nằm trong ngoặc nhọn: dấu `>` đầu tiên
 * có thể thuộc arrow function (`=>`) nên không thể cắt bằng regex thường.
 */
function inputTags(src: string): { tag: string; index: number }[] {
  const out: { tag: string; index: number }[] = [];
  const re = /<input\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        end = i + 1;
        break;
      }
    }
    if (end === -1) continue;
    out.push({ tag: src.slice(m.index, end), index: m.index });
    re.lastIndex = end;
  }
  return out;
}

const mockUserState = {
  user: {
    id: "u1",
    name: "Nguyễn Văn A",
    email: "a@mbs.com",
    avatar: "https://example.test/a.png",
    expand: { department_id: { id: "d1", name: "CNTT" }, role_id: { id: "r1", name: "Trưởng phòng" } },
  },
  logout: vi.fn(),
};

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockUserState) => unknown) =>
    selector ? selector(mockUserState) : mockUserState,
  ),
}));

vi.mock("../api/client", () => ({
  getUserAvatar: () => "https://example.test/a.png",
}));

// Không cần hành vi thật của dropdown thông báo trong test a11y này.
vi.mock("../components/layout/NotificationDropdown", () => ({
  default: () => <button aria-label="Thông báo">bell</button>,
}));

function renderHeader(backTo: string | (() => void) | null = null) {
  usePageTitleStore.setState({ title: "Chi tiết kế hoạch", backTo, badge: null });
  return render(
    <MemoryRouter>
      <Header onToggleSidebar={() => {}} />
    </MemoryRouter>,
  );
}

describe("a11y — viewport", () => {
  const html = readFileSync(resolve(__dirname, "../../index.html"), "utf-8");

  it("không khoá zoom trên mobile (WCAG 1.4.4)", () => {
    const tag = html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? "";
    expect(tag).toBeTruthy();
    expect(tag).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(tag).not.toMatch(/maximum-scale\s*=\s*(0|1(\.\d+)?)/i);
  });

  it("giữ initial-scale=1 để bố cục không trượt khi mở app", () => {
    const tag = html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? "";
    expect(tag).toMatch(/initial-scale\s*=\s*1(\.0)?/i);
    expect(tag).toMatch(/width\s*=\s*device-width/i);
  });
});

describe("a11y — Header", () => {
  beforeEach(() => usePageTitleStore.setState({ title: "", backTo: null, badge: null }));

  it("nút quay lại dạng Link vẫn có accessible name", () => {
    renderHeader("/plans");
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/plans");
  });

  it("nút quay lại dạng callback có accessible name", () => {
    renderHeader(() => {});
    expect(screen.getByRole("button", { name: "Quay lại" })).toBeInTheDocument();
  });

  it("nút tài khoản được đặt tên theo người dùng và báo trạng thái menu", () => {
    renderHeader();
    const btn = screen.getByRole("button", { name: /Tài khoản Nguyễn Văn A/ });
    expect(btn).toHaveAttribute("aria-haspopup", "true");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("ảnh đại diện có alt mô tả, không phải chuỗi rỗng", () => {
    renderHeader();
    const img = screen.getByRole("img", { name: /Ảnh đại diện Nguyễn Văn A/ });
    expect(img).toHaveAttribute("src", "https://example.test/a.png");
  });

  it("các nút giao diện có tên và trạng thái đang chọn", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /Tài khoản/ }));
    // localStorage rỗng → useTheme mặc định "system"
    expect(screen.getByRole("button", { name: "Giao diện hệ thống" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Giao diện sáng" })).toHaveAttribute("aria-pressed", "false");
  });

  it("không còn phần tử tương tác nào thiếu accessible name", () => {
    const { container } = renderHeader("/plans");
    const nameless = Array.from(container.querySelectorAll("button, a")).filter(
      (el) => !el.textContent?.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title"),
    );
    expect(nameless.map((el) => el.outerHTML.slice(0, 90))).toEqual([]);
  });
});

describe("a11y — nút icon-only trong các bảng quản trị", () => {
  const files = [
    "../components/admin/GroupManager.tsx",
    "../components/admin/RoleManager.tsx",
    "../components/admin/UserManager.tsx",
    "../components/leave/LeaveInlineForm.tsx",
    "../components/plans/PlanInlineForm.tsx",
    "../components/tasks/TaskInlineForm.tsx",
  ];

  /**
   * Quét tĩnh: nút chỉ chứa icon (không chữ, không biểu thức JSX) mà thiếu
   * aria-label/title thì screen reader đọc ra "button" trống.
   * Có biểu thức `{...}` thì bỏ qua — nhãn có thể đến từ props.
   */
  it.each(files)("%s không còn nút chỉ có icon mà thiếu nhãn", (rel) => {
    const src = readFileSync(resolve(__dirname, rel), "utf-8");
    const offenders = Array.from(src.matchAll(/<button\b[\s\S]{0,900}?<\/button>/g))
      .map((m) => m[0])
      .filter((b) => !/aria-label|title=/.test(b))
      .filter((b) => {
        const inner = b.replace(/^<button\b[^>]*>/, "").replace(/<\/button>$/, "");
        if (inner.includes("{")) return false;
        return inner.replace(/<[A-Za-z][^>]*\/>/g, "").trim() === "";
      });
    expect(offenders).toEqual([]);
  });
});

describe("a11y — input controlled không có onChange", () => {
  const files = [
    "../components/plans/TaskRow.tsx",
    "../pages/PlansPage.tsx",
    "../pages/TaskDetailPage.tsx",
    "../pages/PlanDetailPage.tsx",
    "../components/admin/RoleManager.tsx",
    "../components/admin/UserManager.tsx",
    "../components/admin/DepartmentManager.tsx",
    "../components/attendance/WifiConfigModal.tsx",
  ];

  it.each(files)("%s không có `checked` mà thiếu onChange/readOnly", (rel) => {
    const src = readFileSync(resolve(__dirname, rel), "utf-8");
    const offenders = inputTags(src)
      .filter(({ tag }) => /\bchecked=/.test(tag))
      .filter(({ tag }) => !/onChange|readOnly|defaultChecked/.test(tag))
      .map(({ tag }) => tag.replace(/\s+/g, " ").slice(0, 90));
    expect(offenders).toEqual([]);
  });
});