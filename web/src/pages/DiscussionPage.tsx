import { useEffect, useMemo, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { useTasks } from "../hooks/useTasks";
import { useAllComments } from "../hooks/useComments";
import { useAuthStore } from "../stores/authStore";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { useDepartments } from "../hooks/useDepartments";
import { useProfessionalGroups } from "../hooks/useProfessionalGroups";
import { taskInUserGroups, userGroupIds } from "../utils/groupScope";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "../utils/constants";
import type { Comment } from "@shared/types";
import { Link } from "react-router-dom";
import {
  MessagesSquare,
  Users,
  Briefcase,
  Building2,
  Search,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TabBar from "../components/shared/TabBar";
import Spinner from "../components/shared/Spinner";
import ErrorState from "../components/shared/ErrorState";
import EmptyState from "../components/shared/EmptyState";
import CommentSection from "../components/tasks/CommentSection";
import ChannelChat from "../components/chat/ChannelChat";
import type { ChannelRef } from "../hooks/useChatMessages";
import { formatTime } from "../components/chat/chatShared";

interface ChannelItem {
  key: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  ref: ChannelRef;
}

export default function DiscussionPage() {
  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks();
  const { data: allComments, error: commentsError, refetch: refetchComments } = useAllComments();
  const { data: departments } = useDepartments();
  const { data: groups } = useProfessionalGroups();

  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const viewScope = role?.view_scope;
  const userDeptId = user?.expand?.department_id?.id;
  const myGroupIds = userGroupIds(user);

  const [activeTab, setActiveTab] = usePersistedState<"nhiem-vu" | "nhom">("discussion_tab", "nhiem-vu");
  const [taskSearch, setTaskSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = usePersistedState<string | null>("discussion_taskId", null);
  const [selectedChannelKey, setSelectedChannelKey] = usePersistedState<string | null>("discussion_channel", null);

  useEffect(() => {
    usePageTitleStore.getState().setTitle("Trao đổi & Thảo luận");
  }, []);

  const scopedTasks = useMemo(() => {
    if (!tasks || !user) return [];
    if (viewScope === "personal") return tasks.filter((t) => t.executor_id === user.id || t.supervisor_id === user.id || (t.collaborator_ids || []).includes(user.id) || t.expand?.plan_id?.leader_id === user.id);
    if (viewScope === "group") return tasks.filter((t) => taskInUserGroups(t, myGroupIds));
    if (viewScope === "department") {
      if (!userDeptId) return [];
      return tasks.filter((t) => {
        if (t.host_dept_id === userDeptId) return true;
        const plan = t.expand?.plan_id;
        if (plan && (plan.partner_dept_ids || []).includes(userDeptId)) return true;
        return false;
      });
    }
    return tasks;
  }, [tasks, viewScope, user, userDeptId, myGroupIds]);

  const commentsByTask = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const c of allComments || []) {
      const arr = map.get(c.task_id) || [];
      arr.push(c);
      map.set(c.task_id, arr);
    }
    return map;
  }, [allComments]);

  const conversations = useMemo(() => {
    return scopedTasks
      .map((task) => {
        const cs = commentsByTask.get(task.id) || [];
        return { task, count: cs.length, lastComment: cs[0] };
      })
      .sort((a, b) => {
        const at = a.lastComment ? new Date(a.lastComment.created).getTime() : new Date(a.task.created).getTime();
        const bt = b.lastComment ? new Date(b.lastComment.created).getTime() : new Date(b.task.created).getTime();
        return bt - at;
      });
  }, [scopedTasks, commentsByTask]);

  const filteredConversations = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(({ task }) =>
      task.name.toLowerCase().includes(q) ||
      (task.expand?.plan_id?.name || "").toLowerCase().includes(q) ||
      (task.expand?.executor_id?.name || task.expand?.executor_id?.email || "").toLowerCase().includes(q)
    );
  }, [conversations, taskSearch]);

  const channels = useMemo(() => {
    const list: ChannelItem[] = [
      { key: "org", label: "Nhóm Cơ quan", sub: "Toàn bộ phòng ban & tổ chuyên môn", icon: Building2, ref: { type: "org" } },
    ];
    if (userDeptId) {
      const d = departments?.find((x) => x.id === userDeptId);
      if (d) list.push({ key: `dept:${d.id}`, label: d.name, sub: "Phòng ban", icon: Briefcase, ref: { type: "department", deptId: d.id } });
    }
    for (const gid of myGroupIds) {
      const g = groups?.find((x) => x.id === gid);
      if (g) list.push({ key: `group:${g.id}`, label: g.name, sub: `${g.code} · Tổ chuyên môn`, icon: Users, ref: { type: "group", groupId: g.id } });
    }
    return list;
  }, [departments, groups, userDeptId, myGroupIds]);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.label.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
  }, [channels, channelSearch]);

  const selectedTask = useMemo(
    () => (selectedTaskId ? scopedTasks.find((t) => t.id === selectedTaskId) : undefined),
    [selectedTaskId, scopedTasks]
  );

  const selectedChannel = useMemo(
    () => channels.find((c) => c.key === selectedChannelKey),
    [channels, selectedChannelKey]
  );

  useEffect(() => {
    if (activeTab !== "nhiem-vu") return;
    if (selectedTaskId && !selectedTask) {
      setSelectedTaskId(conversations[0]?.task.id ?? null);
    }
    if (!selectedTaskId && conversations.length > 0) {
      setSelectedTaskId(conversations[0].task.id);
    }
  }, [activeTab, selectedTaskId, selectedTask, conversations, setSelectedTaskId]);

  useEffect(() => {
    if (activeTab !== "nhom") return;
    if (selectedChannelKey && !selectedChannel) {
      setSelectedChannelKey(channels[0]?.key ?? null);
    }
    if (!selectedChannelKey && channels.length > 0) {
      setSelectedChannelKey(channels[0].key);
    }
  }, [activeTab, selectedChannelKey, selectedChannel, channels, setSelectedChannelKey]);

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <TabBar
          variant="page"
          tabs={[
            { key: "nhiem-vu", label: "Trao đổi nhiệm vụ", icon: Briefcase, gradient: "from-indigo-500 to-blue-600" },
            { key: "nhom", label: "Nhóm trao đổi", icon: Users, gradient: "from-teal-500 to-emerald-600" },
          ]}
          active={activeTab}
          onChange={(k) => setActiveTab(k as "nhiem-vu" | "nhom")}
          counts={{ "nhiem-vu": conversations.length, "nhom": channels.length }}
        />
        <span className="hidden text-xs text-slate-400 sm:block dark:text-slate-500">Cập nhật theo thời gian thực</span>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-4">
        {activeTab === "nhiem-vu" ? (
          <>
            <div className="flex w-full lg:w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-0 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <MessagesSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Nhiệm vụ</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{conversations.length} cuộc trao đổi</p>
                </div>
              </div>
              <div className="px-3 pt-2.5">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Tìm nhiệm vụ..."
                    className="w-full bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto py-2">
                {tasksLoading && <div className="flex justify-center py-6"><Spinner /></div>}
                {!tasksLoading && filteredConversations.length === 0 && (
                  <EmptyState icon={MessageCircle} message="Không có nhiệm vụ trong phạm vi" size="sm" className="py-8" />
                )}
                {filteredConversations.map(({ task, count, lastComment }) => {
                  const active = task.id === selectedTaskId;
                  return (
                    <button key={task.id} onClick={() => setSelectedTaskId(task.id)}
                      className={`flex w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
                        active ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-400 dark:bg-indigo-900/30" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                        active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {(task.name || "N")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{task.name}</span>
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                            {lastComment ? formatTime(lastComment.created) : ""}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                          {task.expand?.plan_id?.name || "Nhiệm vụ độc lập"}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {lastComment
                              ? <>{lastComment.expand?.user_id?.name || lastComment.expand?.user_id?.email || "—"}: {lastComment.content?.trim() || "[Đính kèm]"}</>
                              : "Chưa có trao đổi"}
                          </span>
                          {count > 0 && (
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
                            }`}>{count}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-0 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-[10px] font-bold text-white">
                    {selectedTask ? (selectedTask.name || "N")[0].toUpperCase() : "?"}
                  </div>
                  <div className="min-w-0">
                    {selectedTask && (
                      <>
                        <Link to={`/tasks/${selectedTask.id}`} className="block truncate text-xs font-semibold text-slate-700 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-300">
                          {selectedTask.name}
                        </Link>
                        <p className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                          {selectedTask.expand?.plan_id && (
                            <>
                              <Link to={`/plans/${selectedTask.plan_id}`} className="truncate hover:text-indigo-500">{selectedTask.expand.plan_id.name}</Link>
                              <ChevronRight className="h-2.5 w-2.5" />
                            </>
                          )}
                          <span className={`rounded px-1.5 py-0.5 ${TASK_STATUS_STYLES[selectedTask.status]}`}>
                            {TASK_STATUS_LABELS[selectedTask.status]}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {commentsError || tasksError ? (
                <ErrorState message="Không thể tải nội dung trao đổi" onRetry={() => { refetchTasks(); refetchComments(); }} />
              ) : selectedTask ? (
                <div className="flex-1 min-h-0">
                  <CommentSection taskId={selectedTask.id} taskStatus={selectedTask.status} />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState icon={MessageCircle} message="Chọn một nhiệm vụ để xem trao đổi" size="md" />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex w-full lg:w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-0 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Kênh trao đổi</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{channels.length} kênh trong phạm vi của bạn</p>
                </div>
              </div>
              <div className="px-3 pt-2.5">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="Tìm kênh..."
                    className="w-full bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto py-2">
                {filteredChannels.length === 0 && (
                  <EmptyState icon={Users} message="Không có kênh trao đổi" size="sm" className="py-8" />
                )}
                {filteredChannels.map((c) => {
                  const active = c.key === selectedChannelKey;
                  const Icon = c.icon;
                  return (
                    <button key={c.key} onClick={() => setSelectedChannelKey(c.key)}
                      className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
                        active ? "border-teal-500 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-900/30" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{c.label}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">{c.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-0 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
                  {selectedChannel ? <selectedChannel.icon className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{selectedChannel?.label || "Kênh trao đổi"}</p>
                  <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{selectedChannel?.sub || ""}</p>
                </div>
              </div>
              {selectedChannel ? (
                <div className="flex-1 min-h-0">
                  <ChannelChat channel={selectedChannel.ref} />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState icon={MessagesSquare} message="Chọn một kênh để trao đổi" size="md" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
