import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  User,
  Bell,
  Sun,
  Moon,
  Monitor,
  Award,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUnreadCount } from "../../hooks/useNotifications";
import { useTheme } from "../../hooks/useTheme";
import { APP_NAME } from "../../config/app";
import { isMobileDevice } from "../../utils/device";

const tabs = [
  { to: "/m", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/m/tasks", label: "Việc của tôi", icon: ClipboardList },
  { to: "/m/kpi", label: "KPI", icon: Award },
  { to: "/m/profile", label: "Cá nhân", icon: User },
];

export default function MLayout() {
  const user = useAuthStore((s) => s.user);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { mode, cycle } = useTheme();

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{APP_NAME}</h1>
        <div className="flex items-center gap-2">
          {!isMobileDevice() && (
            <Link
              to="/dashboard?device=desktop"
              className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:block"
            >
              Web đầy đủ
            </Link>
          )}
          <button
            onClick={cycle}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Chuyển giao diện"
            title={mode === "dark" ? "Tối" : mode === "light" ? "Sáng" : "Hệ thống"}
          >
            {mode === "dark" ? <Sun className="h-5 w-5" /> : mode === "light" ? <Moon className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>
          <Link
            to="/m/notifications"
            className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Thông báo"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-red-400 to-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="flex items-center border-t border-slate-200 bg-white px-1 pb-safe dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
