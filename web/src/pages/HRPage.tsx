import { useEffect, useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  UserCog,
  Phone,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  Network,
  Users2,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useAdminUsersPaginated, useDepartments, useRoles } from "../hooks/useDepartments";
import { useProfessionalGroups } from "../hooks/useProfessionalGroups";
import { useEmployeeProfiles } from "../hooks/useEmployeeProfiles";
import { useDebounce } from "../hooks/useDebounce";
import { getUserAvatar } from "../api/client";
import { formatDate, contractLabel } from "../utils/format";
import type { EmployeeProfile } from "@shared/types";
import Spinner from "../components/shared/Spinner";
import EmptyState from "../components/shared/EmptyState";

export default function HRPage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const role = authUser?.expand?.role_id;
  const isAdmin = role?.can_manage;
  const canViewSalary = !!role?.can_view_salary;
  const canAccessHr = isAdmin || canViewSalary;

  const { data: departments } = useDepartments();
  const { data: roles } = useRoles();
  const { data: groups } = useProfessionalGroups();

  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 30;

  const debouncedSearch = useDebounce(search, 300);

  const resetKey = `${debouncedSearch}|${selectedDeptId}|${selectedGroupId}|${selectedRoleId}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const groupsByDept = useMemo(() => {
    const map: Record<string, typeof groups> = {};
    (groups || []).forEach((g) => {
      if (!g.department_id) return;
      (map[g.department_id] ||= []).push(g);
    });
    return map;
  }, [groups]);

  const standaloneGroups = useMemo(
    () => (groups || []).filter((g) => !g.department_id),
    [groups]
  );

  const { data: usersData, isLoading: usersLoading } = useAdminUsersPaginated({
    page,
    perPage,
    search: debouncedSearch,
    deptFilter: selectedDeptId || undefined,
    groupFilter: selectedGroupId || undefined,
    roleFilter: selectedRoleId || undefined,
  });

  const users = usersData?.items ?? [];
  const totalPages = usersData?.totalPages ?? 1;
  const totalItems = usersData?.totalItems ?? 0;

  const { data: profiles } = useEmployeeProfiles();

  const profileMap = useMemo(() => {
    const map = new Map<string, EmployeeProfile>();
    profiles?.forEach((p) => map.set(p.user_id, p));
    return map;
  }, [profiles]);

  useEffect(() => {
    usePageTitleStore.getState().setTitle("Quản lý nhân sự");
  }, []);

  if (!canAccessHr) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-auto lg:h-[calc(100vh-7rem)]">
      {/* Left panel: Departments */}
      <div className="w-full lg:w-72 min-w-0 flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900 lg:h-full h-[40vh]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-bold text-indigo-800 dark:text-indigo-300">Phòng ban</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDeptId(""); setSelectedGroupId(""); setPage(1); } }} onClick={() => { setSelectedDeptId(""); setSelectedGroupId(""); setPage(1); }}
            className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all ${
              !selectedDeptId && !selectedGroupId
                ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/30"
                : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            }`}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
                <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tất cả phòng ban</span>
            </div>
          </div>
          {departments?.map((dept) => {
            const deptGroups = groupsByDept[dept.id] || [];
            return (
              <div key={dept.id}>
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDeptId(dept.id); setSelectedGroupId(""); setPage(1); } }} onClick={() => { setSelectedDeptId(dept.id); setSelectedGroupId(""); setPage(1); }}
                  className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all ${
                    selectedDeptId === dept.id
                      ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/30"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{dept.name}</span>
                    {deptGroups.length > 0 && (
                      <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" title={`${deptGroups.length} tổ chuyên môn`}>
                        {deptGroups.length}
                      </span>
                    )}
                  </div>
                </div>
                {deptGroups.length > 0 && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-100 pl-2 dark:border-slate-700">
                    {deptGroups.map((g) => (
                      <div key={g.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedGroupId(g.id); setSelectedDeptId(""); setPage(1); } }} onClick={() => { setSelectedGroupId(g.id); setSelectedDeptId(""); setPage(1); }}
                        className={`w-full rounded-lg border p-2 text-left cursor-pointer transition-all ${
                          selectedGroupId === g.id
                            ? "border-teal-300 bg-teal-50 shadow-sm dark:border-teal-700 dark:bg-teal-900/30"
                            : "border-transparent hover:border-teal-200 hover:bg-teal-50/50 dark:hover:border-teal-800 dark:hover:bg-teal-900/20"
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-100 dark:bg-teal-900/40">
                            <Network className="h-3 w-3 text-teal-600 dark:text-teal-300" />
                          </div>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{g.code} - {g.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {standaloneGroups.length > 0 && (
            <>
              <div className="px-1 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Tổ chuyên môn độc lập
              </div>
              {standaloneGroups.map((g) => (
                <div key={g.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedGroupId(g.id); setSelectedDeptId(""); setPage(1); } }} onClick={() => { setSelectedGroupId(g.id); setSelectedDeptId(""); setPage(1); }}
                  className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all ${
                    selectedGroupId === g.id
                      ? "border-teal-300 bg-teal-50 shadow-sm dark:border-teal-700 dark:bg-teal-900/30"
                      : "border-transparent hover:border-teal-200 hover:bg-teal-50/50 dark:hover:border-teal-800 dark:hover:bg-teal-900/20"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                      <Users2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{g.code} - {g.name}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right panel: Employee list */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-sm">
              <UserCog className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {selectedGroupId
                  ? groups?.find((g) => g.id === selectedGroupId)?.name || "Nhân sự"
                  : selectedDeptId
                    ? departments?.find((d) => d.id === selectedDeptId)?.name || "Nhân sự"
                    : "Tất cả nhân sự"}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{totalItems} nhân viên</p>
            </div>
          </div>
        </div>

        {/* Search & filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-700">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500" />
          </div>
          <select value={selectedRoleId} onChange={(e) => { setSelectedRoleId(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <option value="">Tất cả chức vụ</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {usersLoading && page === 1 ? (
            <Spinner color="border-indigo-600" />
          ) : users.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-50 to-violet-50 sticky top-0 dark:from-indigo-950/50 dark:to-violet-950/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Nhân viên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Phòng ban</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Tổ chuyên môn</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Chức vụ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300"><Phone className="inline h-3.5 w-3.5 mr-1" />SĐT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300"><Calendar className="inline h-3.5 w-3.5 mr-1" />Ngày vào</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Hợp đồng</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const profile = profileMap.get(u.id);
                  const avatar = getUserAvatar(u);
                  return (
                    <tr key={u.id} onClick={() => navigate(`/hr/${u.id}`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/hr/${u.id}`); } }} tabIndex={0} aria-label={`Xem chi tiết ${u.name || u.email}`}
                      className="cursor-pointer border-b border-slate-100 transition-all duration-150 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-violet-50/50 dark:border-slate-800 dark:hover:from-indigo-950/20 dark:hover:to-violet-950/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {avatar ? (
                            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{u.name || u.email}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {u.expand?.department_id?.name || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {(u.expand?.group_ids || []).length === 0 ? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(u.expand?.group_ids || []).map((g) => (
                              <span key={g.id} className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                                {g.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {u.expand?.role_id?.name || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {profile?.phone || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(profile?.join_date)}
                      </td>
                      <td className="px-4 py-3">
                        {profile?.contract_type ? (
                          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {contractLabel(profile.contract_type)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          !u.disabled
                            ? "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-300"
                            : "bg-gradient-to-r from-rose-100 to-red-100 text-red-700 dark:from-rose-900/40 dark:to-red-900/40 dark:text-rose-300"
                        }`}>
                          {!u.disabled ? "Hoạt động" : "Vô hiệu"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={Users} message={search ? "Không tìm thấy nhân viên phù hợp" : "Chưa có nhân viên nào"} />
          )}
        </div>

        {/* Pagination */}
        {users.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-700">
            <span className="text-sm text-slate-500 dark:text-slate-400">Trang {page} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                      pageNum === page
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}>{pageNum}</button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
