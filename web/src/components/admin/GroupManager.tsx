import { lazy, Suspense, useMemo, useState } from "react";
import {
  useProfessionalGroups,
  useCreateProfessionalGroup,
  useUpdateProfessionalGroup,
  useDeleteProfessionalGroup,
} from "../../hooks/useProfessionalGroups";
import { useDepartments, useUsers } from "../../hooks/useDepartments";
import { Plus, Pencil, Trash2, Check, X, Network, Upload, Search } from "lucide-react";
import ExportButton from "../shared/ExportButton";
const ImportModal = lazy(() => import("./ImportModal"));
import { exportToExcel, exportToCSV, exportToJSON, GROUP_EXPORT_COLUMNS } from "../../utils/importExport";
import type { ProfessionalGroup, User } from "@shared/types";
import { btn } from "../../utils/buttonClasses";
import Spinner from "../shared/Spinner";
import ManagerHeader from "../shared/ManagerHeader";

export default function GroupManager() {
  const { data: groups, isLoading } = useProfessionalGroups();
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const createGroup = useCreateProfessionalGroup();
  const updateGroup = useUpdateProfessionalGroup();
  const deleteGroup = useDeleteProfessionalGroup();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDept, setEditDept] = useState("");
  const [error, setError] = useState("");

  const membersByGroup = useMemo(() => {
    const m: Record<string, User[]> = {};
    (groups || []).forEach((g) => { m[g.id] = []; });
    (users || []).forEach((u) => {
      (u.group_ids || []).forEach((gid) => {
        if (m[gid]) m[gid].push(u);
      });
    });
    return m;
  }, [groups, users]);

  const startNew = () => {
    setEditingId("new");
    setEditCode("");
    setEditName("");
    setEditDesc("");
    setEditDept("");
    setError("");
  };

  const startEdit = (g: ProfessionalGroup) => {
    setEditingId(g.id);
    setEditCode(g.code);
    setEditName(g.name);
    setEditDesc(g.description || "");
    setEditDept(g.department_id || "");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const handleSave = async () => {
    if (!editCode || !editName) {
      setError("Vui lòng nhập mã và tên");
      return;
    }
    const parentDept = editDept || null;
    if (editingId && editingId !== "new" && parentDept) {
      const currentMembers = membersByGroup[editingId] || [];
      const invalidMembers = currentMembers.filter(
        (u) => u.department_id && u.department_id !== parentDept
      );
      if (invalidMembers.length > 0) {
        setError("Tổ thuộc Phòng ban chỉ chứa nhân sự cùng phòng: " + invalidMembers.slice(0, 3).map((u) => u.name || u.email).join(", ") + (invalidMembers.length > 3 ? "..." : ""));
        return;
      }
    }
    setError("");
    try {
      const data: any = {
        code: editCode,
        name: editName,
        description: editDesc || undefined,
        department_id: parentDept,
      };
      if (editingId === "new") {
        await createGroup.mutateAsync(data);
      } else if (editingId) {
        await updateGroup.mutateAsync({ id: editingId, data });
      }
      setEditingId(null);
    } catch (err: any) {
      setError(err?.message || "Lỗi");
    }
  };

  const handleDelete = async (id: string) => {
    const count = (membersByGroup[id] || []).length;
    const msg = count > 0
      ? `Tổ này có ${count} thành viên. Xóa tổ sẽ khiến các thành viên không còn thuộc tổ nào. Xóa?`
      : "Xóa tổ chuyên môn này?";
    if (confirm(msg)) await deleteGroup.mutateAsync(id);
  };

  const isSaving = createGroup.isPending || updateGroup.isPending;

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) =>
      g.code.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q) ||
      (g.description || "").toLowerCase().includes(q) ||
      (g.expand?.department_id?.name || "").toLowerCase().includes(q)
    );
  }, [groups, search]);

  return (
    <div>
      <ManagerHeader
        icon={<Network className="h-4 w-4 text-white" />}
        gradient="from-teal-500 to-emerald-600"
        shadow="shadow-teal-500/20"
        title="Tổ chuyên môn"
        count={groups?.length ?? 0}
        countUnit="tổ"
        subtitle="Quản lý tổ chuyên môn và nhân sự."
      >
        <div className="relative w-52 shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tổ chuyên môn..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </div>
        <ExportButton
          label="Xuất Excel"
          onExport={(format) => {
            if (!groups) return;
            const data = groups.map((g) => ({
              code: g.code,
              name: g.name,
              description: g.description || "",
              department: g.expand?.department_id?.name || "",
              member_count: (membersByGroup[g.id] || []).length,
            }));
            if (format === "xlsx") exportToExcel(data, GROUP_EXPORT_COLUMNS, "to-chuyen-mon");
            else if (format === "csv") exportToCSV(data, GROUP_EXPORT_COLUMNS, "to-chuyen-mon");
            else exportToJSON(data, GROUP_EXPORT_COLUMNS, "to-chuyen-mon");
          }}
        />
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-600 transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 dark:hover:border-emerald-500/40">
          <Upload className="h-4 w-4" />
          Nhập dữ liệu
        </button>
        {showImport && <Suspense fallback={null}><ImportModal collection="professional_groups" onClose={() => setShowImport(false)} /></Suspense>}
        <button onClick={startNew} className={btn.add}>
          <Plus className="h-4 w-4" /> Thêm tổ chuyên môn
        </button>
      </ManagerHeader>

      {isLoading ? (
        <Spinner color="border-teal-600" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/40 dark:to-emerald-900/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Mã</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Tên</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Mô tả</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Phòng cha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Thành viên</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {editingId === "new" && (
                <InlineGroupRow
                  code={editCode} onCodeChange={setEditCode}
                  name={editName} onNameChange={setEditName}
                  desc={editDesc} onDescChange={setEditDesc}
                  dept={editDept} onDeptChange={setEditDept}
                  departments={departments || []}
                  error={error} isSaving={isSaving} onSave={handleSave} onCancel={cancelEdit} />
              )}
              {filteredGroups.map((g) =>
                editingId === g.id ? (
                  <InlineGroupRow
                    key={g.id}
                    code={editCode} onCodeChange={setEditCode}
                    name={editName} onNameChange={setEditName}
                    desc={editDesc} onDescChange={setEditDesc}
                    dept={editDept} onDeptChange={setEditDept}
                    departments={departments || []}
                    error={error} isSaving={isSaving} onSave={handleSave} onCancel={cancelEdit} />
                ) : (
                  <tr key={g.id} className="even:bg-slate-100 hover:bg-gradient-to-r hover:from-slate-50 hover:to-teal-50 transition-all duration-150 dark:even:bg-slate-800/60 dark:hover:from-slate-800 dark:hover:to-teal-900/30">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{g.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{g.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[220px] truncate dark:text-slate-300" title={g.description || "—"}>{g.description || <span className="text-slate-300 italic dark:text-slate-500">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {g.expand?.department_id?.name || <span className="text-slate-300 italic dark:text-slate-500">Độc lập</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {(membersByGroup[g.id] || []).length === 0 ? (
                        <span className="text-slate-300 italic dark:text-slate-500">—</span>
                      ) : (
                        <span title={(membersByGroup[g.id] || []).map((u) => u.name || u.email).join(", ")}>
                          {(membersByGroup[g.id] || []).length} người
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(g)} className={btn.edit}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(g.id)} className={btn.delete}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {filteredGroups.length === 0 && editingId !== "new" && (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              {search ? "Không tìm thấy tổ chuyên môn phù hợp" : "Chưa có tổ chuyên môn"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InlineGroupRow({
  code, onCodeChange, name, onNameChange, desc, onDescChange,
  dept, onDeptChange, departments, error, isSaving, onSave, onCancel,
}: {
  code: string; onCodeChange: (v: string) => void;
  name: string; onNameChange: (v: string) => void;
  desc: string; onDescChange: (v: string) => void;
  dept: string; onDeptChange: (v: string) => void;
  departments: { id: string; code: string; name: string }[];
  error: string; isSaving: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <>
      {error && (
        <tr className="border-b bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/40 dark:to-emerald-900/40">
          <td colSpan={6} className="px-4 pt-2 pb-0"><div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/40 dark:text-red-300">{error}</div></td>
        </tr>
      )}
      <tr className="border-b bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/40 dark:to-emerald-900/40">
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-teal-700 dark:text-teal-300">Mã *</label>
          <input value={code} onChange={(e) => onCodeChange(e.target.value)}
            className="w-full rounded border border-teal-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="TG01" />
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-teal-700 dark:text-teal-300">Tên *</label>
          <input value={name} onChange={(e) => onNameChange(e.target.value)}
            className="w-full rounded border border-teal-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Tổ Kỹ thuật phần mềm" />
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-teal-700 dark:text-teal-300">Mô tả</label>
          <textarea value={desc} onChange={(e) => onDescChange(e.target.value)} rows={2}
            className="w-full rounded border border-teal-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </td>
        <td className="px-4 py-2">
          <label className="mb-1 block text-xs font-medium text-teal-700 dark:text-teal-300">Phòng cha</label>
          <select value={dept} onChange={(e) => onDeptChange(e.target.value)}
            className="w-full rounded border border-teal-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500">
            <option value="">— Độc lập —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
          </select>
        </td>
        <td className="px-4 py-2">
          <span className="block text-xs text-slate-400 pt-4 dark:text-slate-500">Chỉ nhân sự thuộc phòng cha</span>
        </td>
        <td className="px-4 py-2 text-right">
          <label className="mb-1 block text-xs font-medium text-teal-700 dark:text-teal-300">Thao tác</label>
          <div className="flex items-center justify-end gap-1 pt-1">
            <button type="button" onClick={() => onSave()} disabled={isSaving} className={btn.save}><Check className="h-4 w-4" /></button>
            <button type="button" onClick={onCancel} className={btn.cancel}><X className="h-4 w-4" /></button>
          </div>
        </td>
      </tr>
    </>
  );
}
