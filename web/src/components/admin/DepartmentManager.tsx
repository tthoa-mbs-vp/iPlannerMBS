import { lazy, Suspense, useMemo, useState } from "react";
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  type DepartmentInput,
  useDeleteDepartment,
  useUsers,
} from "../../hooks/useDepartments";
import { Plus, Pencil, Trash2, Check, X, Building2, Upload, Search } from "lucide-react";
import ExportButton from "../shared/ExportButton";
const ImportModal = lazy(() => import("./ImportModal"));
import {
  exportToExcel,
  exportToCSV,
  exportToJSON,
  DEPT_EXPORT_COLUMNS,
} from "../../utils/importExport";
import type { Department } from "@shared/types";
import { errorMessage } from "../../utils/errors";
import { btn } from "../../utils/buttonClasses";
import Spinner from "../shared/Spinner";
import ManagerHeader from "../shared/ManagerHeader";

export default function DepartmentManager() {
  const { data: departments, isLoading } = useDepartments();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const { data: users } = useUsers();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCounted, setEditCounted] = useState(true);
  const [editLeader, setEditLeader] = useState("");
  const [error, setError] = useState("");

  const startNew = () => {
    setEditingId("new");
    setEditCode("");
    setEditName("");
    setEditCounted(true);
    setEditLeader("");
    setError("");
  };

  const startEdit = (d: Department) => {
    setEditingId(d.id);
    setEditCode(d.code);
    setEditName(d.name);
    setEditCounted(d.is_counted);
    setEditLeader(d.leader_id || "");
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
    setError("");
    try {
      const data: DepartmentInput = {
        code: editCode,
        name: editName,
        is_counted: editCounted,
        leader_id: editLeader || null,
      };
      if (editingId === "new") {
        await createDept.mutateAsync(data);
      } else if (editingId) {
        await updateDept.mutateAsync({ id: editingId, data });
      }
      setEditingId(null);
    } catch (err: unknown) {
      setError(errorMessage(err, "Lỗi"));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xóa phòng ban này?")) await deleteDept.mutateAsync(id);
  };

  const isSaving = createDept.isPending || updateDept.isPending;

  const filteredDepartments = useMemo(() => {
    if (!departments) return [];
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) =>
      d.code.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      (d.expand?.leader_id?.name || "").toLowerCase().includes(q)
    );
  }, [departments, search]);

  return (
    <div>
      <ManagerHeader
        icon={<Building2 className="h-4 w-4 text-white" />}
        gradient="from-sky-500 to-cyan-600"
        shadow="shadow-sky-500/20"
        title="Phòng ban"
        count={departments?.length ?? 0}
        countUnit="phòng ban"
        subtitle="Quản lý cấu trúc phòng ban."
      >
        <div className="relative w-52 shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm phòng ban..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/20 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500" />
        </div>
        <ExportButton
          label="Xuất Excel"
          onExport={(format) => {
            if (!departments) return;
            const data = departments.map((d) => ({
              ...d,
              is_counted: d.is_counted ? "Có" : "Không",
              leader_name: d.expand?.leader_id?.name || d.expand?.leader_id?.email || "",
            }));
            if (format === "xlsx")
              exportToExcel(data, DEPT_EXPORT_COLUMNS, "phong-ban");
            else if (format === "csv")
              exportToCSV(data, DEPT_EXPORT_COLUMNS, "phong-ban");
            else exportToJSON(data, DEPT_EXPORT_COLUMNS, "phong-ban");
          }}
        />
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-600 transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 dark:hover:border-emerald-500/40">
          <Upload className="h-4 w-4" />
          Nhập dữ liệu
        </button>
        {showImport && <Suspense fallback={null}><ImportModal collection="departments" onClose={() => setShowImport(false)} /></Suspense>}
        <button onClick={startNew} className={btn.add}>
          <Plus className="h-4 w-4" /> Thêm phòng ban
        </button>
      </ManagerHeader>

      {isLoading ? (
        <Spinner color="border-indigo-600" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">
                  Mã
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">
                  Tên
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">
                  Lãnh đạo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">
                  Báo cáo
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {editingId === "new" && (
                <tr className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40">
                  <td className="px-4 py-2">
                    <input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                      placeholder="Mã phòng"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                      placeholder="Tên phòng"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editLeader}
                      onChange={(e) => setEditLeader(e.target.value)}
                      className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                    >
                      <option value="">— Chọn lãnh đạo —</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={editCounted}
                      onChange={(e) => setEditCounted(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:text-indigo-400"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {error && (
                      <span className="mr-2 text-xs text-red-500 dark:text-red-400">{error}</span>
                    )}
                    <button onClick={handleSave} disabled={isSaving} aria-label="Lưu" className={btn.save}>
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={cancelEdit} aria-label="Hủy" className={btn.cancel}>
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )}
              {filteredDepartments.map((d) =>
                editingId === d.id ? (
                  <tr
                    key={d.id}
                    className="border-b bg-gradient-to-r from-blue-50 to-indigo-50"
                  >
                    <td className="px-4 py-2">
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editLeader}
                        onChange={(e) => setEditLeader(e.target.value)}
                        className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
                      >
                        <option value="">— Chọn lãnh đạo —</option>
                        {users?.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={editCounted}
                        onChange={(e) => setEditCounted(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:text-indigo-400"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {error && (
                        <span className="mr-2 text-xs text-red-500 dark:text-red-400">
                          {error}
                        </span>
                      )}
                    <button onClick={handleSave} disabled={isSaving} aria-label="Lưu" className={btn.save}>
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={cancelEdit} aria-label="Hủy" className={btn.cancel}>
                      <X className="h-4 w-4" />
                    </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={d.id}
                    className="even:bg-slate-100 hover:bg-gradient-to-r hover:from-slate-50 hover:to-indigo-50 transition-all duration-150 dark:even:bg-slate-800/60 dark:hover:from-slate-800 dark:hover:to-indigo-900/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {d.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {d.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {d.expand?.leader_id?.name || d.expand?.leader_id?.email || (
                        <span className="text-slate-400 italic dark:text-slate-500">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {d.is_counted ? "Có" : "Không"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(d)} className={btn.edit}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(d.id)} className={btn.delete}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {filteredDepartments.length === 0 && editingId !== "new" && (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              {search ? "Không tìm thấy phòng ban phù hợp" : "Chưa có phòng ban"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
