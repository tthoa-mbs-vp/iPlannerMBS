import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePlans, useCreatePlan, useUpdatePlan, useSoftDeletePlan, useBulkSoftDeletePlans } from "../hooks/usePlans";
import { useTasks, useCreateTask, useBulkSoftDeleteTasks } from "../hooks/useTasks";
import { useDepartments, useUsers } from "../hooks/useDepartments";
import { useProfessionalGroups } from "../hooks/useProfessionalGroups";
import { pb } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import {
  Plus, ClipboardList, Pencil, Trash2, CheckSquare, Upload, Building2,
  ChevronRight, Users, ExternalLink, Columns2, Table2, CalendarDays, GripVertical, X,
} from "lucide-react";
import KanbanBoard from "../components/plans/KanbanBoard";
import CalendarView from "../components/plans/CalendarView";
import PlanInlineForm from "../components/plans/PlanInlineForm";
import TaskInlineForm from "../components/tasks/TaskInlineForm";
import TaskRow from "../components/plans/TaskRow";
import ExportMenu from "../components/plans/ExportMenu";
import PlanFiltersDropdown from "../components/plans/PlanFiltersDropdown";
import TaskFiltersDropdown from "../components/plans/TaskFiltersDropdown";
import Pagination from "../components/shared/Pagination";
const ImportModal = lazy(() => import("../components/admin/ImportModal"));
import { exportToExcel, exportToCSV, exportToJSON, PLAN_EXPORT_COLUMNS, TASK_EXPORT_COLUMNS } from "../utils/importExport";
import { exportToPdfPlans, exportToPdfTasks } from "../utils/pdfExports";
import type { Task, Department, Plan, PlanStatus } from "@shared/types";
import { PLAN_STATUS_LABELS, PLAN_STATUS_STYLES } from "../utils/constants";
import { planInUserGroups, taskInUserGroups, userGroupIds } from "../utils/groupScope";
import { useDebounce } from "../hooks/useDebounce";
import { usePersistedState } from "../hooks/usePersistedState";



export default function PlansPage() {  const navigate = useNavigate();
  const [search, setSearch] = usePersistedState("plans_search", "");
  const debouncedSearch = useDebounce(search, 300);
  const [showImport, setShowImport] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedVirtualDept, setSelectedVirtualDept] = useState<string | null>(null);
  const [showTaskImport, setShowTaskImport] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = usePersistedState("plans_taskStatusFilter", "");
  const [taskSearchFilter, setTaskSearchFilter] = usePersistedState("plans_taskSearchFilter", "");
  const debouncedTaskSearch = useDebounce(taskSearchFilter, 300);
  const [deadlineFrom, setDeadlineFrom] = usePersistedState("plans_deadlineFrom", "");
  const [deadlineTo, setDeadlineTo] = usePersistedState("plans_deadlineTo", "");
  const [deptFilters, setDeptFilters] = usePersistedState<string[]>("plans_deptFilters", []);
  const [groupFilters, setGroupFilters] = usePersistedState<string[]>("plans_groupFilters", []);
  const [planStatusFilters, setPlanStatusFilters] = usePersistedState<string[]>("plans_planStatusFilters", []);
  const [personFilters, setPersonFilters] = usePersistedState<string[]>("plans_personFilters", []);
  const [plansPageSize, setPlansPageSize] = usePersistedState("plans_pageSize", 10);
  const [plansPage, setPlansPage] = useState(1);
  const [tasksPageSize, setTasksPageSize] = usePersistedState("plans_tasksPageSize", 10);
  const [tasksPage, setTasksPage] = useState(1);
  const [viewMode, setViewMode] = usePersistedState<"table" | "kanban" | "calendar">("plans_viewMode", "table");
  const [leftWidth, setLeftWidth] = usePersistedState("plans_leftWidth", 33);
  const [dragging, setDragging] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => setDragging(true), []);
  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(60, Math.max(20, pct)));
  }, [dragging, setLeftWidth]);

  const ALL_KEY = "__all__";
  const searchFilter = debouncedSearch ? `name~"${debouncedSearch.replace(/[\\"]/g, '\\$&')}"` : "";
  const { data: allPlans, isLoading: plansLoading, isError: plansError } = usePlans(searchFilter || undefined);
  const deletePlan = useSoftDeletePlan();
  const bulkDeletePlans = useBulkSoftDeletePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const bulkDeleteTasks = useBulkSoftDeleteTasks();
  const createTask = useCreateTask();
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const { data: groups } = useProfessionalGroups();
  const { data: unassignedTasks } = useTasks('plan_id=""');

  const user = useAuthStore((s) => s.user);
  const viewScope = user?.expand?.role_id?.view_scope;
  const userDeptId = user?.expand?.department_id?.id;
  const myGroupIds = userGroupIds(user);
  const canAddPlans = user?.expand?.role_id?.can_add_plans;
  const canEditPlans = user?.expand?.role_id?.can_edit_plans;
  const canDeletePlans = user?.expand?.role_id?.can_delete_plans;
  const canAddTasks = user?.expand?.role_id?.can_add_tasks;
  const canDeleteTasks = user?.expand?.role_id?.can_delete_tasks;

  const { data: personalTasks } = useQuery({
    queryKey: ["tasks", "personal", user?.id],
    queryFn: async () => {
      if (!pb.authStore.isValid) throw new Error("Not authenticated");
      const filter = `is_deleted=false && (executor_id="${user!.id}" || supervisor_id="${user!.id}" || collaborator_ids~"${user!.id}")`;
      return pb.collection("tasks").getFullList(200, {
        sort: "-created",
        filter,
        fields: "id,plan_id",
        // Bắt buộc: nếu không, PocketBase tự suy ra cancelKey là
        // method + path (KHÔNG kèm query string), nên mọi query của cùng
        // collection sẽ hủy lẫn nhau dù filter khác nhau.
        requestKey: `tasks-personal-${user!.id}`,
      });
    },
    enabled: viewScope === "personal",
    staleTime: 30_000,
  });

  const plans = useMemo(() => {
    if (!allPlans) return [];
    let list: Plan[];
    if (viewScope === "all") list = allPlans;
    else if (viewScope === "group") list = allPlans.filter((p) => planInUserGroups(p, myGroupIds));
    else if (viewScope === "personal") {
      if (!personalTasks || personalTasks.length === 0) list = allPlans.filter((p) => p.leader_id === user?.id);
      else {
        const planIds = new Set(personalTasks.map((t) => t.plan_id).filter(Boolean));
        list = allPlans.filter((p) => planIds.has(p.id) || p.leader_id === user?.id);
      }
    } else {
      if (!userDeptId) return [];
      list = allPlans.filter((p) => p.host_dept_id === userDeptId || (p.partner_dept_ids || []).includes(userDeptId));
    }
    if (deptFilters.length || groupFilters.length) {
      list = list.filter((p) => {
        if (deptFilters.length && !(deptFilters.includes(p.host_dept_id) || (p.partner_dept_ids || []).some((id) => deptFilters.includes(id)))) return false;
        if (groupFilters.length && p.group_id && !groupFilters.includes(p.group_id)) return false;
        return true;
      });
    }
    if (planStatusFilters.length) list = list.filter((p) => planStatusFilters.includes(p.status));
    return list;
  }, [allPlans, viewScope, userDeptId, personalTasks, user, myGroupIds, deptFilters, groupFilters, planStatusFilters]);

  const deptMap = useMemo(() => {
    const m: Record<string, Department> = {};
    (departments || []).forEach((d) => { m[d.id] = d; });
    return m;
  }, [departments]);

  const selectedPlanData = useMemo(() =>
    selectedPlanId && selectedPlanId !== ALL_KEY ? plans.find((p) => p.id === selectedPlanId) : null
  , [selectedPlanId, plans]);

  const eligibleUsers = useMemo(() => {
    if (!users) return [];
    const deptIds = new Set<string>();
    if (selectedPlanData) {
      deptIds.add(selectedPlanData.host_dept_id);
      if (selectedPlanData.partner_dept_ids) {
        (Array.isArray(selectedPlanData.partner_dept_ids) ? selectedPlanData.partner_dept_ids : [selectedPlanData.partner_dept_ids]).forEach((id: string) => deptIds.add(id));
      }
    }
    if (selectedVirtualDept) {
      deptIds.add(selectedVirtualDept);
    }
    if (deptIds.size === 0) return users.filter((u) => u.expand?.role_id?.level !== "leadership");
    return users.filter((u) =>
      u.department_id && deptIds.has(u.department_id) && u.expand?.role_id?.level !== "leadership"
    );
  }, [users, selectedPlanData, selectedVirtualDept]);

  const unassignedByDept = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    (unassignedTasks || []).forEach((t) => {
      const deptId = t.host_dept_id || "other";
      if (!groups[deptId]) groups[deptId] = [];
      groups[deptId].push(t);
    });
    return groups;
  }, [unassignedTasks]);

  const virtualDepts = useMemo(() => {
    const ids = Object.keys(unassignedByDept).filter((id) => unassignedByDept[id].length > 0);
    return deptFilters.length ? ids.filter((id) => deptFilters.includes(id)) : ids;
  }, [unassignedByDept, deptFilters]);

  const filterResetKey = `${deptFilters.join(",")}|${groupFilters.join(",")}|${planStatusFilters.join(",")}`;
  const [prevFilterResetKey, setPrevFilterResetKey] = useState(filterResetKey);
  if (prevFilterResetKey !== filterResetKey) {
    setPrevFilterResetKey(filterResetKey);
    setSelectedPlanId(null);
    setSelectedVirtualDept(null);
  }

  const extraFilters = [
    taskStatusFilter ? `status="${taskStatusFilter}"` : "",
    debouncedTaskSearch ? `name~"${debouncedTaskSearch.replace(/[\\"]/g, '\\$&')}"` : "",
    deadlineFrom ? `deadline>="${deadlineFrom}"` : "",
    deadlineTo ? `deadline<="${deadlineTo}"` : "",
  ].filter(Boolean).join(" && ");
  const baseFilter = selectedPlanId === ALL_KEY
    ? ""
    : selectedPlanId
      ? `plan_id="${selectedPlanId}"`
      : selectedVirtualDept
        ? `plan_id="" && host_dept_id="${selectedVirtualDept === "other" ? "" : selectedVirtualDept}"`
        : "plan_id=\"" + (plans[0]?.id || "none") + "\"";
  const taskFilter = extraFilters ? `${baseFilter} && ${extraFilters}` : baseFilter;
  const showTasks = selectedPlanId === ALL_KEY || selectedPlanId || selectedVirtualDept;
  const { data: selectedTasks, isLoading: tasksLoading, isError: tasksError } = useTasks(showTasks ? taskFilter : undefined);

  const scopedTasks = useMemo(() => {
    if (!selectedTasks) return [];
    let list: Task[];
    if (viewScope === "all") list = selectedTasks;
    else if (viewScope === "personal") {
      if (!user) return [];
      const uid = user.id;
      list = selectedTasks.filter((t) => t.executor_id === uid || t.supervisor_id === uid || (t.collaborator_ids || []).includes(uid) || t.expand?.plan_id?.leader_id === uid);
    } else if (viewScope === "group") list = selectedTasks.filter((t) => taskInUserGroups(t, myGroupIds));
    else {
      if (!userDeptId) return [];
      list = selectedTasks.filter((t) => {
        if (t.host_dept_id === userDeptId) return true;
        const plan = t.expand?.plan_id;
        if (plan && (plan.partner_dept_ids || []).includes(userDeptId)) return true;
        return false;
      });
    }
    if (deptFilters.length || groupFilters.length) {
      list = list.filter((t) => {
        const plan = t.expand?.plan_id;
        if (deptFilters.length && !(deptFilters.includes(t.host_dept_id) || (plan && (plan.partner_dept_ids || []).some((id: string) => deptFilters.includes(id))))) return false;
        if (groupFilters.length && !(plan && plan.group_id && groupFilters.includes(plan.group_id))) return false;
        return true;
      });
    }
    return list;
  }, [selectedTasks, viewScope, user, userDeptId, myGroupIds, deptFilters, groupFilters]);

  const filteredTasks = useMemo(() => {
    if (!scopedTasks) return [];
    let list = scopedTasks;
    if (personFilters.length) {
      list = list.filter((t) => personFilters.includes(t.executor_id) || personFilters.includes(t.supervisor_id));
    }
    return list;
  }, [scopedTasks, personFilters]);

  const personOptions = useMemo(() => {
    if (!users) return [];
    let list = users;
    if (viewScope === "all") {
      list = users;
    } else if (viewScope === "group") {
      list = users.filter((u) => (u.group_ids || []).some((g) => myGroupIds.includes(g)));
    } else {
      list = userDeptId ? users.filter((u) => u.department_id === userDeptId) : [];
    }
    if (personFilters.length) {
      const selectedOnes = users.filter((u) => personFilters.includes(u.id) && !list.some((x) => x.id === u.id));
      if (selectedOnes.length) list = [...list, ...selectedOnes];
    }
    return [...list].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "vi"));
  }, [users, viewScope, userDeptId, myGroupIds, personFilters]);

  const selectedVirtualDeptName = selectedVirtualDept ? deptMap[selectedVirtualDept]?.name : null;

  const planTotalPages = Math.max(1, Math.ceil(plans.length / plansPageSize));
  const paginatedPlans = useMemo(() =>
    plans.slice((plansPage - 1) * plansPageSize, plansPage * plansPageSize)
  , [plans, plansPage, plansPageSize]);

  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / tasksPageSize));
  const paginatedTasks = useMemo(() =>
    filteredTasks.slice((tasksPage - 1) * tasksPageSize, tasksPage * tasksPageSize)
  , [filteredTasks, tasksPage, tasksPageSize]);

  const plansResetKey = `${plans.length}|${search}|${deptFilters.join(",")}|${groupFilters.join(",")}|${plansPageSize}`;
  const [prevPlansResetKey, setPrevPlansResetKey] = useState(plansResetKey);
  if (prevPlansResetKey !== plansResetKey) {
    setPrevPlansResetKey(plansResetKey);
    setPlansPage(1);
  }
  const tasksResetKey = `${filteredTasks.length}|${personFilters.join(",")}|${taskStatusFilter}|${taskSearchFilter}|${deadlineFrom}|${deadlineTo}|${tasksPageSize}`;
  const [prevTasksResetKey, setPrevTasksResetKey] = useState(tasksResetKey);
  if (prevTasksResetKey !== tasksResetKey) {
    setPrevTasksResetKey(tasksResetKey);
    setTasksPage(1);
  }

  const handleExport = (format: "xlsx" | "csv" | "json" | "pdf", landscape?: boolean) => {
    if (!plans) return;
    const data = plans.map((p) => ({ ...p, host_dept: p.expand?.host_dept_id?.name || "" }));
    const columns = [...PLAN_EXPORT_COLUMNS, { key: "host_dept", label: "Phòng chủ trì" }];
    if (format === "xlsx") exportToExcel(data, columns, "ke-hoach");
    else if (format === "csv") exportToCSV(data, columns, "ke-hoach");
    else if (format === "json") exportToJSON(data, columns, "ke-hoach");
    else exportToPdfPlans(plans, landscape);
  };

  const handleTaskExport = (format: "xlsx" | "csv" | "json" | "pdf", landscape?: boolean) => {
    if (!filteredTasks.length) return;
    const data = filteredTasks.map((t) => ({ ...t, plan_name: t.expand?.plan_id?.name || "", executor: t.expand?.executor_id?.name || "", }));
    const columns = [...TASK_EXPORT_COLUMNS, { key: "plan_name", label: "Kế hoạch" }, { key: "executor", label: "Người thực hiện" }];
    if (format === "xlsx") exportToExcel(data, columns, "nhiem-vu");
    else if (format === "csv") exportToCSV(data, columns, "nhiem-vu");
    else if (format === "json") exportToJSON(data, columns, "nhiem-vu");
    else exportToPdfTasks(filteredTasks, landscape);
  };

  useEffect(() => { usePageTitleStore.getState().setTitle("Kế hoạch & Nhiệm vụ"); }, []);

  useEffect(() => {
    if (dragging) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, [dragging]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Xóa kế hoạch "${name}"?`)) return;
    await deletePlan.mutateAsync(id);
    if (selectedPlanId === id) { setSelectedPlanId(null); setSelectedVirtualDept(null); }
  };

  const togglePlanSelect = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTaskSelect = useCallback((id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const openTask = useCallback((id: string) => navigate(`/tasks/${id}`), [navigate]);

  const allPlansSelected = plans.length > 0 && plans.every((p) => selectedPlanIds.has(p.id));

  const handleSelectAllPlans = () => {
    if (allPlansSelected) setSelectedPlanIds(new Set());
    else setSelectedPlanIds(new Set(plans.map((p) => p.id)));
  };

  const handleBulkDeletePlans = async () => {
    if (selectedPlanIds.size === 0) return;
    if (!window.confirm(`Xóa ${selectedPlanIds.size} kế hoạch đã chọn?`)) return;
    await bulkDeletePlans.mutateAsync(Array.from(selectedPlanIds));
    setSelectedPlanIds(new Set());
  };

  const handleBulkDeleteTasks = async () => {
    if (selectedTaskIds.size === 0) return;
    if (!window.confirm(`Xóa ${selectedTaskIds.size} nhiệm vụ đã chọn?`)) return;
    await bulkDeleteTasks.mutateAsync(Array.from(selectedTaskIds));
    setSelectedTaskIds(new Set());
  };

  const allTasksSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.has(t.id));

  const handleSelectAllTasks = () => {
    if (allTasksSelected) setSelectedTaskIds(new Set());
    else setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
  };

  return (
    <div ref={containerRef} className="flex gap-0 h-[calc(100vh-7rem)] w-full max-w-full overflow-hidden select-none" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Left panel: Plans list */}
      <div className="shrink-0 min-w-0 flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900" style={{ width: `${leftWidth}%` }}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={allPlansSelected} onChange={handleSelectAllPlans}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500" />
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
              <ClipboardList className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-indigo-800 dark:text-indigo-300">Kế hoạch</h2>
          </div>
          <div className="flex items-center gap-1">
            <PlanFiltersDropdown
              search={search}
              onSearchChange={setSearch}
              deptFilters={deptFilters}
              onDeptToggle={(id) => setDeptFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
              groupFilters={groupFilters}
              onGroupToggle={(id) => setGroupFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
              statusFilters={planStatusFilters}
              onStatusToggle={(id) => setPlanStatusFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
              departments={departments}
              groups={groups}
              onClear={() => { setSearch(""); setDeptFilters([]); setGroupFilters([]); setPlanStatusFilters([]); }}
            />
            {selectedPlanIds.size > 0 ? (
              <>
                <span className="text-xs text-slate-500 mr-1 dark:text-slate-400">Đã chọn {selectedPlanIds.size}</span>
                {canDeletePlans && (
                <button onClick={handleBulkDeletePlans} disabled={bulkDeletePlans.isPending}
                  className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950" title="Xóa các kế hoạch đã chọn">
                  <Trash2 className="h-4 w-4" />
                </button>
                )}
                <button onClick={() => setSelectedPlanIds(new Set())}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 hover:bg-slate-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700" title="Bỏ chọn">
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
            <ExportMenu onExport={handleExport} label="Xuất danh sách kế hoạch" />
            {canAddPlans && (
              <button onClick={() => setShowImport(true)} aria-label="Nhập dữ liệu kế hoạch"
                className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950">
                <Upload className="h-4 w-4" />
              </button>
            )}
            {showImport && <Suspense fallback={null}><ImportModal collection="plans" onClose={() => setShowImport(false)} /></Suspense>}
            {canAddPlans && (
            <button onClick={() => { setShowPlanForm(true); setEditingPlan(null); }} aria-label="Thêm kế hoạch mới"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 transition-colors dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950">
              <Plus className="h-4 w-4" />
            </button>
            )}
            </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {plansLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            </div>
          ) : plansError ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-500">
              <p className="text-sm font-medium">Không thể tải danh sách kế hoạch</p>
              <p className="mt-1 text-xs text-red-400">Vui lòng thử lại sau</p>
            </div>
          ) : (
            <>
              <div key="all" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPlanId(ALL_KEY); setSelectedVirtualDept(null); } }} onClick={() => { setSelectedPlanId(ALL_KEY); setSelectedVirtualDept(null); }}
                className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all ${
                  selectedPlanId === ALL_KEY
                    ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/40"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                }`}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                    <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tất cả nhiệm vụ</span>
                </div>
              </div>
              {showPlanForm && !editingPlan && (
                <PlanInlineForm
                  onSubmit={async (data) => {
                    await createPlan.mutateAsync({ ...data, status: "not_started" as PlanStatus, progress: 0 });
                    setShowPlanForm(false);
                  }}
                  onCancel={() => setShowPlanForm(false)}
                  pending={createPlan.isPending}
                  departments={departments}
                  users={users}
                  groups={groups}
                  accentColor="emerald"
                  size="sm"
                />
              )}
              {paginatedPlans.map((plan) => (
                <div key={plan.id}>
                {showPlanForm && editingPlan?.id === plan.id && (
                  <PlanInlineForm
                    initialValues={{
                      name: editingPlan.name,
                      description: editingPlan.description,
                      host_dept_id: editingPlan.host_dept_id,
                      leader_id: editingPlan.leader_id,
                      partner_dept_ids: Array.isArray(editingPlan.partner_dept_ids) ? editingPlan.partner_dept_ids : [],
                      group_id: editingPlan.group_id,
                      start_date: editingPlan.start_date,
                      end_date: editingPlan.end_date,
                      is_sudden: editingPlan.is_sudden,
                      is_high_impact: editingPlan.is_high_impact,
                    }}
                    onSubmit={async (data) => {
                      await updatePlan.mutateAsync({ id: editingPlan.id, data });
                      setShowPlanForm(false);
                      setEditingPlan(null);
                    }}
                    onCancel={() => { setShowPlanForm(false); setEditingPlan(null); }}
                    pending={updatePlan.isPending}
                    departments={departments}
                    users={users}
                    groups={groups}
                    accentColor="emerald"
                    size="sm"
                    showId={plan.id}
                  />
                )}
                <div onClick={(e) => { if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return; setSelectedPlanId(plan.id); setSelectedVirtualDept(null); }}
                  role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) { setSelectedPlanId(plan.id); setSelectedVirtualDept(null); } } }}
                  className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all ${
                    selectedPlanId === plan.id
                      ? "border-indigo-300 bg-indigo-50 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={selectedPlanIds.has(plan.id)} onChange={(e) => togglePlanSelect(plan.id, e)}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100" title={plan.name}>{plan.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${PLAN_STATUS_STYLES[plan.status]}`}>{PLAN_STATUS_LABELS[plan.status]}</span>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/plans/${plan.id}`); }}
                        className="p-0.5 hover:text-indigo-600 transition-colors" title="Chi tiết kế hoạch"><ExternalLink className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1.5 min-w-0 overflow-hidden dark:text-slate-500">
                    <span className="font-bold text-slate-600 shrink-0 dark:text-slate-300">{plan.expand?.host_dept_id?.name || "—"}</span>
                    {plan.expand?.partner_dept_ids && plan.expand.partner_dept_ids.length > 0 && (
                      <span className="text-slate-300 truncate min-w-0 dark:text-slate-500" title={plan.expand.partner_dept_ids.map((d) => d.name).join(", ")}>· {plan.expand.partner_dept_ids.map((d) => d.name).join(", ")}</span>
                    )}
                    <span className="text-slate-300 shrink-0 dark:text-slate-500">·</span>
                    <span className="shrink-0 truncate">{new Date(plan.start_date).toLocaleDateString("vi-VN")} → {new Date(plan.end_date).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-700">
                      <div className={`h-1.5 rounded-full ${plan.progress === 100 ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${plan.progress}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{plan.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                      {canEditPlans && (
                      <button onClick={(e) => { e.stopPropagation(); setEditingPlan(plan); setShowPlanForm(true); }}
                        className="p-0.5 hover:text-indigo-600 transition-colors" title="Sửa"><Pencil className="h-3 w-3" /></button>
                      )}
                      {canDeletePlans && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(plan.id, plan.name); }}
                        className="p-0.5 hover:text-red-500 transition-colors" title="Xóa"><Trash2 className="h-3 w-3" /></button>
                      )}
                    </div>
                    {plan.expand?.leader_id?.name && (
                      <span className="text-[9px] text-slate-400 truncate max-w-[120px] dark:text-slate-500" title={plan.expand.leader_id.name}>
                        <Users className="mr-0.5 inline h-2.5 w-2.5" />
                        {plan.expand.leader_id.name}
                      </span>
                    )}
                  </div>
                  </div>
                </div>
              ))}

              {virtualDepts.length > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700">
                  <p className="px-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider dark:text-slate-500">Nhiệm vụ khác</p>
                  {virtualDepts.map((deptId) => (
                    <div key={deptId} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedVirtualDept(deptId); setSelectedPlanId(null); } }} onClick={() => { setSelectedVirtualDept(deptId); setSelectedPlanId(null); }}
                      className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all ${
                        selectedVirtualDept === deptId
                          ? "border-amber-300 bg-amber-50 shadow-sm dark:border-amber-800 dark:bg-amber-950/40"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 shrink-0 text-amber-500" />
                          <span className="text-sm font-semibold text-slate-700 truncate dark:text-slate-200" title={`Các nhiệm vụ khác của ${deptMap[deptId]?.name || "Phòng ban"}`}>
                            Các nhiệm vụ khác của {deptMap[deptId]?.name || "Phòng ban"}
                          </span>
                        </div>
                        {selectedVirtualDept === deptId && <ChevronRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{unassignedByDept[deptId].length} nhiệm vụ</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="rounded-b-2xl overflow-hidden">
          <Pagination
            page={plansPage}
            totalPages={planTotalPages}
            onChange={setPlansPage}
            pageSize={plansPageSize}
            onPageSizeChange={setPlansPageSize}
            totalCount={plans.length}
          />
        </div>
      </div>
      <div
        className={`w-1.5 cursor-col-resize shrink-0 flex items-center justify-center transition-colors hover:bg-indigo-100 active:bg-indigo-200 ${dragging ? "bg-indigo-200" : "bg-transparent"}`}
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-slate-300 pointer-events-none dark:text-slate-600" />
      </div>

      {/* Right panel: Tasks */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700/80 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 shadow-sm">
              <CheckSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nhiệm vụ</h2>
              {selectedVirtualDeptName && (
                <p className="text-[10px] text-amber-600 font-medium dark:text-amber-400">Nhiệm vụ không thuộc kế hoạch</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TaskFiltersDropdown
              statusFilter={taskStatusFilter}
              onStatusChange={setTaskStatusFilter}
              searchFilter={taskSearchFilter}
              onSearchChange={setTaskSearchFilter}
              deadlineFrom={deadlineFrom}
              onDeadlineFromChange={setDeadlineFrom}
              deadlineTo={deadlineTo}
              onDeadlineToChange={setDeadlineTo}
              personFilters={personFilters}
              onPersonToggle={(id) => setPersonFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
              personOptions={personOptions}
              onClear={() => { setTaskStatusFilter(""); setTaskSearchFilter(""); setDeadlineFrom(""); setDeadlineTo(""); setPersonFilters([]); }}
            />
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50/50 p-0.5 mr-1 dark:border-slate-700 dark:bg-slate-800/60">
              <button onClick={() => setViewMode("table")}
                className={`rounded-md p-1.5 transition-all ${viewMode === "table" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`} title="Xem dạng bảng">
                <Table2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("kanban")}
                className={`rounded-md p-1.5 transition-all ${viewMode === "kanban" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`} title="Xem dạng Kanban">
                <Columns2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("calendar")}
                className={`rounded-md p-1.5 transition-all ${viewMode === "calendar" ? "bg-white text-indigo-600 shadow-xs dark:bg-slate-700" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"}`} title="Xem dạng Lịch">
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
            </div>
            <ExportMenu onExport={handleTaskExport} label="Xuất danh sách nhiệm vụ" />
            {canAddTasks && (
            <button onClick={() => setShowTaskImport(true)} aria-label="Nhập dữ liệu nhiệm vụ"
              className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950">
              <Upload className="h-4 w-4" />
            </button>
            )}
            {showTaskImport && <Suspense fallback={null}><ImportModal collection="tasks" onClose={() => setShowTaskImport(false)} /></Suspense>}
            {canAddTasks && (
            <button onClick={() => setShowTaskForm(true)} aria-label="Thêm nhiệm vụ mới"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 transition-colors dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950">
              <Plus className="h-4 w-4" />
            </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showTaskForm && (
            <TaskInlineForm
              onSubmit={async (data) => {
                await createTask.mutateAsync({
                  ...data,
                  host_dept_id: selectedVirtualDept || selectedPlanData?.host_dept_id || undefined,
                  status: "not_started",
                });
                setShowTaskForm(false);
              }}
              onCancel={() => setShowTaskForm(false)}
              pending={createTask.isPending}
              eligibleUsers={eligibleUsers}
              accentColor="emerald"
              size="sm"
              planId={selectedPlanId && selectedPlanId !== ALL_KEY ? selectedPlanId : undefined}
              planName={selectedPlanData?.name}
              plans={plans.map((p) => ({ id: p.id, name: p.name }))}
            />
          )}
          {!showTasks ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <ClipboardList className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Chọn một kế hoạch từ danh sách bên trái</p>
            </div>
          ) : tasksLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
            </div>
          ) : tasksError ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-500">
              <p className="text-sm font-medium">Không thể tải danh sách nhiệm vụ</p>
            </div>
          ) : filteredTasks.length > 0 ? (
            viewMode === "kanban" ? (
              <KanbanBoard tasks={filteredTasks} />
            ) : viewMode === "calendar" ? (
              <CalendarView tasks={filteredTasks} />
            ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50 min-h-[36px] dark:border-slate-700 dark:bg-slate-800/60">
                {selectedTaskIds.size > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Đã chọn {selectedTaskIds.size} nhiệm vụ</span>
                    {canDeleteTasks && (
                    <button onClick={handleBulkDeleteTasks} disabled={bulkDeleteTasks.isPending}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors dark:border-red-900 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40">
                      <Trash2 className="h-3 w-3" /> Xóa
                    </button>
                    )}
                    <button onClick={() => setSelectedTaskIds(new Set())}
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium dark:text-slate-400 dark:hover:text-slate-200">Bỏ chọn</button>
                  </div>
                ) : (
                  <div />
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="px-2 py-3 w-10">
                      <input type="checkbox" checked={allTasksSelected} onChange={handleSelectAllTasks}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-800" />
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Nhiệm vụ</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Người thực hiện</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Người giám sát</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Hạn</th>
                  </tr>
                </thead>
              <tbody>
                {paginatedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskIds.has(task.id)}
                    onToggle={toggleTaskSelect}
                    onOpen={openTask}
                  />
                ))}
              </tbody>
            </table>
            <Pagination
              page={tasksPage}
              totalPages={taskTotalPages}
              onChange={setTasksPage}
              pageSize={tasksPageSize}
              onPageSizeChange={setTasksPageSize}
              totalCount={filteredTasks.length}
            />
            </>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <CheckSquare className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Chưa có nhiệm vụ</p>
              {canAddTasks && (
              <button onClick={() => setShowTaskForm(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Thêm nhiệm vụ đầu tiên
              </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
