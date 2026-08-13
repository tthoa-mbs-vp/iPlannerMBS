import { useEffect } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { Navigate } from "react-router-dom";
import { Building2, Users, UserCheck, Network, Radio } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import DepartmentManager from "../components/admin/DepartmentManager";
import RoleManager from "../components/admin/RoleManager";
import UserManager from "../components/admin/UserManager";
import GroupManager from "../components/admin/GroupManager";
import PresenceManager from "../components/admin/PresenceManager";
import TabBar, { type Tab } from "../components/shared/TabBar";

type AdminTab =
  | "departments"
  | "roles"
  | "groups"
  | "users"
  | "presence";

const tabs: Tab[] = [
  { key: "departments", label: "Phòng ban", icon: Building2, gradient: "from-sky-500 to-cyan-600" },
  { key: "groups", label: "Tổ chuyên môn", icon: Network, gradient: "from-teal-500 to-emerald-600" },
  { key: "roles", label: "Chức vụ", icon: UserCheck, gradient: "from-amber-500 to-orange-600" },
  { key: "users", label: "Người dùng", icon: Users, gradient: "from-violet-500 to-purple-600" },
  { key: "presence", label: "Kiểm tra hiện diện", icon: Radio, gradient: "from-rose-500 to-red-600" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = usePersistedState<AdminTab>("admin_tab", "departments");
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const isAdmin = role?.can_manage;

  useEffect(() => { usePageTitleStore.getState().setTitle("Quản trị hệ thống"); }, []);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <TabBar variant="page" tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as AdminTab)} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {activeTab === "departments" && <DepartmentManager />}
        {activeTab === "groups" && <GroupManager />}
        {activeTab === "roles" && <RoleManager />}
        {activeTab === "users" && <UserManager />}
        {activeTab === "presence" && <PresenceManager />}
      </div>
    </div>
  );
}
