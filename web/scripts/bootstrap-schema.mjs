// bootstrap-schema.mjs
//
// Creates the full MBS Planner (iPlanner) schema — all 27 business collections in their
// FINAL state (per DATA_DICTIONARY.md, which reflects the schema after all pb_migrations)
// — on a PocketBase instance via the admin API.
//
// Why this exists: backend/pb_migrations/ is not self-bootstrapping (the base collections
// departments/roles/users/plans/tasks/proposals/comments/kpi_scores/notifications/system_logs
// have no `created_*` migration and several migrations reference the developer's local DB),
// so a fresh hosted instance cannot get its schema from migrations. This script is the
// source of truth for hosted deployments (e.g. PocketHost). It is idempotent: existing
// collections are skipped, missing relation fields are patched in afterwards.
//
// Usage:
//   PB_URL=http://localhost:8090 PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... \
//     node web/scripts/bootstrap-schema.mjs
//
// Dependencies: only the `pocketbase` JS SDK (already in web/package.json).

import PocketBase from "pocketbase";
import { PB_URL, getAdminCreds } from "./creds.mjs";

const pb = new PocketBase(PB_URL);
const { email, password } = getAdminCreds();
await pb.collection("_superusers").authWithPassword(email, password);

const log = (msg) => console.log(msg);

// ---- field helpers (mirror the short form used by the repo's own migrations) ----
const text = (id, name, { required = false, max = 0 } = {}) => ({ id, name, type: "text", required, max });
const fieldEmail = (id, name, { required = true } = {}) => ({ id, name, type: "email", required });
const fieldPassword = (id, name, { required = true, min = 8 } = {}) => ({ id, name, type: "password", required, min });
const number = (id, name, { required = false, min = null, max = null, onlyInt = false } = {}) => ({ id, name, type: "number", required, min, max, onlyInt });
const bool = (id, name, { required = false } = {}) => ({ id, name, type: "bool", required });
const date = (id, name, { required = false } = {}) => ({ id, name, type: "date", required });
const select = (id, name, values, { required = true, maxSelect = 1 } = {}) => ({ id, name, type: "select", values, required, maxSelect });
const relation = (id, name, collectionId, { required = false, maxSelect = 1, cascadeDelete = false, minSelect = 0 } = {}) => ({ id, name, type: "relation", collectionId, required, maxSelect, minSelect, cascadeDelete });
const file = (id, name, { required = false, maxSelect = 1, maxSize = 0, mimeTypes = [] } = {}) => ({ id, name, type: "file", required, maxSelect, maxSize, mimeTypes });
const editor = (id, name, { required = false } = {}) => ({ id, name, type: "editor", required });
const json = (id, name, { required = false } = {}) => ({ id, name, type: "json", required });

const USERS_ID = "_pb_users_auth_"; // stable id of the users auth collection
const CHAT_MIME = [
  "image/png", "image/jpeg", "image/gif",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv",
];
// NOTE: no image/svg+xml — SVG can carry scripts and is a stored-XSS vector when
// served from the same origin; avatar uploads are raster formats only.
const AVATAR_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const taskStatus = ["not_started", "in_progress", "pending_approval", "completed", "proposed_extension", "proposed_cancellation", "cancelled"];
const planStatus = ["not_started", "in_progress", "completed", "paused", "cancelled"];
const canManage = (rule) => `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"`;
const authUser = (rule) => `@request.auth.id != ""`;

// ---- collection definitions (final state) ----
const collections = [
  {
    id: "pbc_departments", name: "departments", type: "base",
    listRule: authUser(), viewRule: authUser(), createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    // leader_id added after users is created (avoid circular dependency)
    fields: [text("text_dep_code", "code", { required: true }), text("text_dep_name", "name", { required: true }), bool("bool_dep_counted", "is_counted")],
  },
  {
    id: "pbc_roles", name: "roles", type: "base",
    listRule: authUser(), viewRule: authUser(), createRule: '@request.auth.role_id.can_manage = true', updateRule: '@request.auth.role_id.can_manage = true', deleteRule: '@request.auth.role_id.can_manage = true',
    fields: [
      text("text_role_code", "code", { required: true }), text("text_role_name", "name", { required: true }),
      select("select_role_level", "level", ["leadership", "management", "employee"]),
      select("select_role_scope", "view_scope", ["all", "department", "group", "personal"]),
      bool("bool_role_add_plans", "can_add_plans"), bool("bool_role_edit_plans", "can_edit_plans"), bool("bool_role_del_plans", "can_delete_plans"),
      bool("bool_role_add_tasks", "can_add_tasks"), bool("bool_role_edit_tasks", "can_edit_tasks"), bool("bool_role_del_tasks", "can_delete_tasks"),
      bool("bool_role_manage", "can_manage"), text("text_role_desc", "description"),
      bool("bool_role_appr_leave", "can_approve_leave"), select("select_role_appr_scope", "approval_scope", ["all", "department", "group"], { required: false }),
      bool("bool_role_view_salary", "can_view_salary"),
    ],
  },
  {
    id: "pbc_professional_groups", name: "professional_groups", type: "base",
    listRule: authUser(), viewRule: authUser(), createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      text("text_pg_code", "code", { required: true, max: 100 }), text("text_pg_name", "name", { required: true, max: 200 }),
      text("text_pg_desc", "description", { max: 500 }), relation("rel_pg_dept", "department_id", "pbc_departments"),
    ],
  },
  // NOTE: `users` is not created here — PocketBase auto-creates the default users auth
  // collection (id _pb_users_auth_) on first boot; syncUsers() below patches its rules
  // and app-specific fields instead.
  {
    id: "pbc_plans", name: "plans", type: "base",
    listRule: authUser(), viewRule: authUser(),
    createRule: `@request.auth.role_id.can_add_plans = true || ${canManage()}`,
    updateRule: `@request.auth.role_id.can_edit_plans = true || ${canManage()}`,
    deleteRule: `@request.auth.role_id.can_delete_plans = true || ${canManage()}`,
    fields: [
      text("text_plan_name", "name", { required: true }), text("text_plan_desc", "description"),
      relation("rel_plan_leader", "leader_id", USERS_ID), relation("rel_plan_host_dept", "host_dept_id", "pbc_departments"),
      relation("rel_plan_partner_depts", "partner_dept_ids", "pbc_departments", { maxSelect: 10 }),
      date("date_plan_start", "start_date", { required: true }), date("date_plan_end", "end_date", { required: true }),
      select("select_plan_status", "status", planStatus),
      bool("bool_plan_sudden", "is_sudden"), bool("bool_plan_high_impact", "is_high_impact"),
      number("num_plan_progress", "progress"), bool("bool_plan_deleted", "is_deleted"),
      relation("rel_plan_group", "group_id", "pbc_professional_groups"),
    ],
  },
  {
    id: "pbc_tasks", name: "tasks", type: "base",
    listRule: authUser(), viewRule: authUser(),
    createRule: `@request.auth.role_id.can_add_tasks = true || ${canManage()}`,
    updateRule: `@request.auth.role_id.can_edit_tasks = true || ${canManage()} || @request.auth.id = executor_id || @request.auth.id = supervisor_id`,
    deleteRule: `@request.auth.role_id.can_delete_tasks = true || ${canManage()}`,
    fields: [
      text("text_task_name", "name", { required: true }), text("text_task_desc", "description"),
      relation("rel_task_plan", "plan_id", "pbc_plans"), select("select_task_category", "category", ["normal", "sudden", "important"]),
      relation("rel_task_host_dept", "host_dept_id", "pbc_departments"), relation("rel_task_executor", "executor_id", USERS_ID),
      relation("rel_task_supervisor", "supervisor_id", USERS_ID), relation("rel_task_collabs", "collaborator_ids", USERS_ID, { maxSelect: 10 }),
      date("date_task_start", "start_date", { required: true }), date("date_task_deadline", "deadline", { required: true }),
      select("select_task_status", "status", taskStatus),
      bool("bool_task_recurring", "is_recurring"), select("select_task_recur_type", "recurring_type", ["monthly", "weekly"], { required: false }),
      number("num_task_recur_value", "recurring_value"), bool("bool_task_deleted", "is_deleted"),
      bool("bool_task_ad_hoc", "is_ad_hoc"), bool("bool_task_high_impact", "is_high_impact"),
      relation("rel_task_coord_dept", "coordinating_dept_id", "pbc_departments"), date("date_task_completed", "completed_at"),
      number("num_task_rating", "rating", { min: 1, max: 10, onlyInt: true }), relation("rel_task_rated_by", "rated_by_id", USERS_ID), date("date_task_rated_at", "rated_at"),
    ],
  },
  {
    id: "pbc_proposals", name: "proposals", type: "base",
    listRule: authUser(), viewRule: authUser(),
    createRule: `@request.auth.id = requester_id || ${canManage()}`,
    updateRule: authUser(), deleteRule: canManage(),
    fields: [
      relation("rel_prop_task", "task_id", "pbc_tasks", { cascadeDelete: true }), select("select_prop_type", "type", ["extension", "cancellation"]),
      text("text_prop_reason", "reason", { required: true }), date("date_prop_new_deadline", "new_deadline"),
      select("select_prop_status", "status", ["pending", "approved", "rejected", "withdrawn"]),
      relation("rel_prop_requester", "requester_id", USERS_ID), relation("rel_prop_approver", "approver_id", USERS_ID),
    ],
  },
  {
    id: "pbc_comments", name: "comments", type: "base",
    listRule: authUser(), viewRule: authUser(), createRule: `@request.auth.id = user_id || ${canManage()}`,
    updateRule: "@request.auth.id = user_id", deleteRule: "@request.auth.id = user_id",
    fields: [
      relation("rel_comment_task", "task_id", "pbc_tasks", { cascadeDelete: true }), relation("rel_comment_user", "user_id", USERS_ID),
      text("text_comment_content", "content"), file("file_comment_files", "files", { maxSelect: 99, maxSize: 20971520, mimeTypes: CHAT_MIME }),
      // quote_id (self relation) patched in after creation
    ],
  },
  {
    id: "pbc_kpi_scores", name: "kpi_scores", type: "base",
    listRule: authUser(), viewRule: authUser(), createRule: null, updateRule: null, deleteRule: null,
    fields: [
      relation("rel_kpi_task", "task_id", "pbc_tasks", { cascadeDelete: true }), number("num_kpi_base", "base_score"),
      number("num_kpi_diff", "difficulty_coeff"), number("num_kpi_progress", "progress_score"),
      number("num_kpi_result", "result_rating"), number("num_kpi_final", "final_score"), number("num_kpi_max", "max_converted_score"),
    ],
  },
  {
    id: "pbc_notifications", name: "notifications", type: "base",
    listRule: `@request.auth.id = user_id || ${canManage()}`,
    viewRule: `@request.auth.id = user_id || ${canManage()}`,
    createRule: `@request.auth.id = user_id || ${canManage()}`,
    updateRule: `@request.auth.id = user_id || ${canManage()}`,
    deleteRule: null,
    fields: [
      relation("rel_notif_user", "user_id", USERS_ID), select("select_notif_type", "type", ["mention", "reply", "deadline_warning", "task_update", "proposal_update", "announcement"]),
      text("text_notif_ref", "reference_id"), bool("bool_notif_read", "is_read"),
    ],
  },
  {
    id: "pbc_system_logs", name: "system_logs", type: "base",
    listRule: canManage(), viewRule: canManage(), createRule: null, updateRule: null, deleteRule: null,
    fields: [relation("rel_log_user", "user_id", USERS_ID), text("text_log_action", "action", { required: true }), text("text_log_target", "target"), text("text_log_ip", "ip_address")],
  },
  {
    id: "pbc_employee_profiles", name: "employee_profiles", type: "base",
    listRule: `@request.auth.id = user_id || @request.auth.role_id.can_view_salary = true || ${canManage()}`,
    viewRule: `@request.auth.id = user_id || @request.auth.role_id.can_view_salary = true || ${canManage()}`,
    createRule: canManage(), updateRule: `@request.auth.id = user_id || ${canManage()}`, deleteRule: canManage(),
    fields: [
      relation("rel_prof_user", "user_id", USERS_ID, { required: true }), text("text_prof_phone", "phone"), date("date_prof_dob", "dob"),
      text("text_prof_identity", "identity_card"), text("text_prof_tax", "tax_code"), text("text_prof_bank_acc", "bank_account"),
      text("text_prof_bank_name", "bank_name"), date("date_prof_join", "join_date"), text("text_prof_contract", "contract_type"),
      text("text_prof_emergency", "emergency_contact"),
    ],
  },
  {
    id: "pbc_leave_requests", name: "leave_requests", type: "base",
    listRule: `@request.auth.id = user_id || @request.auth.id = approver_id || ${canManage()} || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && user_id.group_ids ~ @request.auth.group_ids)`,
    viewRule: `@request.auth.id = user_id || @request.auth.id = approver_id || ${canManage()} || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && user_id.group_ids ~ @request.auth.group_ids)`,
    createRule: `@request.auth.id = user_id || ${canManage()}`,
    updateRule: `@request.auth.id = user_id || @request.auth.id = approver_id || ${canManage()} || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && total_days < 3 && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && total_days < 3 && user_id.group_ids ~ @request.auth.group_ids)`,
    deleteRule: `@request.auth.id = user_id && status = "pending" || ${canManage()}`,
    fields: [
      relation("rel_lv_user", "user_id", USERS_ID, { required: true }), select("select_lv_type", "leave_type", ["annual", "sick", "unpaid", "maternity", "special"]),
      date("date_lv_start", "start_date", { required: true }), date("date_lv_end", "end_date", { required: true }),
      number("num_lv_days", "total_days", { required: true }), text("text_lv_reason", "reason", { required: true }),
      select("select_lv_status", "status", ["pending", "approved", "rejected", "cancelled"]),
      relation("rel_lv_approver", "approver_id", USERS_ID), text("text_lv_rejection", "rejection_reason"),
      select("select_lv_period", "period", ["full", "morning", "afternoon"], { required: false }),
    ],
  },
  {
    id: "pbc_leave_balances", name: "leave_balances", type: "base",
    listRule: `@request.auth.id = user_id || ${canManage()}`, viewRule: `@request.auth.id = user_id || ${canManage()}`,
    createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      relation("rel_bal_user", "user_id", USERS_ID, { required: true }), number("num_bal_year", "year", { required: true }),
      number("num_bal_total", "total_days"), number("num_bal_used", "used_days"), number("num_bal_rem", "remaining_days"),
    ],
  },
  {
    id: "pbc_attendance_logs", name: "attendance_logs", type: "base",
    listRule: `@request.auth.id = user_id || ${canManage()}`, viewRule: `@request.auth.id = user_id || ${canManage()}`,
    createRule: `@request.auth.id = user_id || ${canManage()}`, updateRule: `@request.auth.id = user_id || ${canManage()}`,
    deleteRule: canManage(),
    fields: [
      relation("rel_att_user", "user_id", USERS_ID, { required: true }), date("date_att_checkin", "check_in", { required: true }),
      date("date_att_checkout", "check_out"), select("select_att_method", "method", ["gps", "wifi", "face_id", "manual"]),
      text("text_att_gps", "location_gps"), text("text_att_device", "device_info"),
      select("select_att_status", "status", ["on_time", "late", "early_leave", "absent"]), text("text_att_notes", "notes"),
      text("text_att_ip", "ip_address"),
    ],
  },
  {
    id: "pbc_attendance_configs", name: "attendance_configs", type: "base",
    listRule: authUser(), viewRule: authUser(), createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      text("text_cfg_office", "office_name", { required: true }), text("text_cfg_ssid", "wifi_ssid", { required: true }),
      text("text_cfg_bssid", "wifi_bssid"), json("json_cfg_ips", "allowed_ips"),
      text("text_cfg_start", "work_start_time", { required: true }), text("text_cfg_end", "work_end_time", { required: true }),
      number("num_cfg_late", "late_tolerance_minutes"), bool("bool_cfg_active", "is_active"),
    ],
  },
  {
    id: "pbc_qualifications", name: "qualifications", type: "base",
    listRule: `@request.auth.role_id.can_view_salary = true || ${canManage()}`, viewRule: `@request.auth.role_id.can_view_salary = true || ${canManage()}`,
    createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      relation("rel_qual_user", "user_id", USERS_ID), text("text_qual_name", "name", { required: true }),
      text("text_qual_place", "training_place", { required: true }), date("date_qual_start", "start_date"),
      date("date_qual_end", "end_date"), text("text_qual_type", "training_type"), text("text_qual_cert", "certificate_type"),
    ],
  },
  {
    id: "pbc_salary_records", name: "salary_records", type: "base",
    listRule: `@request.auth.role_id.can_view_salary = true || ${canManage()}`, viewRule: `@request.auth.role_id.can_view_salary = true || ${canManage()}`,
    createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      relation("rel_sal_user", "user_id", USERS_ID), date("date_sal_start", "start_date", { required: true }),
      number("num_sal_coeff", "salary_coefficient", { required: true }), number("num_sal_allowance", "allowance_coefficient"),
      text("text_sal_decision", "decision_number"),
    ],
  },
  {
    id: "pbc_work_experiences", name: "work_experiences", type: "base",
    listRule: `@request.auth.role_id.can_view_salary = true || ${canManage()}`, viewRule: `@request.auth.role_id.can_view_salary = true || ${canManage()}`,
    createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      relation("rel_we_user", "user_id", USERS_ID), text("text_we_org", "organization", { required: true }),
      text("text_we_pos", "position", { required: true }), date("date_we_start", "start_date", { required: true }),
      date("date_we_end", "end_date"), text("text_we_desc", "description"),
    ],
  },
  {
    id: "pbc_chat_messages", name: "chat_messages", type: "base",
    listRule: `@request.auth.collectionName = "_superusers" || @request.auth.role_id.can_manage = true || channel_type = "org" || (channel_type = "department" && channel_dept_id = @request.auth.department_id) || (channel_type = "group" && @request.auth.group_ids ~ channel_group_id)`,
    viewRule: `@request.auth.collectionName = "_superusers" || @request.auth.role_id.can_manage = true || channel_type = "org" || (channel_type = "department" && channel_dept_id = @request.auth.department_id) || (channel_type = "group" && @request.auth.group_ids ~ channel_group_id)`,
    createRule: `@request.auth.id = user_id || ${canManage()}`, updateRule: `@request.auth.id = user_id || ${canManage()}`,
    deleteRule: `@request.auth.id = user_id || ${canManage()}`,
    fields: [
      select("select_chat_channel", "channel_type", ["org", "department", "group"]),
      relation("rel_chat_dept", "channel_dept_id", "pbc_departments"), relation("rel_chat_group", "channel_group_id", "pbc_professional_groups"),
      relation("rel_chat_user", "user_id", USERS_ID), text("text_chat_content", "content"),
      file("file_chat_files", "files", { maxSelect: 99, maxSize: 20971520, mimeTypes: CHAT_MIME }),
    ],
  },
  {
    id: "pbc_announcements", name: "announcements", type: "base",
    listRule: `${authUser()} || @request.auth.collectionName = "_superusers"`, viewRule: `${authUser()} || @request.auth.collectionName = "_superusers"`,
    createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      text("text_ann_title", "title", { required: true, max: 200 }), editor("editor_ann_content", "content", { required: true }),
      relation("rel_ann_author", "author_id", USERS_ID, { required: true }), bool("bool_ann_pinned", "is_pinned"),
      bool("bool_ann_active", "is_active"), date("date_ann_published", "published_at"),
    ],
  },
  {
    id: "pbc_archived_tasks", name: "archived_tasks", type: "base",
    listRule: canManage(), viewRule: canManage(), createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      text("text_arch_orig", "original_id", { required: true }), text("text_arch_name", "name", { required: true }),
      text("text_arch_desc", "description"), relation("rel_arch_plan", "plan_id", "pbc_plans"),
      relation("rel_arch_exec", "executor_id", USERS_ID), relation("rel_arch_super", "supervisor_id", USERS_ID),
      relation("rel_arch_appr", "approver_id", USERS_ID), select("select_arch_status", "status", taskStatus),
      select("select_arch_priority", "priority", ["low", "medium", "high", "urgent"], { required: false }),
      date("date_arch_start", "start_date"), date("date_arch_due", "due_date"), date("date_arch_comp", "completion_date"),
      number("num_arch_progress", "progress"), date("date_arch_time", "archived_at", { required: true }),
    ],
  },
  {
    id: "pbc_archived_comments", name: "archived_comments", type: "base",
    listRule: canManage(), viewRule: canManage(), createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      relation("rel_archc_task", "archived_task_id", "pbc_archived_tasks", { required: true }), relation("rel_archc_user", "user_id", USERS_ID),
      text("text_archc_content", "content", { required: true }), date("date_archc_created", "original_created"),
    ],
  },
  {
    id: "pbc_archived_plans", name: "archived_plans", type: "base",
    listRule: canManage(), viewRule: canManage(), createRule: canManage(), updateRule: canManage(), deleteRule: canManage(),
    fields: [
      text("text_archp_orig", "original_id", { required: true }), text("text_archp_name", "name", { required: true }),
      text("text_archp_desc", "description"), relation("rel_archp_leader", "leader_id", USERS_ID),
      relation("rel_archp_host", "host_dept_id", "pbc_departments"), relation("rel_archp_partners", "partner_dept_ids", "pbc_departments", { maxSelect: 50 }),
      relation("rel_archp_group", "group_id", "pbc_professional_groups"), date("date_archp_start", "start_date"),
      date("date_archp_end", "end_date"), select("select_archp_status", "status", planStatus),
      bool("bool_archp_sudden", "is_sudden"), bool("bool_archp_high", "is_high_impact"),
      number("num_archp_progress", "progress"), date("date_archp_time", "archived_at", { required: true }),
    ],
  },
  {
    id: "pbc_presence_heartbeats", name: "presence_heartbeats", type: "base",
    listRule: `@request.auth.id = user_id || ${canManage()}`, viewRule: `@request.auth.id = user_id || ${canManage()}`,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      relation("rel_hb_user", "user_id", USERS_ID, { required: true, cascadeDelete: true }), date("date_hb_seen", "last_seen_at", { required: true }),
      text("text_hb_device", "device_info", { max: 255 }),
    ],
  },
  {
    id: "pbc_presence_campaigns", name: "presence_campaigns", type: "base",
    listRule: `${authUser()} || @request.auth.collectionName = "_superusers"`, viewRule: `${authUser()} || @request.auth.collectionName = "_superusers"`,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      text("text_cmp_name", "name", { required: true, max: 200 }), select("select_cmp_status", "status", ["active", "closed"]),
      relation("rel_cmp_started_by", "started_by", USERS_ID, { cascadeDelete: true }), date("date_cmp_start", "started_at", { required: true }),
      date("date_cmp_end", "ended_at"), text("text_cmp_notes", "notes", { max: 2000 }),
    ],
  },
  {
    id: "pbc_presence_check_logs", name: "presence_check_logs", type: "base",
    listRule: canManage(), viewRule: canManage(), createRule: null, updateRule: null, deleteRule: null,
    fields: [
      relation("rel_log_campaign", "campaign_id", "pbc_presence_campaigns", { required: true, cascadeDelete: true }),
      relation("rel_log_user", "user_id", USERS_ID, { required: true, cascadeDelete: true }), bool("bool_log_responded", "responded"),
      date("date_log_responded_at", "responded_at"), text("text_log_device", "device_info", { max: 255 }),
    ],
  },
];

// fields patched in after their relation target exists (keyed by collection NAME)
const postPatches = [
  {
    collection: "departments",
    fields: [relation("rel_dep_leader", "leader_id", USERS_ID)],
  },
  {
    collection: "comments",
    fields: [relation("rel_comment_quote", "quote_id", "pbc_comments")],
  },
];

// collections that must exist before `users` is patched (users references them)
const PREREQ_NAMES = ["departments", "roles", "professional_groups"];

async function collectionExists(name) {
  try {
    const res = await pb.collections.getList(1, 1, { filter: `name = "${name}"` });
    return res.items[0] || null;
  } catch (e) {
    return null;
  }
}

// Patch the auto-created users auth collection with the app's rules and fields.
async function syncUsers() {
  const coll = await collectionExists("users");
  if (!coll) {
    console.error("  FAILED  users: collection not found");
    process.exitCode = 1;
    return;
  }
  const names = coll.fields.map((f) => f.name);
  const missing = [
    text("text_pb_name", "name", { max: 255 }),
    file("file_pb_avatar", "avatar", { mimeTypes: AVATAR_MIME }),
    relation("rel_users_dept", "department_id", "pbc_departments"),
    relation("rel_users_role", "role_id", "pbc_roles"),
    number("num_users_reminder", "reminder_days"),
    bool("bool_users_disabled", "disabled"),
    relation("rel_users_groups", "group_ids", "pbc_professional_groups", { maxSelect: 50 }),
  ].filter((f) => !names.includes(f.name));

  try {
    await pb.collections.update(coll.id, {
      listRule: authUser(),
      viewRule: authUser(),
      createRule: canManage(),
      updateRule: `@request.auth.id = id || ${canManage()}`,
      deleteRule: "id = @request.auth.id",
      fields: [...coll.fields, ...missing],
    });
    log(`  patched users (${missing.length} fields added)`);
  } catch (err) {
    console.error(`  FAILED  users: ${JSON.stringify(err?.data?.data || err?.data || err?.message || err)}`);
    process.exitCode = 1;
  }
}

async function createIfMissing(def) {
  const existing = await collectionExists(def.name);
  if (existing) {
    log(`  exists  ${def.name}`);
    return false;
  }
  try {
    await pb.collections.create(def);
    log(`  created ${def.name}`);
    return true;
  } catch (err) {
    // a duplicate that raced in / name conflict with a different id
    const msg = err?.data?.message || err?.message || String(err);
    if (/already exists|duplicate/i.test(msg)) {
      log(`  exists  ${def.name} (${msg})`);
      return false;
    }
    console.error(`  FAILED  ${def.name}: ${JSON.stringify(err?.data?.data || err?.data || err?.message || err)}`);
    process.exitCode = 1;
    return false;
  }
}

async function main() {
  log(`Target: ${PB_URL}`);
  log(`Creating ${collections.length} collections...`);

  let created = 0;
  // 1. prerequisite collections referenced by users
  for (const def of collections.filter((c) => PREREQ_NAMES.includes(c.name))) {
    if (await createIfMissing(def)) created++;
  }
  // 2. patch the auto-created users auth collection
  await syncUsers();
  // 3. everything else (rules may reference users' department_id / role_id / group_ids)
  for (const def of collections.filter((c) => !PREREQ_NAMES.includes(c.name))) {
    if (await createIfMissing(def)) created++;
  }

  log(`Patching post-creation fields...`);
  for (const patch of postPatches) {
    const coll = await collectionExists(patch.collection);
    if (!coll) {
      console.error(`  patch target missing: ${patch.collection}`);
      process.exitCode = 1;
      return;
    }
    const names = coll.fields.map((f) => f.name);
    const toAdd = patch.fields.filter((f) => !names.includes(f.name));
    if (!toAdd.length) { log(`  patched ${patch.collection} (already has fields)`); continue; }
    try {
      await pb.collections.update(coll.id, { fields: [...coll.fields, ...toAdd] });
      log(`  patched ${patch.collection} +${toAdd.map((f) => f.name).join(", ")}`);
    } catch (err) {
      console.error(`  FAILED patch ${patch.collection}: ${err?.data?.message || err?.message || err}`);
      process.exitCode = 1;
      return;
    }
  }

  log(`\nDone. Created ${created} new collections on ${PB_URL}.`);
  log(`Next: run seed-data.mjs to populate departments, roles and users.`);
}

await main();
