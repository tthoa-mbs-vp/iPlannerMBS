import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  Database,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
  UserCog,
  type LucideIcon,
} from "lucide-react";

/** Phần quyền đọc từ `user.expand.role_id` — chỉ những cờ mà sổ app cần biết. */
export interface RoleFlags {
  can_manage?: boolean;
  can_view_salary?: boolean;
}

export interface NavItem {
  to?: string;
  href?: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
  /** Chỉ hiện khi role có can_manage (dùng cho mục nhạy cảm bên trong một app). */
  adminOnly?: boolean;
  /** Chỉ hiện khi role có can_view_salary hoặc can_manage. */
  hrOnly?: boolean;
}

export interface AppSection {
  title: string;
  items: NavItem[];
}

export interface AppDef {
  id: string;
  /** Tên hiển thị — mỗi app một tên, đây là điểm khác biệt người dùng thấy. */
  name: string;
  tagline: string;
  /** Trang chủ trên desktop. */
  home: string;
  /** Trang chủ trên mobile. */
  homeMobile: string;
  sections: AppSection[];
  /**
   * Tiền tố route thuộc app. Dùng cho AppBoundary: mở URL của app khác sẽ bị đưa về
   * trang chủ app đang dùng, thay vì để người dùng lọt vào nghiệp vụ không thuộc về mình.
   *
   * Lưu ý: đây chỉ là lớp trải nghiệm. Ranh giới bảo mật thật vẫn nằm ở collection
   * rules + guards.pb.js/scope.pb.js trên server — xem docs/security-hardening-2026-10.md.
   */
  routePrefixes: string[];
  canAccess: (role: RoleFlags | undefined) => boolean;
}

/** Mục chung cho mọi app — không phải nghiệp vụ riêng của app nào. */
const HELP_ITEM: NavItem = {
  href: "/huong-dan-su-dung.html",
  label: "Hướng dẫn",
  icon: BookOpen,
  external: true,
};

/**
 * Ba app của hệ thống. Một cổng vào chung, giao diện dùng chung (Sidebar/Layout/Header),
 * khác nhau ở TÊN app và MENU của từng nghiệp vụ.
 *
 * - Kế hoạch: ai cũng vào được (kể cả nhân viên) — nơi mọi người theo dõi việc được giao.
 * - Nhân sự: chỉ can_view_salary hoặc can_manage.
 * - Quản trị: chỉ can_manage.
 */
export const APPS: AppDef[] = [
  {
    id: "plans",
    name: "Kế hoạch",
    tagline: "Kế hoạch, nhiệm vụ và tiến độ công việc",
    home: "/dashboard",
    homeMobile: "/m",
    sections: [
      {
        title: "Tổng quan",
        items: [
          { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { to: "/my-day", label: "Việc của tôi hôm nay", icon: Sun },
        ],
      },
      {
        title: "Quản lý Công việc",
        items: [
          { to: "/plans", label: "Kế hoạch & Nhiệm vụ", icon: ClipboardList },
          { to: "/reports", label: "Báo cáo", icon: BarChart3 },
          { to: "/kpi", label: "KPI", icon: Award },
        ],
      },
      {
        title: "Trao đổi",
        items: [
          { to: "/announcements", label: "Bảng tin", icon: Megaphone },
          { to: "/discussion", label: "Trao đổi & Thảo luận", icon: MessagesSquare },
        ],
      },
      { title: "Thông tin", items: [HELP_ITEM] },
    ],
    routePrefixes: [
      "/dashboard",
      "/my-day",
      "/plans",
      "/tasks",
      "/reports",
      "/kpi",
      "/discussion",
      "/announcements",
      "/notifications",
      "/profile",
    ],
    canAccess: () => true,
  },
  {
    id: "hr",
    name: "Nhân sự",
    tagline: "Hồ sơ, lương, chấm công và nghỉ phép",
    home: "/hr",
    homeMobile: "/m",
    sections: [
      {
        title: "Quản lý Nhân sự",
        items: [
          { to: "/hr", label: "Nhân sự", icon: UserCog, hrOnly: true },
          { to: "/attendance", label: "Chấm công", icon: Clock },
          { to: "/leave", label: "Nghỉ phép", icon: CalendarDays },
          { to: "/surprise-check", label: "Kiểm tra đột xuất", icon: ShieldCheck, adminOnly: true },
        ],
      },
      { title: "Thông tin", items: [HELP_ITEM] },
    ],
    routePrefixes: ["/hr", "/attendance", "/leave", "/surprise-check"],
    canAccess: (role) => !!role?.can_view_salary || !!role?.can_manage,
  },
  {
    id: "admin",
    name: "Quản trị",
    tagline: "Người dùng, phân quyền, nhật ký và dữ liệu",
    home: "/admin",
    homeMobile: "/m",
    sections: [
      {
        title: "Quản trị hệ thống",
        items: [
          { to: "/admin", label: "Quản trị", icon: Shield, adminOnly: true },
          { to: "/admin/logs", label: "Nhật ký", icon: Activity, adminOnly: true },
          { to: "/admin/data", label: "Dữ liệu", icon: Database, adminOnly: true },
          { to: "/trash", label: "Thùng rác", icon: Trash2, adminOnly: true },
        ],
      },
      { title: "Thông tin", items: [HELP_ITEM] },
    ],
    routePrefixes: ["/admin", "/trash"],
    canAccess: (role) => !!role?.can_manage,
  },
];

/** App mà người dùng đi thẳng vào sau khi đăng nhập — app "chính" theo nghiệp vụ của họ. */
export function defaultAppIdFor(role: RoleFlags | undefined): string {
  if (role?.can_manage) return "admin";
  if (role?.can_view_salary) return "hr";
  return "plans";
}

/** Các app mà role này được vào, theo thứ tự ưu tiên hiển thị trong ô chuyển app. */
export function appsForRole(role: RoleFlags | undefined): AppDef[] {
  return APPS.filter((a) => a.canAccess(role));
}

export function appById(id: string): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}

/** Route có thuộc app không (so tiền tố, để /plans/abc khớp /plans). */
export function appOwnsPath(app: AppDef, pathname: string): boolean {
  return app.routePrefixes.some(
    (p) => pathname === p || pathname.startsWith(p === "/" ? "/" : p + "/")
  );
}

/**
 * Chọn app đang hoạt động: ưu tiên lựa chọn đã lưu, nếu không hợp lệ với role hiện tại
 * thì lùi về app mặc định. Đây là hàm thuần để test được không cần DOM.
 */
export function resolveAppId(
  role: RoleFlags | undefined,
  preferred?: string | null
): string {
  const available = appsForRole(role);
  if (preferred && available.some((a) => a.id === preferred)) return preferred;
  return defaultAppIdFor(role);
}

export const ACTIVE_APP_STORAGE_KEY = "active_app";
