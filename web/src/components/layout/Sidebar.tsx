import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, X } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { APP_NAME } from "../../config/app";
import { useActiveApp } from "../../hooks/useActiveApp";

interface SidebarProps {
  open: boolean;
  /** Drawer mode for narrow screens — no hover-expand, overlay on top of content. */
  mobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ open, mobile, onCloseMobile }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const { apps, app, setAppId } = useActiveApp(role);
  const location = useLocation();

  // Ở chế độ thu gọn: hover vào sidebar sẽ auto-expand dạng overlay (không đẩy nội dung).
  // Giao diện kính mờ: nền bán trong suốt + backdrop-blur để nội dung phía sau hiện mờ ảo.
  const [hovered, setHovered] = useState(false);
  // Drawer luôn mở rộng; chỉ sidebar desktop mới dùng hover-expand.
  const expanded = mobile ? true : open || hovered;

  // Drawer phải tự đóng sau khi điều hướng, nếu không menu che màn hình.
  useEffect(() => {
    if (mobile && onCloseMobile) onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (mobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
        <aside className="glass-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col text-white shadow-2xl transition-transform duration-300 lg:hidden">
          <SidebarContent
            expanded
            apps={apps}
            appName={app?.name ?? APP_NAME}
            onSwitchApp={setAppId}
            onCloseMobile={onCloseMobile}
          />
        </aside>
      </>
    );
  }

  return (
    <div className={`relative hidden shrink-0 transition-all duration-300 lg:block ${open ? "w-64" : "w-16"}`}>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`glass-sidebar absolute inset-y-0 left-0 z-50 flex flex-col text-white transition-all duration-300 ${
          expanded ? "w-64" : "w-16"
        }`}
      >
        <SidebarContent
          expanded={expanded}
          apps={apps}
          appName={app?.name ?? APP_NAME}
          onSwitchApp={setAppId}
        />
      </aside>
    </div>
  );
}

function SidebarContent({
  expanded,
  apps,
  appName,
  onSwitchApp,
  onCloseMobile,
}: {
  expanded: boolean;
  apps: ReturnType<typeof useActiveApp>["apps"];
  appName: string;
  onSwitchApp: (id: string) => void;
  onCloseMobile?: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const { app } = useActiveApp(role);
  const isAdmin = !!role?.can_manage;
  const canViewSalary = !!role?.can_view_salary;

  // Chuyển app = đổi nghiệp vụ đang mở, nên phải đưa người dùng về trang chủ app mới;
  // giữ nguyên trang của app cũ sẽ bị AppBoundary đưa về app cũ ngay lập tức.
  const handleSwitch = (id: string) => {
    const target = apps.find((a) => a.id === id);
    const changed = !!target && !!app && target.id !== app.id;
    onSwitchApp(id);
    if (changed && target) navigate(target.home);
  };

  return (
    <>
      <div className={`flex h-16 items-center border-b border-slate-700/50 ${expanded ? "justify-between px-6" : "justify-center"}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
            <ClipboardList className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          {expanded && (
            <span className="truncate text-lg font-bold text-white" title={appName}>
              {appName}
            </span>
          )}
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Ô chuyển app — chỉ hiện khi người dùng được vào từ 2 app trở lên. */}
      {expanded && apps.length > 1 && (
        <div className="border-b border-slate-700/50 px-3 py-3">
          <label htmlFor="app-switcher" className="sr-only">
            Chuyển ứng dụng
          </label>
          <div className="relative">
            <select
              id="app-switcher"
              value={app?.id ?? ""}
              onChange={(e) => handleSwitch(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/70 py-2 pl-3 pr-8 text-sm font-medium text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id} className="bg-slate-800">
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
          </div>
          {app && (
            <p className="mt-2 px-1 text-[11px] leading-snug text-slate-400">{app.tagline}</p>
          )}
        </div>
      )}

      <nav className={`flex-1 space-y-1 overflow-y-auto py-4 ${expanded ? "px-3" : "px-2"}`}>
        {app?.sections.map((section, idx) => (
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
              if (item.adminOnly && !isAdmin) return null;
              if (item.hrOnly && !isAdmin && !canViewSalary) return null;
              const Icon = item.icon;
              const linkClasses = (active: boolean) =>
                `flex items-center rounded-lg text-sm font-medium transition-all duration-200 ${
                  expanded ? "gap-3 px-3.5 py-2.5" : "justify-center px-0 py-3"
                } ${
                  active
                    ? "bg-slate-700/80 text-white font-semibold"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`;
              if (item.href) {
                return (
                  <a key={item.href} href={item.href} title={item.label} className={linkClasses(false)}>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {expanded && <span>{item.label}</span>}
                  </a>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to ?? "#"}
                  end={item.to === "/admin"}
                  title={item.label}
                  className={({ isActive }) => linkClasses(isActive)}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
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
    </>
  );
}
