import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import DataImportExport from "../components/admin/DataImportExport";

export default function DataPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const isAdmin = role?.can_manage;

  useEffect(() => {
    usePageTitleStore.getState().setConfig({ title: "Dữ liệu", backTo: "/admin" });
    return () => { usePageTitleStore.getState().clear(); };
  }, []);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataImportExport />
      </div>
    </div>
  );
}
