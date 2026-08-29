import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import SurpriseCheckModal from "../surprise/SurpriseCheckModal";

const LS_KEY = "sidebar_open";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function AppLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(LS_KEY);
    return stored !== null ? stored === "true" : true;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(LS_KEY, String(sidebarOpen));
    }
  }, [sidebarOpen, isMobile]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50/60 via-slate-50 to-blue-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar open={sidebarOpen} />}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <Sidebar open={true} mobile onCloseMobile={closeMobile} />
      )}

      <div className="flex flex-1 flex-col min-w-0 transition-all duration-300">
        <Header
          onToggleSidebar={() => {
            if (isMobile) {
              setMobileOpen((o) => !o);
            } else {
              setSidebarOpen((o) => !o);
            }
          }}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <SurpriseCheckModal />
    </div>
  );
}
