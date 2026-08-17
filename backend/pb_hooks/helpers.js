// Shared helper module for pb_hooks.
// PB 0.26 executes each handler in an isolated context, so top-level functions
// declared in a *.pb.js file are NOT visible inside handlers. The only reliable
// way to share code is a CommonJS module required from within each handler.

// ---- generic ----
function _arr(v) {
  if (Array.isArray(v)) return v
  if (!v) return []
  return [v]
}

// ---- JSON field decoding ----
// PB 0.39 returns a json-type field's value via record.get() as a RAW []byte (a JS
// array of byte values), NOT a parsed JS value — e.g. an empty json array comes back
// as [91,93] (the bytes of "[]"), and ["192.168.1.0/24"] as the bytes of the raw
// JSON text. Decode it robustly so a json array field can be read in any form:
// real parsed array, byte array (PB), raw JSON string, null/empty.
function _jsonArr(v) {
  var out
  if (v === null || v === undefined) return []
  if (typeof v === "string") {
    try { out = JSON.parse(v) } catch (ex) { return [] }
  } else if (Array.isArray(v)) {
    // a real parsed array has string/object entries; a byte array has number entries
    if (v.length > 0 && typeof v[0] === "number") {
      var s = ""
      for (var i = 0; i < v.length; i++) s += String.fromCharCode(v[i])
      try { out = JSON.parse(s) } catch (ex) { return [] }
    } else {
      return v
    }
  } else {
    return [v]
  }
  if (out === null) return []
  return Array.isArray(out) ? out : [out]
}

function _eq(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    var A = Array.isArray(a) ? a : [a]
    var B = Array.isArray(b) ? b : [b]
    if (A.length !== B.length) return false
    for (var i = 0; i < A.length; i++) if (A[i] !== B[i]) return false
    return true
  }
  if (a === b) return true
  // PB records expose typed values for date/autodate fields (DateTime instances);
  // compare scalar values via stringification so equivalent instances match.
  if (a && b && typeof a === "object" && typeof b === "object") return _str(a) === _str(b)
  return false
}

function _str(v) {
  if (v === null || v === undefined) return ""
  if (typeof v === "object") {
    try { return JSON.stringify(v) } catch (ex) { return String(v) }
  }
  return String(v)
}

// ---- network helpers (attendance IP verification) ----
function _ipToInt(ip) {
  var m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  var a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10), d = parseInt(m[4], 10)
  if (a > 255 || b > 255 || c > 255 || d > 255) return null
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0)
}

// True for private/loopback ranges: 10/8, 172.16/12, 192.168/16, 127/8 and IPv6 ::1 / fc00::/7 (ULA).
function _isPrivateIp(ip) {
  var s = String(ip || "").trim().toLowerCase()
  if (!s) return false
  if (s === "::1") return true
  if (s.indexOf("fc") === 0 || s.indexOf("fd") === 0) return true // fc00::/7 unique local
  var v = _ipToInt(s)
  if (v === null) return false
  if ((v >>> 24) === 10) return true
  if ((v >>> 24) === 127) return true
  if ((v >>> 16) === 0xc0a8) return true // 192.168.0.0/16
  var second = (v >>> 16) & 0xff
  if ((v >>> 24) === 172 && second >= 16 && second <= 31) return true // 172.16.0.0/12
  return false
}

// Matches an IP against a list of entries: exact IP, "*" (any), or CIDR (e.g. "192.168.1.0/24").
function _ipInList(ip, list) {
  var s = String(ip || "").trim().toLowerCase()
  if (!s) return false
  var arr = Array.isArray(list) ? list : (typeof list === "string" ? [list] : [])
  for (var i = 0; i < arr.length; i++) {
    var entry = String(arr[i] || "").trim().toLowerCase()
    if (!entry) continue
    if (entry === "*") return true
    if (entry === s) return true
    var slash = entry.indexOf("/")
    if (slash > 0) {
      var base = _ipToInt(entry.slice(0, slash))
      var bits = parseInt(entry.slice(slash + 1), 10)
      var val = _ipToInt(s)
      if (base === null || val === null || isNaN(bits) || bits < 0 || bits > 32) continue
      var mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0)
      if (((base & mask) >>> 0) === ((val & mask) >>> 0)) return true
    }
  }
  return false
}

// ---- role helpers (guards/users/scope/leave/kpi) ----
function _roleInfo(actor) {
  var info = { canManage: false, canEditTasks: false, canDeleteTasks: false, canApproveLeave: false, canViewSalary: false, isSuper: false, roleLevel: "", approvalScope: "" }
  if (!actor) return info
  try {
    info.isSuper = actor.isSuperuser && actor.isSuperuser()
  } catch (ex) { info.isSuper = false }
  if (info.isSuper) return info
  if (!actor.collection || actor.collection().name !== "users") return info
  var roleId = actor.getString("role_id")
  if (!roleId) return info
  try {
    var role = $app.findRecordById("roles", roleId)
    if (role) {
      info.canManage = role.getBool("can_manage")
      info.canEditTasks = role.getBool("can_edit_tasks")
      info.canDeleteTasks = role.getBool("can_delete_tasks")
      info.canApproveLeave = role.getBool("can_approve_leave")
      info.canViewSalary = role.getBool("can_view_salary")
      info.roleLevel = role.getString("level")
      info.approvalScope = role.getString("approval_scope")
    }
  } catch (ex) { /* role missing -> deny by default */ }
  return info
}

// ---- all.pb.js helpers ----
function _getTask(taskId) {
  if (!taskId) return null
  try { return $app.findRecordById("tasks", taskId) } catch (ex) { return null }
}

function _notifyTask(userId, type, taskId, taskName) {
  if (!userId) return
  try {
    var coll = $app.findCollectionByNameOrId("notifications")
    var notif = new Record(coll)
    notif.set("user_id", userId)
    notif.set("type", type)
    // JSON reference (same format as announcements) — robust against "-" in task names
    // and parseable by web/src/hooks/useNotifications.ts decodeRef().
    notif.set("reference_id", JSON.stringify({ taskId: taskId, taskName: taskName || taskId }))
    notif.set("is_read", false)
    $app.save(notif)
  } catch (ex) {
    console.error("notify fail", ex)
  }
}

function _taskParticipantIds(task) {
  var set = {}
  if (!task) return set
  var ex = task.getString("executor_id")
  if (ex) set[ex] = true
  var sup = task.getString("supervisor_id")
  if (sup) set[sup] = true
  var collabs = task.get("collaborator_ids")
  if (Array.isArray(collabs)) {
    for (var ci = 0; ci < collabs.length; ci++) { if (collabs[ci]) set[collabs[ci]] = true }
  }
  return set
}

function _recalcPlanProgress(planId) {
  if (!planId) return
  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var planColl = $app.findCollectionByNameOrId("plans")
  var tasks = $app.findRecordsByFilter(tasksColl, 'plan_id="' + planId + '" && is_deleted=false', "", 0, 0)
  var plan = null
  try { plan = $app.findRecordById(planColl, planId) } catch (ex) { return }
  if (!plan) return
  if (tasks.length === 0) {
    plan.set("progress", 0)
    $app.save(plan)
    return
  }
  var totalWeight = 0
  var weightedProgress = 0
  var allCompleted = true
  var hasStarted = false
  for (var ti = 0; ti < tasks.length; ti++) {
    var t = tasks[ti]
    var weight = Math.max(t.getFloat("weight") || 0, 0)
    totalWeight += weight
    var status = t.getString("status")
    var taskProgress = 0
    if (status === "completed") taskProgress = 100
    else if (status === "pending_approval") taskProgress = 75
    else if (status === "in_progress") taskProgress = 50
    weightedProgress += weight * taskProgress
    if (status !== "completed") allCompleted = false
    if (status === "in_progress" || status === "pending_approval" || status === "completed") hasStarted = true
  }
  var newProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0
  plan.set("progress", newProgress)
  if (allCompleted && plan.getString("status") !== "cancelled") plan.set("status", "completed")
  else if (hasStarted && plan.getString("status") === "not_started") plan.set("status", "in_progress")
  $app.save(plan)
}

function _recomputeLeaveBalance(userId, year) {
  if (!userId || !year) return
  var reqColl = $app.findCollectionByNameOrId("leave_requests")
  var approvedReqs = $app.findRecordsByFilter(reqColl, 'user_id="' + userId + '" && status="approved"', "", 0, 0)
  var usedDays = 0
  for (var i = 0; i < approvedReqs.length; i++) {
    usedDays += approvedReqs[i].getFloat("total_days") || 0
  }
  var balColl = $app.findCollectionByNameOrId("leave_balances")
  var balances = $app.findRecordsByFilter(balColl, 'user_id="' + userId + '" && year=' + year, "", 1, 0)
  var bal = balances[0]
  if (bal) {
    var balTotal = bal.getFloat("total_days") || 12
    bal.set("used_days", usedDays)
    bal.set("remaining_days", balTotal - usedDays)
    $app.save(bal)
  } else {
    var newBal = new Record(balColl)
    newBal.set("user_id", userId)
    newBal.set("year", year)
    newBal.set("total_days", 12)
    newBal.set("used_days", usedDays)
    newBal.set("remaining_days", 12 - usedDays)
    $app.save(newBal)
  }
}

// ---- scope.pb.js helpers ----
function _scopeContext(e) {
  var info = e.requestInfo()
  if (!info || info.hasSuperuserAuth()) return null
  var auth = info.auth
  if (!auth) return null
  if (auth.collection().name !== "users") return null
  // H2: fail-closed default. A missing/deleted role must NOT grant full visibility —
  // previously a user with no role_id (or whose role was deleted) silently got scope="all"
  // and could read every plan/task/KPI. Only a real, loadable role with view_scope="all"
  // keeps full visibility; anything else is narrowed to "personal".
  var viewScope = "personal"
  var canManage = false
  var roleId = auth.getString("role_id")
  if (roleId) {
    try {
      var role = $app.findRecordById("roles", roleId)
      if (role) {
        viewScope = role.getString("view_scope") || "all"
        canManage = role.getBool("can_manage")
      }
    } catch (ex) { /* role deleted or unreadable -> keep fail-closed "personal" */ }
  }
  if (canManage) return null
  return {
    scope: viewScope,
    userId: auth.id,
    deptId: auth.getString("department_id"),
    groupIds: auth.get("group_ids") || [],
  }
}

// H3: revoke access for disabled accounts on every request. `disabled` is a custom users
// field that PocketBase does not enforce — a valid JWT keeps working after deactivation.
// Called from guards.pb.js (create/update/delete), scope.pb.js (list/view, merged with the
// former hr.pb.js handlers) and every custom endpoint. Superusers and non-users are exempt.
function _ensureEnabled(info) {
  if (!info) return
  var a = info.auth
  if (!a) return
  if (a.collection().name !== "users") return
  if (a.getBool("disabled")) {
    throw new ForbiddenError("Tài khoản đã bị vô hiệu hóa")
  }
}

function _loadPlan(planId, cache) {
  if (!planId) return null
  if (cache[planId]) return cache[planId]
  try {
    cache[planId] = $app.findRecordById("plans", planId)
  } catch (ex) {
    cache[planId] = null
  }
  return cache[planId]
}

function _loadTask(taskId, cache) {
  if (!taskId) return null
  if (cache[taskId]) return cache[taskId]
  try {
    cache[taskId] = $app.findRecordById("tasks", taskId)
  } catch (ex) {
    cache[taskId] = null
  }
  return cache[taskId]
}

function _planInScope(plan, ctx) {
  var scope = ctx.scope
  if (scope === "all") return true
  if (scope === "personal") return plan.getString("leader_id") === ctx.userId
  if (scope === "group") {
    var gid = plan.getString("group_id")
    return !!gid && ctx.groupIds.indexOf(gid) !== -1
  }
  if (scope === "department") {
    if (!ctx.deptId) return false
    if (plan.getString("host_dept_id") === ctx.deptId) return true
    return _arr(plan.get("partner_dept_ids")).indexOf(ctx.deptId) !== -1
  }
  return true
}

function _taskInScope(task, ctx, planCache) {
  var scope = ctx.scope
  if (scope === "all") return true
  if (scope === "personal") {
    if (task.getString("executor_id") === ctx.userId) return true
    if (task.getString("supervisor_id") === ctx.userId) return true
    if (_arr(task.get("collaborator_ids")).indexOf(ctx.userId) !== -1) return true
    var p = _loadPlan(task.getString("plan_id"), planCache)
    if (p && p.getString("leader_id") === ctx.userId) return true
    return false
  }
  if (scope === "group") {
    var p = _loadPlan(task.getString("plan_id"), planCache)
    if (!p) return false
    var gid = p.getString("group_id")
    return !!gid && ctx.groupIds.indexOf(gid) !== -1
  }
  if (scope === "department") {
    if (!ctx.deptId) return false
    if (task.getString("host_dept_id") === ctx.deptId) return true
    var p = _loadPlan(task.getString("plan_id"), planCache)
    if (p && _arr(p.get("partner_dept_ids")).indexOf(ctx.deptId) !== -1) return true
    return false
  }
  return true
}

function _personalPlanIds(ctx) {
  var ids = {}
  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var filter = 'executor_id="' + ctx.userId + '" || supervisor_id="' + ctx.userId + '" || collaborator_ids ~ "' + ctx.userId + '"'
  var tasks = $app.findRecordsByFilter(tasksColl, filter, "", 0, 0)
  for (var i = 0; i < tasks.length; i++) {
    var pid = tasks[i].getString("plan_id")
    if (pid) ids[pid] = true
  }
  return ids
}

// ---- hr.pb.js helpers: scope enforcement for HR reads (can_view_salary) ----
// The collections whose sensitive HR reads must be scoped by roles.view_scope.
var _hrCollections = ["salary_records", "employee_profiles", "qualifications", "work_experiences"]

// Returns null when the actor is unrestricted (superuser / can_manage / no salary view),
// otherwise a scope context that hr.pb.js applies to salary_records, employee_profiles,
// qualifications and work_experiences reads so view_scope is honored there too.
function _hrScopeContext(e) {
  var info = e.requestInfo()
  if (!info || info.hasSuperuserAuth()) return null
  var auth = info.auth
  if (!auth || auth.collection().name !== "users") return null
  var roleId = auth.getString("role_id")
  if (!roleId) return null
  try {
    var role = $app.findRecordById("roles", roleId)
    if (!role) return null
    if (role.getBool("can_manage")) return null
    if (!role.getBool("can_view_salary")) return null
    return {
      scope: role.getString("view_scope") || "all",
      userId: auth.id,
      deptId: auth.getString("department_id"),
      groupIds: auth.get("group_ids") || [],
    }
  } catch (ex) { return null }
}

function _hrUserInScope(userId, ctx) {
  if (!ctx || ctx.scope === "all") return true
  if (!userId) return false
  if (ctx.scope === "personal") return userId === ctx.userId
  var user = null
  try { user = $app.findRecordById("users", userId) } catch (ex) { return false }
  if (!user) return false
  if (ctx.scope === "department") return user.getString("department_id") === ctx.deptId
  if (ctx.scope === "group") {
    var ug = user.get("group_ids") || []
    for (var i = 0; i < ctx.groupIds.length; i++) {
      if (ug.indexOf(ctx.groupIds[i]) !== -1) return true
    }
    return false
  }
  return true
}

function _notifyAnnouncement(announcement) {
  try {
    if (!announcement.getBool("is_active")) return
    var usersColl = $app.findCollectionByNameOrId("users")
    var allUsers = $app.findRecordsByFilter(usersColl, "verified=true && disabled=false", "", 0, 0)
    var ref = JSON.stringify({ announcementId: announcement.id, title: announcement.getString("title") })
    var notifColl = $app.findCollectionByNameOrId("notifications")
    for (var i = 0; i < allUsers.length; i++) {
      var notif = new Record(notifColl)
      notif.set("user_id", allUsers[i].id)
      notif.set("type", "announcement")
      notif.set("reference_id", ref)
      notif.set("is_read", false)
      $app.save(notif)
    }
  } catch (ex) {
    console.error("announcement notify fail", ex)
  }
}

// ---- kpi.pb.js helpers ----
function _round1(v) {
  return Math.round(v * 10) / 10
}

function _hasPartnerDept(task) {
  if (!task) return false
  if (task.getString("coordinating_dept_id")) return true
  var planId = task.getString("plan_id")
  if (planId) {
    try {
      var plan = $app.findRecordById("plans", planId)
      if (plan && _arr(plan.get("partner_dept_ids")).length > 0) return true
    } catch (ex) { /* missing plan -> ignore */ }
  }
  return false
}

function _computeKpi(task) {
  var isAdHoc = task.getString("category") === "sudden" || task.getBool("is_ad_hoc")
  var isHighImpact = task.getString("category") === "important" || task.getBool("is_high_impact")

  var baseScore = isAdHoc ? 12 : 10

  var difficultyCoeff = 1.0
  if (isHighImpact) {
    difficultyCoeff = 1.2
  } else if (_hasPartnerDept(task)) {
    difficultyCoeff = 1.1
  }

  var scheduleLevel = 0
  if (task.getString("status") === "completed") {
    var completedAt = task.getString("completed_at") || task.getString("updated")
    var deadline = task.getString("deadline")
    if (completedAt && deadline) {
      var daysLate = (new Date(completedAt).getTime() - new Date(deadline).getTime()) / (1000 * 60 * 60 * 24)
      if (daysLate <= 0) scheduleLevel = 1.0
      else if (daysLate <= 3) scheduleLevel = 0.8
      else if (daysLate <= 5) scheduleLevel = 0.6
      else scheduleLevel = 0.0
    } else {
      // missing deadline or completion stamp -> no lateness evidence, treat as on-time
      scheduleLevel = 1.0
    }
  }

  var rating = task.getFloat("rating") || 0
  var resultLevel = rating / 5.0

  var performanceScore = _round1(baseScore * (0.3 * scheduleLevel + 0.7 * resultLevel))
  var actualScore = _round1(performanceScore * difficultyCoeff)
  var maxConverted = _round1(baseScore * difficultyCoeff)

  return {
    base_score: baseScore,
    difficulty_coeff: difficultyCoeff,
    max_converted_score: maxConverted,
    progress_score: Math.round(scheduleLevel * 100),
    result_rating: rating,
    final_score: actualScore,
  }
}

function _upsertKpi(task) {
  if (!task) return
  var taskId = task.id
  var coll = $app.findCollectionByNameOrId("kpi_scores")
  var existing = $app.findRecordsByFilter(coll, 'task_id="' + taskId + '"', "", 0, 0)
  // task no longer completed -> drop any stale score so it can't linger in reports
  if (task.getString("status") !== "completed") {
    for (var di = 0; di < existing.length; di++) {
      try { $app.delete(existing[di]) } catch (ex) { /* skip */ }
    }
    return
  }
  var rec = existing[0] || new Record(coll)
  var data = _computeKpi(task)
  rec.set("task_id", taskId)
  rec.set("base_score", data.base_score)
  rec.set("difficulty_coeff", data.difficulty_coeff)
  rec.set("max_converted_score", data.max_converted_score)
  rec.set("progress_score", data.progress_score)
  rec.set("result_rating", data.result_rating)
  rec.set("final_score", data.final_score)
  $app.save(rec)
}

function _isManager(c) {
  var info = c.requestInfo()
  if (info.hasSuperuserAuth()) return true
  var actor = info.auth
  if (!actor) return false
  if (actor.collection().name !== "users") return false
  var roleId = actor.getString("role_id")
  if (!roleId) return false
  try {
    var role = $app.findRecordById("roles", roleId)
    return role && role.getBool("can_manage")
  } catch (ex) {
    return false
  }
}

var _taskFields = [
  "name", "description", "plan_id", "category", "host_dept_id", "executor_id", "supervisor_id",
  "collaborator_ids", "start_date", "deadline", "status", "weight", "is_recurring",
  "recurring_type", "recurring_value", "is_deleted", "is_ad_hoc", "is_high_impact",
  "coordinating_dept_id", "completed_at", "rating", "rated_by_id", "rated_at",
]

// ================= server-side audit logging =================
// Replaces the former client-side system_logService.logAction() (web/src/services/
// systemLogService.ts), which any user could bypass by disabling JS or forging API
// calls. Server-side audit runs in the RECORD REQUEST hooks (guards.pb.js) and in
// the custom endpoints — both have requestInfo() (actor) and the event's realIP().
// Verified against the live PB 0.39 instance:
//   - request hooks fire AFTER the collection rules are evaluated, so a firing
//     request hook means the caller passed the permission check (rejected attempts
//     are never logged);
//   - handlers registered later in the same file run after earlier ones and are
//     skipped when an earlier handler throws — so registering the audit handler
//     after the guard handler logs only requests that survived the guards;
//   - after-success hooks (all.pb.js) do NOT have requestInfo() and run with a
//     fresh module cache, so actor/IP capture cannot be bridged to them — hence
//     the write happens in the request phase (a request that reaches the audit
//     handler may still fail server-side validation, a known, minor trade-off).

// Server-observed client IP (trusted-proxy aware, fallback to raw hop).
function _requestIp(e) {
  try {
    if (e && typeof e.realIP === "function") return e.realIP()
    if (e && typeof e.remoteIP === "function") return e.remoteIP()
  } catch (ex) { /* ignore */ }
  return ""
}

// Record id of the actor, or "" for superusers / anonymous (system_logs.user_id is
// a relation to the users collection, so a superuser id cannot be stored there).
function _auditActorId(info) {
  try {
    if (!info || !info.auth) return ""
    var a = info.auth
    if (a.collection && a.collection().name !== "users") return ""
    return a.id || ""
  } catch (ex) { return "" }
}

// Best human-readable label for a record (used as the audit target).
function _recordLabel(rec) {
  if (!rec) return ""
  var fields = ["name", "title", "email", "content"]
  for (var i = 0; i < fields.length; i++) {
    try {
      var v = rec.getString(fields[i])
      if (v) return String(v).slice(0, 120)
    } catch (ex) { /* field may not exist */ }
  }
  return rec.id ? rec.id : ""
}

// Vietnamese nouns per collection, used to build human-readable actions so the
// existing admin LogsPage / task LogTab keep rendering naturally (their icon/color
// logic keys off the "Tạo/Sửa/Xóa" prefixes).
var _auditNouns = {
  tasks: "nhiệm vụ",
  plans: "kế hoạch",
  proposals: "đề xuất",
  users: "người dùng",
  departments: "phòng ban",
  roles: "chức vụ",
  professional_groups: "tổ chuyên môn",
  employee_profiles: "hồ sơ nhân sự",
  salary_records: "bảng lương",
  qualifications: "bằng cấp",
  work_experiences: "kinh nghiệm",
  leave_requests: "đơn nghỉ phép",
  leave_balances: "số dư nghỉ phép",
  attendance_logs: "chấm công",
  attendance_configs: "cấu hình chấm công",
  announcements: "thông báo",
  kpi_scores: "điểm KPI",
}

// Human-readable status labels used in the audit target for status transitions.
var _auditStatusLabels = {
  not_started: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  pending_approval: "Chờ phê duyệt",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  proposed_extension: "Đề xuất gia hạn",
  proposed_cancellation: "Đề xuất hủy",
  paused: "Tạm dừng",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  withdrawn: "Đã rút lại",
  pending: "Chờ xử lý",
}

// Collections whose mutations are audited. High-volume/low-value collections
// (chat_messages, comments, notifications, presence_* heartbeats/check logs) are
// intentionally excluded; attendance_logs carries user_id+ip on the record itself
// and kpi_scores / leave_balances are only ever written server-side via $app.save.
var _auditCollections = {
  tasks: 1, plans: 1, proposals: 1, users: 1, departments: 1, roles: 1,
  professional_groups: 1, employee_profiles: 1, salary_records: 1, qualifications: 1,
  work_experiences: 1, leave_requests: 1, attendance_configs: 1, announcements: 1,
}

// Human-readable action label for an UPDATE, compared against the original record.
// Called from the audit update handler in guards.pb.js (must live in this module —
// PB 0.39 handlers cannot reference top-level bindings of their own *.pb.js file,
// verified empirically: such references crash the request with a silent 400).
function _auditUpdateAction(name, original, record) {
  if (!original) return "Sửa " + (_auditNouns[name] || name)
  var changed = []
  try {
    var fields = original.collection().fields
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i].name
      if (!_eq(original.get(f), record.get(f))) changed.push(f)
    }
  } catch (ex) { /* collection().fields may be unavailable -> generic label */ }

  var noun = _auditNouns[name] || name
  if (name === "tasks" || name === "plans") {
    if (changed.indexOf("is_deleted") !== -1) {
      var softDel = record.getBool("is_deleted")
      return softDel ? "Xóa " + noun + " (soft)" : "Khôi phục " + noun
    }
    if (name === "tasks" && changed.indexOf("status") !== -1) {
      return "Cập nhật trạng thái nhiệm vụ"
    }
  }
  if (name === "leave_requests" && changed.indexOf("status") !== -1) {
    var lrStatus = record.getString("status")
    if (lrStatus === "approved") return "Duyệt đơn nghỉ phép"
    if (lrStatus === "rejected") return "Từ chối đơn nghỉ phép"
    if (lrStatus === "cancelled") return "Hủy đơn nghỉ phép"
  }
  if (name === "proposals" && changed.indexOf("status") !== -1) {
    var prStatus = record.getString("status")
    if (prStatus === "approved") return "Duyệt đề xuất"
    if (prStatus === "rejected") return "Từ chối đề xuất"
    if (prStatus === "withdrawn") return "Rút lại đề xuất"
  }
  return "Sửa " + noun
}

// Status-transition target: "Tên nhiệm vụ → Hoàn thành".
function _auditStatusTarget(name, original, record) {
  try {
    var oldStatus = original ? original.getString("status") : ""
    var newStatus = record.getString("status")
    if (newStatus && newStatus !== oldStatus) {
      var label = _auditStatusLabels[newStatus] || newStatus
      return _recordLabel(record) + " → " + label
    }
  } catch (ex) { /* ignore */ }
  return _recordLabel(record)
}

// Writes one system_logs row. Never throws — audit must never break the main flow.
// NOTE: user_id is a RELATION to the users collection. Setting it to "" fails PB's
// relation validation ("Failed to find all relation records") and poisons the
// request transaction, so null is used when there is no users-collection actor.
function _auditLog(opts) {
  try {
    if (!opts || !opts.action) return
    var coll = $app.findCollectionByNameOrId("system_logs")
    var rec = new Record(coll)
    rec.set("user_id", opts.actorId ? opts.actorId : null)
    rec.set("action", String(opts.action).slice(0, 200))
    rec.set("target", String(opts.target || "").slice(0, 500))
    rec.set("ip_address", String(opts.ip || "").slice(0, 64))
    $app.save(rec)
  } catch (ex) {
    console.error("audit log fail: " + (ex && ex.message ? ex.message : ex))
  }
}

module.exports = {
  taskFields: _taskFields,
  eq: _eq,
  roleInfo: _roleInfo,
  jsonArr: _jsonArr,
  getTask: _getTask,
  notifyTask: _notifyTask,
  taskParticipantIds: _taskParticipantIds,
  scopeContext: _scopeContext,
  loadTask: _loadTask,
  planInScope: _planInScope,
  taskInScope: _taskInScope,
  personalPlanIds: _personalPlanIds,
  hrScopeContext: _hrScopeContext,
  hrUserInScope: _hrUserInScope,
  hrCollections: _hrCollections,
  notifyAnnouncement: _notifyAnnouncement,
  upsertKpi: _upsertKpi,
  recalcPlanProgress: _recalcPlanProgress,
  recomputeLeaveBalance: _recomputeLeaveBalance,
  isManager: _isManager,
  ensureEnabled: _ensureEnabled,
  isPrivateIp: _isPrivateIp,
  ipInList: _ipInList,
  requestIp: _requestIp,
  auditActorId: _auditActorId,
  recordLabel: _recordLabel,
  auditNouns: _auditNouns,
  auditStatusLabels: _auditStatusLabels,
  auditCollections: _auditCollections,
  auditUpdateAction: _auditUpdateAction,
  auditStatusTarget: _auditStatusTarget,
  auditLog: _auditLog,
}
