export interface Department {
  id: string;
  code: string;
  name: string;
  is_counted: boolean;
  leader_id?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
    leader_id?: User;
  };
}

export interface Qualification {
  id: string;
  user_id: string;
  name: string;
  training_place: string;
  start_date: string;
  end_date: string;
  training_type: string;
  certificate_type: string;
  created: string;
  updated: string;
}

export interface SalaryRecord {
  id: string;
  user_id: string;
  start_date: string;
  salary_coefficient: number;
  allowance_coefficient: number;
  decision_number: string;
  created: string;
  updated: string;
}

export interface WorkExperience {
  id: string;
  user_id: string;
  organization: string;
  position: string;
  start_date: string;
  end_date?: string;
  description?: string;
  created: string;
  updated: string;
}

export type RoleLevel = "leadership" | "management" | "employee";
export type ViewScope = "all" | "department" | "group" | "personal";
export type ApprovalScope = "all" | "department" | "group";

/**
 * Cấp bậc chức vụ trong tổ chức: **số nhỏ hơn = cấp cao hơn**.
 *
 *   1 = Giám đốc · 2 = Phó Giám đốc · 3 = Trưởng phòng · … · N = thấp nhất
 *
 * Khác với `level` chỉ có 3 nhóm thô (leadership/management/employee), `rank`
 * phân biệt được các chức vụ trong cùng một nhóm. Trường này thuần mang tính
 * thứ tự/hiển thị — mọi quyền hạn vẫn do `level` + các cờ can_* quyết định.
 */
export type RoleRank = number;

/**
 * Sắp xếp chức vụ theo cấp bậc (số nhỏ trước).
 * Chức vụ chưa gán `rank` (`undefined`/`0`) đẩy xuống cuối danh sách.
 */
export function compareRoleRank(a: RoleRank | undefined, b: RoleRank | undefined): number {
  const norm = (v: RoleRank | undefined) => (v && v > 0 ? v : Number.MAX_SAFE_INTEGER);
  return norm(a) - norm(b);
}

/** `true` khi chức vụ `a` cao hơn chức vụ `b`. Hai chức vụ chưa gán rank thì bằng nhau. */
export function isHigherRank(a: RoleRank | undefined, b: RoleRank | undefined): boolean {
  return compareRoleRank(a, b) < 0;
}

export interface ProfessionalGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  department_id?: string;
  created: string;
  updated: string;
  expand?: {
    department_id?: Department;
  };
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  level: RoleLevel;
  /** Cấp bậc chức vụ, 1 = cao nhất. Xem `RoleRank`. */
  rank?: RoleRank;
  view_scope: ViewScope;
  can_add_plans: boolean;
  can_edit_plans: boolean;
  can_delete_plans: boolean;
  can_add_tasks: boolean;
  can_edit_tasks: boolean;
  can_delete_tasks: boolean;
  can_manage: boolean;
  can_approve_leave: boolean;
  can_view_salary: boolean;
  approval_scope?: ApprovalScope;
  created: string;
  updated: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  department_id?: string;
  role_id?: string;
  group_ids?: string[];
  reminder_days: number;
  verified: boolean;
  disabled: boolean;
  created: string;
  updated: string;
  expand?: {
    department_id?: Department;
    role_id?: Role;
    group_ids?: ProfessionalGroup[];
  };
}

export type PlanStatus = "not_started" | "in_progress" | "completed" | "paused" | "cancelled";

export interface Plan {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  host_dept_id: string;
  partner_dept_ids: string[];
  group_id?: string;
  start_date: string;
  end_date: string;
  status: PlanStatus;
  is_sudden: boolean;
  is_high_impact: boolean;
  is_deleted: boolean;
  progress: number;
  created: string;
  updated: string;
  expand?: {
    leader_id?: User;
    host_dept_id?: Department;
    partner_dept_ids?: Department[];
    group_id?: ProfessionalGroup;
    tasks?: Task[];
  };
}

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "pending_approval"
  | "completed"
  | "proposed_extension"
  | "proposed_cancellation"
  | "cancelled";

export type TaskCategory = "normal" | "sudden" | "important";

export type RecurringType = "monthly" | "weekly";

export interface Task {
  id: string;
  name: string;
  description: string;
  plan_id?: string;
  category: TaskCategory;
  host_dept_id: string;
  executor_id: string;
  supervisor_id: string;
  collaborator_ids: string[];
  start_date: string;
  deadline: string;
  status: TaskStatus;
  is_recurring: boolean;
  recurring_type?: RecurringType;
  recurring_value?: number;
  is_ad_hoc?: boolean;
  is_high_impact?: boolean;
  coordinating_dept_id?: string;
  completed_at?: string;
  /** Xếp loại kết quả, thang 1–10 (số nguyên). */
  rating?: number;
  rated_by_id?: string;
  rated_at?: string;
  is_deleted: boolean;
  created: string;
  updated: string;
  expand?: {
    plan_id?: Plan;
    host_dept_id?: Department;
    executor_id?: User;
    supervisor_id?: User;
    collaborator_ids?: User[];
    coordinating_dept_id?: Department;
    rated_by_id?: User;
  };
}

export type ProposalType = "extension" | "cancellation";
export type ProposalStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface Proposal {
  id: string;
  task_id: string;
  type: ProposalType;
  reason: string;
  new_deadline?: string;
  status: ProposalStatus;
  requester_id: string;
  approver_id: string;
  created: string;
  updated: string;
  expand?: {
    task_id?: Task;
    requester_id?: User;
    approver_id?: User;
  };
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  files: string[];
  quote_id?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
    quote_id?: Comment;
  };
}

export type ChatChannelKind = "org" | "department" | "group";

export interface ChatMessage {
  id: string;
  channel_type: ChatChannelKind;
  channel_dept_id?: string;
  channel_group_id?: string;
  user_id: string;
  content: string;
  files: string[];
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
  };
}

export type NotificationType =
  | "mention"
  | "reply"
  | "deadline_warning"
  | "task_update"
  | "proposal_update"
  | "announcement"
  | "surprise_check";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  reference_id: string;
  is_read: boolean;
  created: string;
}

export interface SystemLog {
  id: string;
  user_id: string;
  action: string;
  target: string;
  ip_address: string;
  created: string;
  expand?: {
    user_id?: User;
  };
}

export interface KpiScore {
  id: string;
  task_id: string;
  base_score: number;
  difficulty_coeff: number;
  max_converted_score?: number;
  progress_score: number;
  result_rating: number;
  final_score: number;
  created: string;
  expand?: {
    task_id?: Task;
  };
}

export type AttendanceMethod = "gps" | "wifi" | "face_id" | "manual";
export type AttendanceStatus = "on_time" | "late" | "early_leave" | "absent";

export interface AttendanceConfig {
  id: string;
  office_name: string;
  wifi_ssid: string;
  wifi_bssid?: string;
  allowed_ips?: string[];
  work_start_time: string;
  work_end_time: string;
  late_tolerance_minutes: number;
  is_active: boolean;
  created: string;
  updated: string;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  check_in: string;
  check_out?: string;
  method: AttendanceMethod;
  location_gps?: string;
  device_info?: string;
  ip_address?: string;
  status: AttendanceStatus;
  notes?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
  };
}

export type LeaveType = "annual" | "sick" | "unpaid" | "maternity" | "special";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type LeavePeriod = "full" | "morning" | "afternoon";

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  period?: LeavePeriod;
  approver_id?: string;
  rejection_reason?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
    approver_id?: User;
  };
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
  };
}

export interface EmployeeProfile {
  id: string;
  user_id: string;
  phone?: string;
  dob?: string;
  identity_card?: string;
  tax_code?: string;
  bank_account?: string;
  bank_name?: string;
  join_date?: string;
  contract_type?: string;
  emergency_contact?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_pinned: boolean;
  is_active: boolean;
  published_at?: string;
  created: string;
  updated: string;
  expand?: {
    author_id?: User;
  };
}

export interface ArchivedTask {
  id: string;
  original_id: string;
  name: string;
  description?: string;
  plan_id?: string;
  executor_id?: string;
  supervisor_id?: string;
  approver_id?: string;
  status: "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  start_date?: string;
  due_date?: string;
  completion_date?: string;
  progress?: number;
  archived_at: string;
  created: string;
  updated: string;
  expand?: {
    plan_id?: Plan;
    executor_id?: User;
    supervisor_id?: User;
    approver_id?: User;
  };
}

export interface ArchivedComment {
  id: string;
  archived_task_id: string;
  user_id?: string;
  content: string;
  original_created?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: User;
  };
}

export interface PresenceHeartbeat {
  id: string;
  user_id: string;
  last_seen_at: string;
  device_info?: string;
  created: string;
  updated: string;
}

export type PresenceCampaignStatus = "active" | "closed";

export interface PresenceCampaign {
  id: string;
  name: string;
  status: PresenceCampaignStatus;
  started_by?: string;
  started_at: string;
  ended_at?: string;
  notes?: string;
  created: string;
  updated: string;
}

export interface PresenceCampaignSummary extends PresenceCampaign {
  started_by_name?: string;
  total_logs: number;
  responded: number;
  absent: number;
}

export interface PresenceCheckLog {
  id: string;
  campaign_id: string;
  user_id: string;
  responded: boolean;
  responded_at?: string;
  device_info?: string;
  created: string;
  updated: string;
}

export interface PresentUser {
  user_id: string;
  name: string;
  department_id?: string;
  role_id?: string;
  last_seen_at: string;
  device_info?: string;
}

export interface PresenceCampaignResult {
  ok: boolean;
  campaign_id: string;
  window_start: string;
  window_end: string;
  total_users: number;
  responded: number;
  absent: number;
}

export interface PresenceCheckEntry {
  user_id: string;
  name: string;
  department_id?: string;
  responded: boolean;
  responded_at?: string;
  device_info?: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  int_value?: number;
  created: string;
  updated: string;
}

// --- Surprise Check (Kiểm tra đột xuất) ---

export type SurpriseCheckStatus = "pending" | "responded" | "expired";

export interface SurpriseCheck {
  id: string;
  campaign_id: string;
  user_id: string;
  status: SurpriseCheckStatus;
  password_hash?: string;
  respond_method?: "password" | "biometric";
  responded_at?: string;
  device_info?: string;
  created: string;
  updated: string;
  expand?: {
    campaign_id?: PresenceCampaign;
    user_id?: User;
  };
}

export interface SurpriseCheckCampaign {
  id: string;
  name: string;
  status: "active" | "closed";
  started_by?: string;
  started_at: string;
  ended_at?: string;
  notes?: string;
  target_user_ids?: string[];
  response_window_minutes: number;
  created: string;
  updated: string;
  expand?: {
    started_by?: User;
  };
}


