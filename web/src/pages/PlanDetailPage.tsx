import { useEffect, useState, useMemo } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useParams, useNavigate } from "react-router-dom";
import { usePlan, useUpdatePlan, useSoftDeletePlan } from "../hooks/usePlans";
import { useTasks, useCreateTask } from "../hooks/useTasks";
import { useDepartments, useUsers } from "../hooks/useDepartments";
import { useProfessionalGroups } from "../hooks/useProfessionalGroups";
import { useAllComments } from "../hooks/useComments";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { planInUserGroups, taskInUserGroups, userGroupIds } from "../utils/groupScope";
import { exportAttachmentsZip, exportTaskReportPdf, collectTaskAttachments, safeFilename } from "../utils/exportTaskReport";
import CommentSection from "../components/tasks/CommentSection";
import InteractiveGanttChart from "../components/plans/InteractiveGanttChart";
import PlanInlineForm from "../components/plans/PlanInlineForm";
import TaskInlineForm from "../components/tasks/TaskInlineForm";
import CheckCombobox from "../components/shared/CheckCombobox";
import Pagination from "../components/shared/Pagination";
import {
  Calendar,
  Users,
  Building2,
  Plus,
  ChevronRight,
  Handshake,
  UserCheck,
  FileText,
  MessageSquare,
  Clock,
  Tag,
  ListChecks,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Filter,
  Search,
  FileDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_STYLES,
} from "../utils/constants";

type PageTab = "info" | "gantt";
type RightTab = "info" | "discussion";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pageTab, setPageTab] = usePersistedState<PageTab>(`plan_tab_${id || "new"}`, "info");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("info");
  const [showTaskFilters, setShowTaskFilters] = useState(false);
  const [taskSearch, setTaskSearch] = usePersistedState(`plan_tasks_search_${id || "new"}`, "");
  const [statusFilters, setStatusFilters] = usePersistedState<string[]>(`plan_tasks_status_${id || "new"}`, []);
  const [personFilters, setPersonFilters] = usePersistedState<string[]>(`plan_tasks_person_${id || "new"}`, []);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = usePersistedState(`plan_tasks_pageSize_${id || "new"}`, 10);
  const { data: plan, isLoading, error } = usePlan(id || "");
  const { data: tasks } = useTasks(id ? `plan_id="${id}"` : undefined);
  const { data: allComments } = useAllComments();
  const [exporting, setExporting] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);
  const deletePlan = useSoftDeletePlan();
  const updatePlan = useUpdatePlan();
  const createTask = useCreateTask();
  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const { data: groups } = useProfessionalGroups();
  const user = useAuthStore((s) => s.user);
  const viewScope = user?.expand?.role_id?.view_scope;
  const userDeptId = user?.expand?.department_id?.id;
  const myGroupIds = userGroupIds(user);
  const canEditPlans = user?.expand?.role_id?.can_edit_plans;
  const canDeletePlans = user?.expand?.role_id?.can_delete_plans;
  const canAddTasks = user?.expand?.role_id?.can_add_tasks;

  const canViewPlan = useMemo(() => {
    if (!plan || !user) return true;
    if (viewScope === "all") return true;
    if (viewScope === "department") {
      if (!userDeptId) return false;
      return plan.host_dept_id === userDeptId || (plan.partner_dept_ids || []).includes(userDeptId);
    }
    if (viewScope === "group") return planInUserGroups(plan, myGroupIds);
    if (viewScope === "personal") {
      return plan.leader_id === user.id || (tasks || []).some((t) => t.executor_id === user.id || t.supervisor_id === user.id || (t.collaborator_ids || []).includes(user.id));
    }
    return true;
  }, [plan, user, viewScope, userDeptId, tasks, myGroupIds]);

  const eligibleUsers = useMemo(() => {
    if (!plan || !users) return [];
    const deptIds = new Set<string>();
    deptIds.add(plan.host_dept_id);
    if (plan.partner_dept_ids) {
      (Array.isArray(plan.partner_dept_ids) ? plan.partner_dept_ids : [plan.partner_dept_ids]).forEach((id: string) => deptIds.add(id));
    }
    return users.filter((u) =>
      u.department_id && deptIds.has(u.department_id) && u.expand?.role_id?.level !== "leadership"
    );
  }, [plan, users]);

  const visibleTasks = useMemo(() => {
    if (!tasks) return [];
    if (viewScope === "all") return tasks;
    if (viewScope === "personal") {
      if (!user) return [];
      return tasks.filter((t) => t.executor_id === user.id || t.supervisor_id === user.id || (t.collaborator_ids || []).includes(user.id) || t.expand?.plan_id?.leader_id === user.id);
    }
    if (viewScope === "group") return tasks.filter((t) => taskInUserGroups(t, myGroupIds));
    if (!userDeptId) return [];
    return tasks.filter((t) => {
      if (t.host_dept_id === userDeptId) return true;
      const plan = t.expand?.plan_id;
      if (plan && (plan.partner_dept_ids || []).includes(userDeptId)) return true;
      return false;
    });
  }, [tasks, viewScope, user, userDeptId, myGroupIds]);

  const selectedTask = (visibleTasks || []).find((t) => t.id === selectedTaskId) || null;

  const filteredTasks = useMemo(() => {
    if (!visibleTasks) return [];
    let list = visibleTasks;
    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (statusFilters.length) list = list.filter((t) => statusFilters.includes(t.status));
    if (personFilters.length) list = list.filter((t) => personFilters.includes(t.executor_id) || personFilters.includes(t.supervisor_id));
    return list;
  }, [visibleTasks, taskSearch, statusFilters, personFilters]);

  const personOptions = useMemo(() => {
    const ids = new Set<string>();
    (visibleTasks || []).forEach((t) => {
      if (t.executor_id) ids.add(t.executor_id);
      if (t.supervisor_id) ids.add(t.supervisor_id);
    });
    if (personFilters.length) personFilters.forEach((id) => ids.add(id));
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    return Array.from(ids)
      .map((id) => userMap.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "vi"));
  }, [visibleTasks, users, personFilters]);

  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / taskPageSize));
  const paginatedTasks = useMemo(() =>
    filteredTasks.slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize)
  , [filteredTasks, taskPage, taskPageSize]);

  const taskResetKey = `${filteredTasks.length}|${taskSearch}|${statusFilters.join(",")}|${personFilters.join(",")}|${taskPageSize}`;
  const [prevTaskResetKey, setPrevTaskResetKey] = useState(taskResetKey);
  if (prevTaskResetKey !== taskResetKey) {
    setPrevTaskResetKey(taskResetKey);
    setTaskPage(1);
  }

  useEffect(() => {
    if (plan) {
      usePageTitleStore.getState().setConfig({
        title: plan.name,
        backTo: "/plans",
        badge: { label: PLAN_STATUS_LABELS[plan.status], className: PLAN_STATUS_STYLES[plan.status] },
      });
    }
    return () => { usePageTitleStore.getState().clear(); };
  }, [plan]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <AlertTriangle className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">Không thể tải kế hoạch. Vui lòng thử lại sau.</p>
      </div>
    );
  }

  if (!canViewPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
        <AlertTriangle className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">Bạn không có quyền xem kế hoạch này.</p>
      </div>
    );
  }

  const progressData = [
    { name: "Hoàn thành", value: plan.progress },
    { name: "Còn lại", value: 100 - plan.progress },
  ];
  const COLORS = ["#22c55e", "#e2e8f0"];

  const handleDelete = async () => {
    if (!window.confirm(`Xóa kế hoạch "${plan.name}"?`)) return;
    await deletePlan.mutateAsync(plan.id);
    navigate("/plans");
  };

  const handleExportReport = async () => {
    if (!visibleTasks.length) return;
    setExporting(true);
    try {
      const comments = visibleTasks.flatMap((t) =>
        (allComments || []).filter((c) => c.task_id === t.id)
      );
      await exportTaskReportPdf(visibleTasks, comments, {
        title: `BÁO CÁO TỔNG HỢP KẾ HOẠCH: ${plan.name}`,
        meta: `Kế hoạch: ${plan.name}`,
        summary: [
          { label: "Số nhiệm vụ", value: visibleTasks.length },
          { label: "Hoàn thành", value: `${plan.progress}%` },
        ],
        filename: `ke-hoach-${safeFilename(plan.name)}`,
        landscape: true,
        includeSignature,
      });
      const attachments = visibleTasks.flatMap((t) => collectTaskAttachments(t, allComments || []));
      if (attachments.length > 0) {
        await exportAttachmentsZip(attachments, `ke-hoach-${safeFilename(plan.name)}-files`);
      }
    } catch {
      // silent failure; keep UI state safe
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5 min-w-0">

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50/50 p-1 w-fit dark:border-slate-700 dark:bg-slate-800/60">
        <button onClick={() => setPageTab("info")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            pageTab === "info"
              ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}>
          Thông tin & Nhiệm vụ
        </button>
        <button onClick={() => setPageTab("gantt")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            pageTab === "gantt"
              ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}>
          Biểu đồ Gantt
        </button>
      </div>

      {pageTab === "info" ? (
        <>
          {/* Card 1: Plan Info */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {showEditForm ? (
              <PlanInlineForm
                initialValues={{
                  name: plan.name,
                  description: plan.description,
                  host_dept_id: plan.host_dept_id,
                  leader_id: plan.leader_id,
                  partner_dept_ids: Array.isArray(plan.partner_dept_ids) ? plan.partner_dept_ids : [],
                  group_id: plan.group_id,
                  start_date: plan.start_date,
                  end_date: plan.end_date,
                  is_sudden: plan.is_sudden,
                  is_high_impact: plan.is_high_impact,
                }}
                onSubmit={async (data) => {
                  await updatePlan.mutateAsync({ id: plan.id, data });
                  setShowEditForm(false);
                }}
                onCancel={() => setShowEditForm(false)}
                pending={updatePlan.isPending}
                departments={departments}
                users={users}
                groups={groups}
                accentColor="indigo"
                size="md"
                showId={plan.id}
                title="Sửa kế hoạch"
              />
            ) : (
            <div className="flex items-stretch">
              <div className="flex-1 space-y-4 p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-indigo-500 shrink-0 dark:text-indigo-400" />
                    <h3 className="font-semibold text-slate-800 truncate dark:text-slate-100" title={`Thông tin kế hoạch: ${plan.name}`}>Thông tin kế hoạch: {plan.name}</h3>
                  </div>
                  {(canEditPlans || canDeletePlans) && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showEditForm ? (
                        <button onClick={() => setShowEditForm(false)}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                          <X className="h-3.5 w-3.5" />
                          Hủy
                        </button>
                      ) : canEditPlans && (
                        <button onClick={() => setShowEditForm(true)}
                          className="flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                      )}
                      {canDeletePlans && (
                      <button onClick={handleDelete}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                      </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Mô tả</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{plan.description || "Chưa có mô tả"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Phòng chủ trì:</span>
                    <span className="font-medium">{plan.expand?.host_dept_id?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Người phụ trách:</span>
                    <span className="font-medium">{plan.expand?.leader_id?.name || plan.expand?.leader_id?.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Handshake className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Phòng phối hợp:</span>
                    <span className="font-medium">
                      {plan.expand?.partner_dept_ids && plan.expand.partner_dept_ids.length > 0
                        ? plan.expand.partner_dept_ids.map((d) => d.name).join(", ")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Thời gian:</span>
                    <span className="font-medium">
                      {new Date(plan.start_date).toLocaleDateString("vi-VN")} → {new Date(plan.end_date).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex w-56 flex-col items-center justify-center border-l border-slate-100 p-6 dark:border-slate-700">
                <div className="h-28 w-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={progressData} cx="50%" cy="50%" innerRadius={30} outerRadius={44} dataKey="value" startAngle={90} endAngle={-270}>
                        {progressData.map((entry, index) => (
                          <Cell key={entry.name} fill={COLORS[index]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{plan.progress}%</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">hoàn thành</span>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Card 2 + 3: Task list + Task info/discussion */}
          <div className="flex flex-col lg:flex-row flex-1 gap-5 min-h-0">
            {/* Card 2: Task list */}
            <div className="w-full lg:w-1/3 min-w-0 flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                    Nhiệm vụ <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">({filteredTasks.length}/{visibleTasks.length})</span>
                  </h3>
                </div>
                {showTaskForm ? (
                  <button onClick={() => setShowTaskForm(false)}
                    className="rounded-lg bg-slate-400 p-1.5 text-white hover:bg-slate-500 transition-colors dark:bg-slate-600 dark:hover:bg-slate-500" title="Đóng">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1 cursor-pointer select-none" title="Kèm phần ký xác nhận trong báo cáo">
                    <input type="checkbox" checked={includeSignature}
                      onChange={(e) => setIncludeSignature(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-purple-600" />
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">Ký xác nhận</span>
                  </label>
                  <button onClick={handleExportReport} disabled={exporting || visibleTasks.length === 0} title="Xuất báo cáo tổng hợp + file đính kèm"
                    className="rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
                    <FileDown className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowTaskFilters(!showTaskFilters)} title="Bộ lọc nhiệm vụ"
                      className={`relative rounded-lg border p-1.5 transition-colors ${(taskSearch || statusFilters.length > 0 || personFilters.length > 0) ? "border-purple-300 bg-purple-100 text-purple-600 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"}`}>
                      <Filter className="h-4 w-4" />
                      {(taskSearch || statusFilters.length > 0 || personFilters.length > 0) && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-purple-500 dark:border-slate-900" />
                      )}
                    </button>
                    {showTaskFilters && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTaskFilters(false)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} aria-label="Tìm nhiệm vụ"
                              placeholder="Tìm nhiệm vụ..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500" />
                          </div>
                          <div className="mt-2 space-y-2">
                            <CheckCombobox
                              items={Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({ id: key, label }))}
                              selected={statusFilters}
                              onToggle={(id) => setStatusFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                              label="Trạng thái"
                              placeholder="Tất cả trạng thái"
                              accentColor="purple"
                              size="sm"
                            />
                            <CheckCombobox
                              items={personOptions.map((u) => ({ id: u.id, label: u.name || u.email }))}
                              selected={personFilters}
                              onToggle={(id) => setPersonFilters((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                              label="Nhân sự"
                              placeholder="Tất cả nhân sự"
                              accentColor="purple"
                              size="sm"
                            />
                          </div>
                          {(taskSearch || statusFilters.length > 0 || personFilters.length > 0) && (
                            <button onClick={() => { setTaskSearch(""); setStatusFilters([]); setPersonFilters([]); }}
                              className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
                              Xóa lọc
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {canAddTasks && (
                  <button onClick={() => setShowTaskForm(true)}
                    className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 transition-colors" title="Thêm nhiệm vụ">
                    <Plus className="h-4 w-4" />
                  </button>
                  )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {showTaskForm && (
                  <TaskInlineForm
                    onSubmit={async (data) => {
                      await createTask.mutateAsync({
                        ...data,
                        host_dept_id: plan.host_dept_id,
                        status: "not_started",
                      });
                      setShowTaskForm(false);
                    }}
                    onCancel={() => setShowTaskForm(false)}
                    pending={createTask.isPending}
                    eligibleUsers={eligibleUsers}
                    accentColor="purple"
                    size="sm"
                    planId={plan.id}
                    planName={plan.name}
                  />
                )}
                {filteredTasks.length > 0 ? (
                  paginatedTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => { setSelectedTaskId(task.id); setRightTab("info"); }}
                      className={`w-full rounded-lg border p-3 text-left cursor-pointer transition-all ${
                        selectedTaskId === task.id
                          ? "border-purple-300 bg-purple-50 shadow-sm dark:border-purple-700 dark:bg-purple-900/30"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100" title={task.name}>{task.name}</p>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}>
                            {TASK_STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {selectedTaskId === task.id && <ChevronRight className="h-3.5 w-3.5 text-purple-400 dark:text-purple-300" />}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                        <Users className="h-3 w-3" />
                        <span className="truncate" title={task.expand?.executor_id?.name || "—"}>{task.expand?.executor_id?.name || "—"}</span>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        <span>{new Date(task.deadline).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                    <ListChecks className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs">{visibleTasks.length > 0 ? "Không có nhiệm vụ phù hợp" : "Chưa có nhiệm vụ"}</p>
                  </div>
                )}
              </div>
              <Pagination
                page={taskPage}
                totalPages={taskTotalPages}
                onChange={setTaskPage}
                pageSize={taskPageSize}
                onPageSizeChange={setTaskPageSize}
                totalCount={filteredTasks.length}
              />
            </div>

            {/* Card 3: Task info & discussion */}
            <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
              {selectedTask ? (
                <>
                  <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50/50 p-1 m-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <button onClick={() => setRightTab("info")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                        rightTab === "info"
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}>
                      <FileText className="h-4 w-4" />
                      Thông tin
                    </button>
                    <button onClick={() => setRightTab("discussion")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                        rightTab === "discussion"
                          ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}>
                      <MessageSquare className="h-4 w-4" />
                      Trao đổi
                    </button>
                  </div>

                  <div className={`flex-1 ${rightTab === "discussion" ? "p-0" : "overflow-y-auto p-5"}`}>
                    {rightTab === "info" ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedTask.name}</h4>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_STATUS_STYLES[selectedTask.status]}`}>
                            {TASK_STATUS_LABELS[selectedTask.status]}
                          </span>
                          <button onClick={() => navigate(`/tasks/${selectedTask.id}`)}
                            className="ml-auto rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
                            Xem chi tiết
                          </button>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Mô tả</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{selectedTask.description || "Chưa có mô tả"}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <UserCheck className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">Thực hiện:</span>
                            <span className="font-bold">{selectedTask.expand?.executor_id?.name || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">Giám sát:</span>
                            <span className="font-medium">{selectedTask.expand?.supervisor_id?.name || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Handshake className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">Phối hợp:</span>
                            <span className="font-medium">
                              {selectedTask.expand?.collaborator_ids && selectedTask.expand.collaborator_ids.length > 0
                                ? selectedTask.expand.collaborator_ids.map((u) => u.name).join(", ")
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">Thời gian:</span>
                            <span className="font-medium">
                              {new Date(selectedTask.start_date).toLocaleDateString("vi-VN")} → {new Date(selectedTask.deadline).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Tag className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">Phân loại:</span>
                            <span className="font-medium">{selectedTask.is_ad_hoc && selectedTask.is_high_impact ? "Đột xuất + Quan trọng" : selectedTask.is_ad_hoc ? "Đột xuất" : selectedTask.is_high_impact ? "Quan trọng" : "Bình thường"}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <CommentSection
                        taskId={selectedTask.id}
                        taskStatus={selectedTask.status}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                  <ListChecks className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm">Chọn một nhiệm vụ từ danh sách</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <InteractiveGanttChart plan={plan} tasks={visibleTasks} canEdit={!!canEditPlans} />
        </div>
      )}

    </div>
  );
}
