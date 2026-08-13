import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const LS_KEY = "sidebar_open";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(LS_KEY);
    return stored !== null ? stored === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50/60 via-slate-50 to-blue-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <Sidebar open={sidebarOpen} />
      <div className="flex flex-1 flex-col min-w-0 transition-all duration-300">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
