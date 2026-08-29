import { lazy, Suspense, useMemo, useState } from "react";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from "../../hooks/useDepartments";
import { Plus, Pencil, Trash2, Check, X, UserCheck, Upload, Search } from "lucide-react";
import ExportButton from "../shared/ExportButton";
const ImportModal = lazy(() => import("./ImportModal"));
import { exportToExcel, exportToCsv, exportToJson, ROLE_EXPORT_COLUMNS } from "../../utils/importExport";
import type { Role, RoleLevel, ViewScope, ApprovalScope } from "@shared/types";
import { btn } from "../../utils/buttonClasses";
import Spinner from "../shared/Spinner";
import ManagerHeader from "../shared/ManagerHeader";

const LEVEL_OPTIONS = [
  { value: "leadership", label: "Lãnh đạo" },
  { value: "management", label: "Quản lý" },
  { value: "employee", label: "Nhân viên" },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "Toàn bộ" },
  { value: "department", label: "Phòng ban" },
  { value: "group", label: "Tổ chuyên môn" },
  { value: "personal", label: "Cá nhân" },
];

const PERM_FIELDS = [
  { key: "can_add_plans", label: "Thêm kế hoạch" },
  { key: "can_edit_plans", label: "Sửa kế hoạch" },
  { key: "can_delete_plans", label: "Xóa kế hoạch" },
  { key: "can_add_tasks", label: "Thêm nhiệm vụ" },
  { key: "can_edit_tasks", label: "Sửa nhiệm vụ" },
  { key: "can_delete_tasks", label: "Xóa nhiệm vụ" },
  { key: "can_approve_leave", label: "Duyệt đơn nghỉ phép" },
  { key: "can_view_salary", label: "Xem lương / hồ sơ nhân sự" },
];

const APPROVAL_SCOPE_OPTIONS = [
  { value: "department", label: "Phạm vi Phòng ban (< 3 ngày)" },
  { value: "group", label: "Phạm vi Tổ chuyên môn (< 3 ngày)" },
  { value: "all", label: "Phạm vi Toàn bộ (từ 3 ngày)" },
];

export default function RoleManager() {
  const { data: roles, isLoading } = useRoles();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLevel, setEditLevel] = useState("employee");
  const [editScope, setEditScope] = useState("personal");
  const [editApprovalScope, setEditApprovalScope] = useState("department");
  const [editPerms, setEditPerms] = useState({
    can_add_plans: false, can_edit_plans: false, can_delete_plans: false,
    can_add_tasks: false, can_edit_tasks: false, can_delete_tasks: false,
    can_manage: false,
    can_approve_leave: false,
    can_view_salary: false,
  });
  const [error, setError] = useState("");

  const startNew = () => {
    setEditingId("new");
    setEditCode(""); setEditName(""); setEditDesc(""); setEditLevel("employee"); setEditScope("personal"); setEditApprovalScope("department");
    setEditPerms({ can_add_plans: false, can_edit_plans: false, can_delete_plans: false, can_add_tasks: false, can_edit_tasks: false, can_delete_tasks: false, can_manage: false, can_approve_leave: false, can_view_salary: false });
    setError("");
  };

  const startEdit = (r: Role) => {
    setEditingId(r.id);
    setEditCode(r.code); setEditName(r.name); setEditDesc(r.description || ""); setEditLevel(r.level); setEditScope(r.view_scope); setEditApprovalScope(r.approval_scope || "department");
    setEditPerms({
      can_add_plans: r.can_add_plans, can_edit_plans: r.can_edit_plans, can_delete_plans: r.can_delete_plans,
      can_add_tasks: r.can_add_tasks, can_edit_tasks: r.can_edit_tasks, can_delete_tasks: r.can_delete_tasks,
      can_manage: r.can_manage,
      can_approve_leave: r.can_approve_leave,
      can_view_salary: r.can_view_salary,
    });
    setError("");
  };

  const cancelEdit = () => { setEditingId(null); setError(""); };

  const handleSave = async () => {
    if (!editCode || !editName) { setError("Vui lòng nhập mã và tên"); return; }
    setError("");
    const data = { code: editCode, name: editName, description: editDesc || undefined, level: editLevel as RoleLevel, view_scope: editScope as ViewScope, approval_scope: editPerms.can_approve_leave ? (editApprovalScope as ApprovalScope) : undefined, ...editPerms };
    try {
      if (editingId === "new") await createRole.mutateAsync(data);
      else if (editingId) await updateRole.mutateAsync({ id: editingId, data });
      setEditingId(null);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Lỗi"); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xóa chức vụ này?")) await deleteRole.mutateAsync(id);
  };

  const isSaving = createRole.isPending || updateRole.isPending;

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
    );
  }, [roles, search]);

  return (
    <div>
      <ManagerHeader
        icon={<UserCheck className="h-4 w-4 text-white" />}
        gradient="from-amber-500 to-orange-600"
        shadow="shadow-amber-500/20"
        title="Chức vụ & Phân quyền"
        count={roles?.length ?? 0}
        countUnit="chức vụ"
        subtitle="Quản lý chức vụ và phân quyền."
      >
        <div className="relative w-52 shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm chức vụ..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </div>
        <ExportButton
          label="Xuất Excel"
          onExport={(format) => {
              if (!roles) return;
              const data = roles.map((r) => ({
                code: r.code,
                name: r.name,
                level: r.level === "leadership" ? "Lãnh đạo" : r.level === "management" ? "Quản lý" : "Nhân viên",
                view_scope: r.view_scope === "all" ? "Toàn bộ" : r.view_scope === "department" ? "Phòng ban" : r.view_scope === "group" ? "Tổ chuyên môn" : "Cá nhân",
                can_manage: r.can_manage ? "Có" : "Không",
                can_approve_leave: r.can_approve_leave ? "Có" : "Không",
                can_view_salary: r.can_view_salary ? "Có" : "Không",
                approval_scope: r.approval_scope === "all" ? "Toàn bộ" : r.approval_scope === "department" ? "Phòng ban" : r.approval_scope === "group" ? "Tổ chuyên môn" : "—",
              }));
              if (format === "xlsx") exportToExcel(data, ROLE_EXPORT_COLUMNS, "chuc-vu");
              else if (format === "csv") exportToCsv(data, ROLE_EXPORT_COLUMNS, "chuc-vu");
              else exportToJson(data, "chuc-vu");
            }}
          />
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-600 transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 dark:hover:border-emerald-500/40">
            <Upload className="h-4 w-4" />
            Nhập dữ liệu
          </button>
          {showImport && <Suspense fallback={null}><ImportModal collection="roles" onClose={() => setShowImport(false)} /></Suspense>}
          <button onClick={startNew} className={btn.add}>
            <Plus className="h-4 w-4" /> Thêm chức vụ
          </button>
      </ManagerHeader>

      {isLoading ? (
        <Spinner color="border-amber-600" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Mã</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Tên</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Mô tả</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Cấp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Phạm vi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Quyền</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {editingId === "new" && (
                <InlineRoleRow
                  code={editCode} onCodeChange={setEditCode}
                  name={editName} onNameChange={setEditName}
                  desc={editDesc} onDescChange={setEditDesc}
                  level={editLevel} onLevelChange={setEditLevel}
                  scope={editScope} onScopeChange={setEditScope}
                  approvalScope={editApprovalScope} onApprovalScopeChange={setEditApprovalScope}
                  perms={editPerms} onPermsChange={setEditPerms}
                  error={error} isSaving={isSaving} onSave={handleSave} onCancel={cancelEdit} />
              )}
              {filteredRoles.map((r) =>
                editingId === r.id ? (
                  <InlineRoleRow
                    key={r.id}
                    code={editCode} onCodeChange={setEditCode}
                    name={editName} onNameChange={setEditName}
                    desc={editDesc} onDescChange={setEditDesc}
                    level={editLevel} onLevelChange={setEditLevel}
                    scope={editScope} onScopeChange={setEditScope}
                    approvalScope={editApprovalScope} onApprovalScopeChange={setEditApprovalScope}
                    perms={editPerms} onPermsChange={setEditPerms}
                    error={error} isSaving={isSaving} onSave={handleSave} onCancel={cancelEdit} />
                ) : (
                  <tr key={r.id} className="even:bg-slate-100 hover:bg-gradient-to-r hover:from-slate-50 hover:to-amber-50 transition-all duration-150 dark:even:bg-slate-800/60 dark:hover:from-slate-800 dark:hover:to-amber-900/30">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{r.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate dark:text-slate-300" title={r.description || "—"}>{r.description || <span className="text-slate-300 italic dark:text-slate-500">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{LEVEL_OPTIONS.find(o => o.value === r.level)?.label}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{SCOPE_OPTIONS.find(o => o.value === r.view_scope)?.label}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {r.can_manage && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">QT</span>}
                        {(r.can_add_plans || r.can_edit_plans || r.can_delete_plans) && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            KH: {["T","S","X"].filter((_,i) => [r.can_add_plans, r.can_edit_plans, r.can_delete_plans][i]).join("/")}
                          </span>
                        )}
                        {(r.can_add_tasks || r.can_edit_tasks || r.can_delete_tasks) && (
                          <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                            NV: {["T","S","X"].filter((_,i) => [r.can_add_tasks, r.can_edit_tasks, r.can_delete_tasks][i]).join("/")}
                          </span>
                        )}
                        {r.can_approve_leave && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">NP</span>
                        )}
                        {r.can_view_salary && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" title="Xem lương / hồ sơ nhân sự">LƯƠNG</span>
                        )}
                        {!r.can_manage && !r.can_approve_leave && !r.can_add_plans && !r.can_edit_plans && !r.can_delete_plans && !r.can_add_tasks && !r.can_edit_tasks && !r.can_delete_tasks && !r.can_view_salary && (
                          <span className="text-slate-300 italic dark:text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(r)} className={btn.edit} aria-label="Chỉnh sửa"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className={btn.delete} aria-label="Xóa"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {filteredRoles.length === 0 && editingId !== "new" && (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              {search ? "Không tìm thấy chức vụ phù hợp" : "Chưa có chức vụ"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InlineRoleRow({
  code, onCodeChange, name, onNameChange, desc, onDescChange,
  level, onLevelChange, scope, onScopeChange,
  approvalScope, onApprovalScopeChange,
  perms, onPermsChange, error, isSaving, onSave, onCancel,
}: {
  code: string; onCodeChange: (v: string) => void;
  name: string; onNameChange: (v: string) => void;
  desc: string; onDescChange: (v: string) => void;
  level: string; onLevelChange: (v: string) => void;
  scope: string; onScopeChange: (v: string) => void;
  approvalScope: string; onApprovalScopeChange: (v: string) => void;
  perms: Record<string, boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPermsChange: (p: any) => void;
  error: string; isSaving: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <>
      {error && (
        <tr className="border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40">
          <td colSpan={7} className="px-4 pt-2 pb-0"><div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/40 dark:text-red-300">{error}</div></td>
        </tr>
      )}
      <tr className="border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40">
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Mã *</label>
          <input value={code} onChange={(e) => onCodeChange(e.target.value)}
            className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Tên *</label>
          <input value={name} onChange={(e) => onNameChange(e.target.value)}
            className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Mô tả</label>
          <textarea value={desc} onChange={(e) => onDescChange(e.target.value)} rows={2}
            className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Cấp</label>
          <select value={level} onChange={(e) => onLevelChange(e.target.value)}
            className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
            {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Phạm vi</label>
          <select value={scope} onChange={(e) => onScopeChange(e.target.value)}
            className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
            {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Quyền</label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {PERM_FIELDS.map((pf) => (
              <label key={pf.key} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox"
                  checked={!!perms[pf.key]}
                  onChange={(e) => onPermsChange({ ...perms, [pf.key]: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-600 dark:text-amber-400" />
                {pf.label}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <input type="checkbox" checked={perms.can_manage}
                onChange={(e) => onPermsChange({ ...perms, can_manage: e.target.checked })}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-600 dark:text-amber-400" />
              Quản trị hệ thống
            </label>
            {perms.can_approve_leave && (
              <label className="flex items-center gap-1.5 text-xs">
                <span className="font-medium text-violet-700 dark:text-violet-300">Phạm vi duyệt:</span>
                <select value={approvalScope} onChange={(e) => onApprovalScopeChange(e.target.value)}
                  className="rounded border border-violet-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                  {APPROVAL_SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-right">
          <label className="mb-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Thao tác</label>
          <div className="flex items-center justify-end gap-1 pt-1">
            <button type="button" onClick={() => onSave()} disabled={isSaving} className={btn.save} aria-label="Lưu"><Check className="h-4 w-4" /></button>
            <button type="button" onClick={onCancel} className={btn.cancel} aria-label="Hủy"><X className="h-4 w-4" /></button>
          </div>
        </td>
      </tr>
    </>
  );
}
