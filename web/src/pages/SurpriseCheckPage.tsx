import { useEffect } from "react";
import SurpriseCheckAdmin from "../components/surprise/SurpriseCheckAdmin";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useAuthStore } from "../stores/authStore";

export default function SurpriseCheckPage() {
  const setConfig = usePageTitleStore((s) => s.setConfig);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setConfig({ title: "Kiểm tra đột xuất", backTo: "/dashboard" });
    return () => { setConfig({ title: "", backTo: null }); };
  }, [setConfig]);

  // Only admin can access this page
  if (!user?.expand?.role_id?.can_manage) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500 dark:text-slate-400">
          Bạn không có quyền truy cập trang này
        </p>
      </div>
    );
  }

  return <SurpriseCheckAdmin />;
}
