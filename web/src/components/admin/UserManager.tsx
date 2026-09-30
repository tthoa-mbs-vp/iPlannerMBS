import { lazy, Suspense, useState } from "react";
import { useAdminUsersPaginated, useDepartments, useRoles } from "../../hooks/useDepartments";
import { useProfessionalGroups } from "../../hooks/useProfessionalGroups";
import { useDebounce } from "../../hooks/useDebounce";
import { errorMessage } from "../../utils/errors";
import { pb } from "../../api/client";

import { useQueryClient } from "@tanstack/react-query";
import { Pencil, RotateCcw, Check, X, Plus, Users as UsersIcon, Upload, Key, Search } from "lucide-react";
import ExportButton from "../shared/ExportButton";
const ImportModal = lazy(() => import("./ImportModal"));
import { exportToExcel, exportToCSV, exportToJSON, USER_EXPORT_COLUMNS } from "../../utils/importExport";
import type { User } from "@shared/types";
import { validatePassword } from "@shared/validators";
import { btn } from "../../utils/buttonClasses";
import Spinner from "../shared/Spinner";
import EmptyState from "../shared/EmptyState";
import Pagination from "../shared/Pagination";
import Modal from "../shared/Modal";
import ManagerHeader from "../shared/ManagerHeader";

export default function UserManager() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [prevSearch, setPrevSearch] = useState(debouncedSearch);
  if (prevSearch !== debouncedSearch) {
    setPrevSearch(debouncedSearch);
    setPage(1);
  }
  const { data: usersData, isLoading } = useAdminUsersPaginated({ page, perPage, search: debouncedSearch });
  const users = usersData?.items ?? [];
  const totalPages = usersData?.totalPages ?? 1;
  const [showImport, setShowImport] = useState(false);
  const { data: departments } = useDepartments();
  const { data: roles } = useRoles();
  const { data: groups } = useProfessionalGroups();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editReminder, setEditReminder] = useState("2");
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const startNew = () => {
    setEditingId("new");
    setEditEmail("");
    setEditName("");
    setEditPassword("");
    setEditDept("");
    setEditRole("");
    setEditReminder("2");
    setEditGroupIds([]);
    setError("");
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditEmail(u.email);
    setEditName(u.name || "");
    setEditPassword("");
    setEditDept(u.department_id || "");
    setEditRole(u.role_id || "");
    setEditReminder(String(u.reminder_days ?? 2));
    setEditGroupIds((u.group_ids || []).filter(Boolean) as string[]);
    setError("");
  };

  const cancelEdit = () => { setEditingId(null); setError(""); };

  const handleSave = async () => {
    if (!editingId) return;
    setError("");
    const incompatible = (groups || []).find(
      (g) => editGroupIds.includes(g.id) && !!g.department_id && g.department_id !== editDept
    );
    if (incompatible) {
      setError(`Nhân sự thuộc tổ "${incompatible.name}" (phòng cha ${incompatible.expand?.department_id?.name || "khác"}) phải thuộc cùng phòng ban`);
      return;
    }
    setIsSaving(true);
    try {
      if (editingId === "new") {
        if (!editEmail || !editPassword) { setError("Vui lòng nhập email và mật khẩu"); setIsSaving(false); return; }
        const pwError = validatePassword(editPassword);
        if (pwError) { setError(pwError); setIsSaving(false); return; }
        await pb.collection("users").create({
          email: editEmail,
          name: editName || undefined,
          password: editPassword,
          passwordConfirm: editPassword,
          department_id: editDept || null,
          role_id: editRole || null,
          group_ids: editGroupIds.length ? editGroupIds : null,
          reminder_days: parseInt(editReminder) || 2,
          emailVisibility: true,
        });
      } else {
        await pb.collection("users").update(editingId, {
          name: editName || undefined,
          department_id: editDept || null,
          role_id: editRole || null,
          group_ids: editGroupIds.length ? editGroupIds : null,
          reminder_days: parseInt(editReminder) || 2,
        });
        await pb.send("/api/custom/change-user-email", {
          method: "POST",
          body: { userId: editingId, email: editEmail },
        });
      }
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditingId(null);
    } catch (err: unknown) { setError(errorMessage(err, "Lỗi")); }
    setIsSaving(false);
  };

  const [adminCreds, setAdminCreds] = useState<{ user: User; action: string } | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);

  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");

  const requestToggleStatus = (user: User) => {
    const action = user.disabled ? "Kích hoạt" : "Vô hiệu hóa";
    if (!window.confirm(`${action} tài khoản ${user.email}?`)) return;
    setAdminCreds({ user, action });
    setAdminEmail("");
    setAdminPassword("");
  };

  const execAdminAction = async () => {
    if (!adminCreds || !adminEmail || !adminPassword) return;
    const { user, action } = adminCreds;
    if (action === "reset_password") {
      if (!resetPassword) { setResetPasswordError("Vui lòng nhập mật khẩu mới"); return; }
      const pwError = validatePassword(resetPassword);
      if (pwError) { setResetPasswordError(pwError); return; }
      if (resetPassword !== resetPasswordConfirm) { setResetPasswordError("Mật khẩu không khớp"); return; }
    }
    setAdminSaving(true);
    setResetPasswordError("");
    try {
      const oldToken = pb.authStore.token;
      const oldModel = pb.authStore.model;
      await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);
      if (action === "reset_password") {
        await pb.collection("users").update(user.id, {
          password: resetPassword,
          passwordConfirm: resetPassword,
        });
      } else {
        await pb.collection("users").update(user.id, { disabled: !user.disabled });
      }
      if (oldToken) pb.authStore.save(oldToken, oldModel);
      qc.invalidateQueries({ queryKey: ["users"] });
      setAdminCreds(null);
      setResetPassword("");
      setResetPasswordConfirm("");
    } catch (err: unknown) { alert(errorMessage(err, "Thao tác thất bại")); }
    finally { setAdminSaving(false); }
  };

  return (
    <div>
      <ManagerHeader
        icon={<UsersIcon className="h-4 w-4 text-white" />}
        gradient="from-violet-500 to-purple-600"
        shadow="shadow-violet-500/20"
        title="Người dùng"
        count={usersData?.totalItems ?? 0}
        countUnit="người"
        subtitle="Quản lý thông tin nhân sự."
      >
        <div className="relative w-52 shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên, email..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </div>
        <ExportButton
          label="Xuất Excel"
          onExport={(format) => {
              pb.collection("users").getFullList<User>({ sort: "-created", expand: "department_id,role_id,group_ids" })
                .then((allUsers) => {
                  const data = allUsers.map((u) => ({
                    email: u.email,
                    name: u.name,
                    department: u.expand?.department_id?.name || "",
                    role: u.expand?.role_id?.name || "",
                    groups: (u.expand?.group_ids || []).map((g) => g.code).join(", "),
                    verified: !u.disabled ? "Hoạt động" : "Vô hiệu",
                    reminder_days: u.reminder_days ?? 2,
                  }));
                  if (format === "xlsx") exportToExcel(data, USER_EXPORT_COLUMNS, "nguoi-dung");
                  else if (format === "csv") exportToCSV(data, USER_EXPORT_COLUMNS, "nguoi-dung");
                  else exportToJSON(data, USER_EXPORT_COLUMNS, "nguoi-dung");
                })
                .catch(() => {});
            }}
          />
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-600 transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 dark:hover:border-emerald-500/40">
            <Upload className="h-4 w-4" />
            Nhập dữ liệu
          </button>
          {showImport && <Suspense fallback={null}><ImportModal collection="users" onClose={() => setShowImport(false)} /></Suspense>}
          <button onClick={startNew} className={btn.add}>
            <Plus className="h-4 w-4" /> Thêm người dùng
          </button>
      </ManagerHeader>

      {isLoading ? (
        <Spinner color="border-indigo-600" />
      ) : users && users.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Người dùng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Phòng ban</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Chức vụ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Tổ chuyên môn</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Nhắc hạn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Trạng thái</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {editingId === "new" && error && (
                <tr className="border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/40">
                  <td colSpan={8} className="px-4 pt-2 pb-0"><div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/40 dark:text-red-300">{error}</div></td>
                </tr>
              )}
              {editingId === "new" && (
                <tr className="border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/40">
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Họ tên</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Nguyễn Văn A" />
                  </td>
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Email *</label>
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="user@mbs.com" />
                  </td>
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Phòng ban</label>
                    <select value={editDept} onChange={(e) => setEditDept(e.target.value)}
                      className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
                      <option value="">—</option>
                      {departments?.map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Chức vụ</label>
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                      className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
                      <option value="">—</option>
                      {roles?.map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Tổ chuyên môn</label>
                    <GroupCheckboxes groups={groups || []} selected={editGroupIds} deptId={editDept} onChange={setEditGroupIds} />
                  </td>
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Nhắc hạn</label>
                    <input type="number" value={editReminder} onChange={(e) => setEditReminder(e.target.value)} min={0} max={30}
                      className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
                  </td>
                  <td className="px-4 py-2">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Mật khẩu *</label>
                    <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="••••••••" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Thao tác</label>
                    <div className="flex items-center justify-end gap-1 pt-1">
                      <button onClick={handleSave} disabled={isSaving} className={btn.save}><Check className="h-4 w-4" /></button>
                      <button onClick={cancelEdit} className={btn.cancel}><X className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              )}
              {users.flatMap((u) => {
                if (editingId === u.id) {
                  const editRow = (
                    <tr key={`${u.id}-edit`} className="border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/40">
                      <td className="px-4 py-2">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Họ tên</label>
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
                      </td>
                      <td className="px-4 py-2">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Email</label>
                        <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
                      </td>
                      <td className="px-4 py-2">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Phòng ban</label>
                        <select value={editDept} onChange={(e) => setEditDept(e.target.value)}
                          className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
                          <option value="">—</option>
                          {departments?.map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Chức vụ</label>
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                          className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
                          <option value="">—</option>
                          {roles?.map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Tổ chuyên môn</label>
                        <GroupCheckboxes groups={groups || []} selected={editGroupIds} deptId={editDept} onChange={setEditGroupIds} />
                      </td>
                      <td className="px-4 py-2">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Nhắc hạn</label>
                        <input type="number" value={editReminder} onChange={(e) => setEditReminder(e.target.value)} min={0} max={30}
                          className="w-full rounded border border-violet-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Trạng thái</label>
                        <div className="flex items-center justify-center pt-1">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${!u.disabled ? "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-300" : "bg-gradient-to-r from-rose-100 to-red-100 text-red-700 dark:from-rose-900/40 dark:to-red-900/40 dark:text-red-300"}`}>
                            {!u.disabled ? "Hoạt động" : "Vô hiệu"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <label className="mb-1 block text-xs font-medium text-violet-700 dark:text-violet-300">Thao tác</label>
                        <div className="flex items-center gap-1 pt-1">
                          <button onClick={handleSave} disabled={isSaving} className={btn.save}><Check className="h-4 w-4" /></button>
                          <button onClick={cancelEdit} className={btn.cancel}><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                  const errRow = error ? (
                    <tr key={`${u.id}-err`} className="border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/40">
                      <td colSpan={8} className="px-4 pt-2 pb-0"><div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/40 dark:text-red-300">{error}</div></td>
                    </tr>
                  ) : null;
                  return errRow ? [errRow, editRow] : [editRow];
                }
                return [(
                  <tr key={u.id} className="even:bg-slate-100 hover:bg-gradient-to-r hover:from-slate-50 hover:to-violet-50 transition-all duration-150 dark:even:bg-slate-800/60 dark:hover:from-slate-800 dark:hover:to-violet-900/30">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{u.name || u.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {u.expand?.department_id?.name || <span className="text-slate-300 dark:text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {u.expand?.role_id?.name || <span className="text-slate-300 dark:text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {(u.expand?.group_ids || []).length === 0 ? (
                        <span className="text-slate-300 dark:text-slate-500">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(u.expand?.group_ids || []).map((g) => (
                            <span key={g.id} className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" title={g.department_id ? `Phòng cha: ${g.expand?.department_id?.name || "—"}` : "Tổ độc lập"}>
                              {g.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{u.reminder_days || 2} ngày</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${!u.disabled ? "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-300" : "bg-gradient-to-r from-rose-100 to-red-100 text-red-700 dark:from-rose-900/40 dark:to-red-900/40 dark:text-red-300"}`}>
                        {!u.disabled ? "Hoạt động" : "Vô hiệu"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(u)} className={btn.edit} title="Sửa">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setAdminCreds({ user: u, action: "reset_password" }); setAdminEmail(""); setAdminPassword(""); }} className={btn.edit} title="Đặt lại mật khẩu">
                        <Key className="h-4 w-4" />
                      </button>
                      <button onClick={() => requestToggleStatus(u)} className={btn.delete} title={!u.disabled ? "Vô hiệu hóa" : "Kích hoạt"}>
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </td>
                    </tr>
                  )];
                })}
            </tbody>
          </table>
          {users.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              pageSize={perPage}
              onPageSizeChange={(s) => { setPerPage(s); setPage(1); }}
              totalCount={usersData?.totalItems ?? 0}
            />
          )}
        </div>
      ) : (
        <EmptyState icon={UsersIcon} message="Chưa có người dùng" size="sm" />
      )}

      {adminCreds && (
        <Modal title={adminCreds.action === "reset_password" ? "Đặt lại mật khẩu" : `Xác nhận ${adminCreds.action.toLowerCase()}`} onClose={() => { setAdminCreds(null); setResetPassword(""); setResetPasswordConfirm(""); setResetPasswordError(""); }} maxWidth="sm">
          <div className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {adminCreds.action === "reset_password"
                ? `Đặt mật khẩu mới cho ${adminCreds.user.email}`
                : `Nhập thông tin admin để xác thực`}
            </p>
            {resetPasswordError && <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/40 dark:text-red-300">{resetPasswordError}</div>}
            <div className="mt-4 space-y-3">
              {adminCreds.action === "reset_password" && (
                <>
                  <input type="password" placeholder="Mật khẩu mới *" value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" autoFocus />
                  <input type="password" placeholder="Xác nhận mật khẩu *" value={resetPasswordConfirm}
                    onChange={(e) => setResetPasswordConfirm(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
                </>
              )}
              <input type="email" placeholder="Email admin" value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                autoFocus={adminCreds.action !== "reset_password"} />
              <input type="password" placeholder="Mật khẩu admin" value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setAdminCreds(null); setResetPassword(""); setResetPasswordConfirm(""); setResetPasswordError(""); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                Hủy
              </button>
              <button onClick={execAdminAction} disabled={adminSaving || !adminEmail || !adminPassword}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {adminSaving ? "Đang xử lý..." : adminCreds.action === "reset_password" ? "Lưu mật khẩu" : "Xác nhận"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GroupCheckboxes({
  groups,
  selected,
  deptId,
  onChange,
}: {
  groups: { id: string; code: string; name: string; department_id?: string }[];
  selected: string[];
  deptId: string;
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  if (groups.length === 0) {
    return <span className="text-xs text-slate-300 italic dark:text-slate-500">Chưa có tổ chuyên môn</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {groups.map((g) => {
        const allowed = !g.department_id || g.department_id === deptId;
        return (
          <label key={g.id} className={`flex items-center gap-1.5 text-xs ${allowed ? "" : "opacity-40"}`} title={!allowed ? `Tổ thuộc phòng khác (${g.name})` : g.name}>
            <input
              type="checkbox"
              checked={selected.includes(g.id)}
              disabled={!allowed}
              onChange={() => toggle(g.id)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-600 dark:text-teal-400"
            />
            {g.code}
          </label>
        );
      })}
    </div>
  );
}
