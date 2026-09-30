import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { APP_NAME } from "../../config/app";
import {
  LayoutDashboard,
  Sun,
  ClipboardList,
  BarChart3,
  Award,
  MessagesSquare,
  Megaphone,
  Trash2,
  Shield,
  Clock,
  CalendarDays,
  UserCog,
  Activity,
  Database,
  BookOpen,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
  hrOnly?: boolean;
}

interface ExternalItem {
  href: string;
  label: string;
  icon: any;
  external: true;
}

type SidebarItem = NavItem | ExternalItem;
const sections: { title: string; items: SidebarItem[] }[] = [
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
    title: "Quản lý Nhân sự",
    items: [
      { to: "/hr", label: "Nhân sự", icon: UserCog, hrOnly: true },
      { to: "/attendance", label: "Chấm công", icon: Clock },
      { to: "/leave", label: "Nghỉ phép", icon: CalendarDays },
    ],
  },
  {
    title: "Trao đổi",
    items: [
      { to: "/announcements", label: "Bảng tin", icon: Megaphone },
      { to: "/discussion", label: "Trao đổi & Thảo luận", icon: MessagesSquare },
    ],
  },
  {
    title: "Quản trị",
    items: [
      { to: "/admin", label: "Quản trị", icon: Shield, adminOnly: true },
      { to: "/admin/logs", label: "Nhật ký", icon: Activity, adminOnly: true },
      { to: "/admin/data", label: "Dữ liệu", icon: Database, adminOnly: true },
      { to: "/trash", label: "Thùng rác", icon: Trash2, adminOnly: true },
    ],
  },
  {
    title: "Thông tin",
    items: [
      { href: "/huong-dan-su-dung.html", label: "Hướng dẫn", icon: BookOpen, external: true },
    ],
  },
];

export default function Sidebar({ open }: { open: boolean }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const isAdmin = role?.can_manage;
  const canViewSalary = !!role?.can_view_salary;

  // Ở chế độ thu gọn: hover vào sidebar sẽ auto-expand dạng overlay (không đẩy nội dung).
  // Giao diện kính mờ: nền bán trong suốt + backdrop-blur để nội dung phía sau hiện mờ ảo.
  const [hovered, setHovered] = useState(false);
  const expanded = open || hovered;

  return (
    <div className={`relative shrink-0 transition-all duration-300 ${open ? "w-64" : "w-16"}`}>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute inset-y-0 left-0 z-50 flex flex-col border-r border-slate-700/60 bg-slate-900/80 text-white shadow-xl backdrop-blur-xl transition-all duration-300 ${
          expanded ? "w-64" : "w-16"
        }`}
      >
        <div className={`flex h-16 items-center border-b border-slate-700/50 ${expanded ? "justify-between px-6" : "justify-center"}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            {expanded && (
              <span className="text-lg font-bold text-white">{APP_NAME}</span>
            )}
          </div>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto py-4 ${expanded ? "px-3" : "px-2"}`}>
          {sections.map((section, idx) => (
            <div key={section.title}>
              {idx > 0 && !expanded && (
                <div className="mx-auto my-1 h-px w-6 bg-slate-700/60" />
              )}
              {expanded && (
                <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                if ("adminOnly" in item && item.adminOnly && !isAdmin) return null;
                if ("hrOnly" in item && item.hrOnly && !isAdmin && !canViewSalary) return null;
                const Icon = item.icon;
                const linkClasses = (active: boolean) =>
                  `flex items-center rounded-lg text-sm font-medium transition-all duration-200 ${
                    expanded
                      ? "gap-3 px-3.5 py-2.5"
                      : "justify-center px-0 py-3"
                  } ${
                    active
                      ? "bg-slate-700/80 text-white font-semibold"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`;
                if ("external" in item) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={linkClasses(false)}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {expanded && <span>{item.label}</span>}
                    </a>
                  );
                }
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/admin"}
                    title={item.label}
                    className={({ isActive }) => linkClasses(isActive)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {expanded && <span>{item.label}</span>}
                    {expanded && item.adminOnly && (
                      <span className="ml-auto rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                        ADMIN
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
