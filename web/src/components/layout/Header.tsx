import { useState } from "react";
import { ArrowLeft, Menu, User, LogOut, Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { usePageTitleStore } from "../../stores/pageTitleStore";
import { getUserAvatar } from "../../api/client";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useTheme, type ThemeMode } from "../../hooks/useTheme";
import NotificationDropdown from "./NotificationDropdown";
import { APP_NAME } from "../../config/app";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Hệ thống", icon: Monitor },
];

export default function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const avatarUrl = user ? getUserAvatar(user) : undefined;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useOutsideClick<HTMLDivElement>(() => setMenuOpen(false));
  const title = usePageTitleStore((s) => s.title);
  const backTo = usePageTitleStore((s) => s.backTo);
  const badge = usePageTitleStore((s) => s.badge);
  const { mode, setMode } = useTheme();

  return (
    <header className="relative z-30 flex h-14 sm:h-16 items-center justify-between glass-header px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Chuyển đổi thanh điều hướng"
          className="rounded-xl p-2 text-slate-500 transition-all duration-200 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-600 active:scale-95 dark:text-slate-400 dark:hover:text-indigo-300 dark:hover:from-indigo-950/40 dark:hover:to-purple-950/40"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block h-6 w-px bg-indigo-100" />
        {backTo && (
          typeof backTo === "string" ? (
            <Link to={backTo} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button onClick={backTo} aria-label="Quay lại" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )
        )}
        <h1 className="text-sm sm:text-lg font-bold text-indigo-700 dark:text-indigo-300 truncate">
          {title || APP_NAME}
        </h1>
        {badge && (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <NotificationDropdown />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 rounded-lg transition-all duration-200 hover:bg-slate-50 px-2 py-1.5 dark:hover:bg-slate-800"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user?.expand?.role_id?.name || user?.expand?.department_id?.name}
              </p>
            </div>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-9 w-9 rounded-full object-cover ring-2 ring-indigo-200/50 dark:ring-indigo-500/30 shadow-md"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-200/50 dark:ring-indigo-500/30">
                {(user?.name || user?.email)?.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl glass-panel animate-in fade-in slide-in-from-top-2">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.name || user?.email}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {user?.expand?.department_id?.name && `${user.expand.department_id.name}`}
                  {user?.expand?.department_id?.name && user?.expand?.role_id?.name && " · "}
                  {user?.expand?.role_id?.name}
                </p>
              </div>
              <div className="p-1">
                <Link to={user ? `/hr/${user.id}` : "/profile"} onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
                >
                  <User className="h-4 w-4" />
                  Thông tin cá nhân
                </Link>
              </div>
              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Giao diện</p>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.value} onClick={() => setMode(opt.value)}
                        title={opt.label}
                        className={`flex flex-1 items-center justify-center rounded-md px-2 py-1.5 transition-colors ${
                          mode === opt.value
                            ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-600 dark:text-indigo-300"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}>
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-1">
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
