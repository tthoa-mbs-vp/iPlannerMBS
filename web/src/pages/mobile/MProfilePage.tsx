import { useAuthStore } from "../../stores/authStore";
import { pb } from "../../api/client";
import { useNavigate } from "react-router-dom";
import { useLeaveBalance } from "../../hooks/useLeaveRequests";
import {
  Mail,
  Building2,
  Shield,
  LogOut,
  Calendar,
} from "lucide-react";

export default function MProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { data: leaveBalance } = useLeaveBalance(user?.id);

  const role = user?.expand?.role_id;
  const dept = user?.expand?.department_id;

  const handleLogout = () => {
    logout();
    pb.authStore.clear();
    navigate("/login");
  };

  const items = [
    { icon: Mail, label: "Email", value: user?.email },
    { icon: Building2, label: "Phòng ban", value: dept?.name || "—" },
    { icon: Shield, label: "Vai trò", value: role?.name || "—" },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col items-center py-6">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white shadow-lg">
          {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{user?.name || "Người dùng"}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{role?.name || "Nhân viên"}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 dark:border-slate-700"
            >
              <Icon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.value || "—"}</p>
              </div>
            </div>
          );
        })}
      </div>

      {leaveBalance && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ngày phép còn lại</h3>
          </div>
          <div className="flex items-center justify-between py-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{leaveBalance.year} - {leaveBalance.total_days} ngày</span>
            <span className="font-bold text-indigo-600">{leaveBalance.remaining_days} ngày</span>
          </div>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-900/40"
      >
        <LogOut className="h-4 w-4" />
        Đăng xuất
      </button>

      <div className="pb-4 text-center text-xs text-slate-400 dark:text-slate-500">
        iPlanner PWA v1.0.0
      </div>
    </div>
  );
}
