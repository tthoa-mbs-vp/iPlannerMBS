/// <reference path="../pb_data/types.d.ts" />

// Pre-deploy hardening: close field-level fail-open gaps that collection rules cannot express.
// Collection rules only gate "who can update a record"; these guards gate WHAT they may change.
// NOTE: PB 0.26 executes each handler in an isolated context, so helpers must be required
// from helpers.js inside each handler (top-level functions are invisible to handlers).
//
// A1: EVERY onRecordUpdateRequest guard lives in this SINGLE handler. Registering the same
// event from multiple *.pb.js files makes PB run only ONE file's handlers nondeterministically,
// so tasks / attendance_logs / leave_requests / users / proposals / chat_messages are all dispatched here.

onRecordUpdateRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.record ? (e.record.collection() ? e.record.collection().name : "") : ""
  if (!name) return e.next()
  var info = e.requestInfo()
  if (!info) return e.next()
  H.ensureEnabled(info) // H3: disabled accounts lose write access immediately
  var actor = info.auth

  // ---- users: block self-service changes to privilege-bearing fields ----
  // Only can_manage role holders (or superusers) may change role_id/verified/disabled/group_ids.
  if (name === "users" || name === "_pb_users_auth_") {
    if (!actor) return e.next()
    if (actor.isSuperuser && actor.isSuperuser()) return e.next()
    if (!actor.collection || actor.collection().name !== "users") return e.next()
    if (actor.id !== e.record.id) return e.next()

    var roleId = actor.getString("role_id")
    if (roleId) {
      try {
        var role = $app.findRecordById("roles", roleId)
        if (role && role.getBool("can_manage")) return e.next()
      } catch (ex) { /* ignore */ }
    }

    var original = null
    try { original = $app.findRecordById("users", e.record.id) } catch (ex) { throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại") }
    if (!original) throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại")

    var PROTECTED = ["role_id", "verified", "disabled", "group_ids", "department_id", "email"]
    for (var i = 0; i < PROTECTED.length; i++) {
      if (!H.eq(original.get(PROTECTED[i]), e.record.get(PROTECTED[i]))) {
        throw new ForbiddenError("Bạn không có quyền thay đổi thông tin phân quyền của mình")
      }
    }
    return e.next()
  }

  // ---- tasks: executor/supervisor may only do status transitions, never soft-delete or self-rate ----
  // The tasks.updateRule grants executor_id/supervisor_id full update access; without this guard an
  // executor could set status="completed" + rating=10 + rated_by_id=self (inflating their KPI), or
  // is_deleted=true bypassing can_delete_tasks.
  if (name === "tasks") {
    var ri = H.roleInfo(actor)
    if (!actor) return e.next()
    var actorId = actor.id

    var original = null
    try { original = $app.findRecordById("tasks", e.record.id) } catch (ex) { throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại") }
    if (!original) throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại")

    // M8: server-authoritative completion stamp — runs BEFORE the can_manage/superuser bypass
    // so the bypass cannot become a backdating loophole. The client's completed_at is never
    // trusted, from any role: a supervisor/editor/manager could backdate completion to dodge
    // the KPI lateness penalty, or rewrite the stamp of an already-completed task. Stamped on
    // the transition INTO completed, immutable while completed, cleared when leaving it.
    var newStatus = e.record.getString("status")
    var oldStatus = original.getString("status")
    if (newStatus === "completed") {
      if (oldStatus !== "completed") {
        e.record.set("completed_at", new Date().toISOString())
      } else if (!H.eq(original.get("completed_at"), e.record.get("completed_at"))) {
        e.record.set("completed_at", original.get("completed_at"))
      }
    } else if (oldStatus === "completed") {
      e.record.set("completed_at", "")
    }

    if (ri.isSuper || ri.canManage) return e.next()

    var isExecutor = original.getString("executor_id") === actorId
    var isSupervisor = original.getString("supervisor_id") === actorId

    // A10: no one may self-rate their own task — including a supervisor who is also the executor.
    if (isExecutor && e.record.getString("rated_by_id") === actorId) {
      throw new ForbiddenError("Bạn không thể tự đánh giá nhiệm vụ của mình")
    }

    // soft-delete (is_deleted=true) still requires can_delete_tasks for everyone
    if (e.record.getBool("is_deleted") !== original.getBool("is_deleted") && !ri.canDeleteTasks) {
      throw new ForbiddenError("Bạn không có quyền xóa nhiệm vụ")
    }

    // can_edit_tasks users may edit fields freely, but an executor can never rate themselves
    if (ri.canEditTasks) {
      return e.next()
    }

    if (!isExecutor && !isSupervisor) return e.next()

    var changed = []
    for (var f = 0; f < H.taskFields.length; f++) {
      var field = H.taskFields[f]
      if (!H.eq(original.get(field), e.record.get(field))) changed.push(field)
    }

    if (isSupervisor) {
      // supervisor may approve/reject (status + rating + completion stamps)
      var SUPER_SAFE = ["status", "deadline", "rating", "rated_by_id", "rated_at", "completed_at", "description", "name"]
      for (var si = 0; si < changed.length; si++) {
        if (SUPER_SAFE.indexOf(changed[si]) === -1) {
          throw new ForbiddenError("Bạn không có quyền thay đổi trường này của nhiệm vụ")
        }
      }
    } else {
      // executor: only status transitions (take / submit for approval)
      for (var ei = 0; ei < changed.length; ei++) {
        if (changed[ei] !== "status") {
          throw new ForbiddenError("Bạn chỉ được cập nhật trạng thái nhiệm vụ của mình")
        }
      }
    }

    if (newStatus !== oldStatus) {
      if (isSupervisor) {
        var SUP_STATUS = ["in_progress", "pending_approval", "completed", "cancelled", "not_started"]
        if (SUP_STATUS.indexOf(newStatus) === -1) throw new ForbiddenError("Trạng thái không hợp lệ")
      } else {
        var EXEC_STATUS = ["in_progress", "pending_approval"]
        if (EXEC_STATUS.indexOf(newStatus) === -1) throw new ForbiddenError("Bạn chỉ được nhận hoặc hoàn thành nhiệm vụ")
      }
    }
    return e.next()
  }

  // ---- attendance_logs: the owner may only set check_out (once), never rewrite the record ----
  // The attendance_logs.updateRule grants @request.auth.id = user_id full update access; without this
  // guard an employee could edit check_in / status (late->on_time) / method to falsify attendance.
  if (name === "attendance_logs") {
    var ri = H.roleInfo(actor)
    if (ri.isSuper || ri.canManage) return e.next()
    if (!actor) return e.next()

    var original = null
    try { original = $app.findRecordById("attendance_logs", e.record.id) } catch (ex) { throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại") }
    if (!original) throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại")
    if (original.getString("user_id") !== actor.id) return e.next()

    var ATT_FIELDS = ["user_id", "check_in", "check_out", "method", "location_gps", "device_info", "status", "notes", "ip_address"]
    var changed = []
    for (var f = 0; f < ATT_FIELDS.length; f++) {
      var field = ATT_FIELDS[f]
      if (!H.eq(original.get(field), e.record.get(field))) changed.push(field)
    }
    for (var i = 0; i < changed.length; i++) {
      if (changed[i] !== "check_out") {
        throw new ForbiddenError("Bạn chỉ được chấm công ra (check_out)")
      }
    }
    // once check_out is recorded it cannot be rewritten
    if (original.getString("check_out") && e.record.getString("check_out") !== original.getString("check_out")) {
      throw new ForbiddenError("Không thể sửa giờ chấm công ra đã lưu")
    }
    // M1: check_out is also server-stamped — only stamped when the request actually (re)sets
    // it, so a client cannot backdate/forward-date the clock-out; no-op PATCHes are untouched.
    if (changed.indexOf("check_out") !== -1) {
      e.record.set("check_out", new Date().toISOString())
    }
    return e.next()
  }

  // ---- leave_requests: the requester must not self-approve/reject or alter the approver ----
  // The leave_requests.updateRule grants @request.auth.id = user_id full update access; without this
  // guard a user could PATCH their own request to status="approved" and skip the approval workflow.
  if (name === "leave_requests") {
    var ri = H.roleInfo(actor)
    if (ri.isSuper || ri.canManage) return e.next()
    if (!actor) return e.next()

    var original = null
    try { original = $app.findRecordById("leave_requests", e.record.id) } catch (ex) { throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại") }
    if (!original) throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại")

    var isOwner = original.getString("user_id") === actor.id

    if (isOwner) {
      var newStatus = e.record.getString("status")
      var oldStatus = original.getString("status")
      if (newStatus !== oldStatus && (newStatus === "approved" || newStatus === "rejected")) {
        throw new ForbiddenError("Không thể tự phê duyệt đơn nghỉ của mình")
      }
      if (!H.eq(original.get("user_id"), e.record.get("user_id"))) {
        throw new ForbiddenError("Không thể thay đổi người nghỉ phép")
      }
      if (!H.eq(original.get("approver_id"), e.record.get("approver_id"))) {
        throw new ForbiddenError("Không thể thay đổi người duyệt")
      }
      return e.next()
    }

    // A9: a non-owner approver (can_approve_leave / assignated approver via updateRule) may only
    // approve/reject — never rewrite the request content (user_id, dates, total_days, ...).
    var LEAVE_APPROVER_SAFE = ["status", "approver_id", "rejection_reason"]
    var LEAVE_FIELDS = ["user_id", "leave_type", "start_date", "end_date", "total_days", "reason", "status", "period", "approver_id", "rejection_reason", "files"]
    var changed = []
    for (var f = 0; f < LEAVE_FIELDS.length; f++) {
      var field = LEAVE_FIELDS[f]
      if (!H.eq(original.get(field), e.record.get(field))) changed.push(field)
    }
    for (var ci = 0; ci < changed.length; ci++) {
      if (LEAVE_APPROVER_SAFE.indexOf(changed[ci]) === -1) {
        throw new ForbiddenError("Bạn chỉ được phê duyệt/từ chối đơn nghỉ")
      }
    }
    return e.next()
  }

  // ---- proposals: guard who can approve/reject/withdraw ----
  // Requester may withdraw their own proposal, but may NOT self-approve/reject.
  // Only the task's supervisor (or a can_manage role / superuser) may approve/reject.
  // Authorization is based on the ORIGINAL record (task_id/requester_id), never the incoming payload.
  if (name === "proposals") {
    var isSuperuser = info && info.hasSuperuserAuth()
    if (isSuperuser) return e.next()

    var targetStatus = e.record?.getString("status")
    if (!targetStatus) return e.next()

    var canManage = false
    var actorId = ""
    if (actor) {
      actorId = actor.id
      if (actor.collection().name === "users") {
        var roleId = actor.getString("role_id")
        if (roleId) {
          try {
            var role = $app.findRecordById("roles", roleId)
            if (role) canManage = role.getBool("can_manage")
          } catch (ex) { /* ignore */ }
        }
      }
    }
    if (canManage) return e.next()

    var original = null
    try { original = $app.findRecordById("proposals", e.record.id) } catch (ex) { throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại") }
    if (!original) throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại")

    var originalStatus = original.getString("status")
    var requesterId = original.getString("requester_id")
    var originalTaskId = original.getString("task_id")

    // If the status is unchanged, it's an ordinary content edit (e.g. reason) — allow the requester.
    if (targetStatus === originalStatus) {
      if (actorId && requesterId === actorId) return e.next()
      throw new ForbiddenError("Bạn không có quyền sửa đề xuất này")
    }

    if (targetStatus === "withdrawn") {
      if (originalStatus === "approved" || originalStatus === "rejected") {
        throw new ForbiddenError("Không thể rút lại đề xuất đã được xử lý")
      }
      if (actorId && requesterId === actorId) return e.next()
      throw new ForbiddenError("Chỉ người tạo đề xuất mới có thể rút lại")
    }

    // approving/rejecting requires being the task's supervisor (based on the original task_id)
    var supervisorId = ""
    if (originalTaskId) {
      try {
        var task = $app.findRecordById("tasks", originalTaskId)
        supervisorId = task.getString("supervisor_id") || ""
      } catch (ex) { /* ignore */ }
    }
    if (actorId && supervisorId === actorId) return e.next()
    throw new ForbiddenError("Chỉ người giám sát nhiệm vụ mới được duyệt/từ chối đề xuất")
  }

  // ---- chat_messages: the author may only edit content/files, never move the message to another channel ----
  // The chat_messages.updateRule already restricts updates to the author (can_manage/superuser pass),
  // but it does not restrict WHAT they may change: without this guard an author could rewrite
  // channel_type / channel_dept_id / channel_group_id to move their message into any channel
  // (including ones they cannot write to), or reassign user_id to someone else.
  if (name === "chat_messages") {
    var cgRi = H.roleInfo(actor)
    if (cgRi.isSuper || cgRi.canManage) return e.next()
    if (!actor) return e.next()

    var cgOriginal = null
    try { cgOriginal = $app.findRecordById("chat_messages", e.record.id) } catch (ex) { throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại") }
    if (!cgOriginal) throw new ForbiddenError("Không thể xác minh dữ liệu hiện tại")
    if (cgOriginal.getString("user_id") !== actor.id) return e.next()

    var CHAT_EDITABLE = ["content", "files"]
    var CHAT_FIELDS = ["channel_type", "channel_dept_id", "channel_group_id", "user_id", "content", "files"]
    var cgChanged = []
    for (var cfi = 0; cfi < CHAT_FIELDS.length; cfi++) {
      var cgField = CHAT_FIELDS[cfi]
      if (!H.eq(cgOriginal.get(cgField), e.record.get(cgField))) cgChanged.push(cgField)
    }
    for (var cgi = 0; cgi < cgChanged.length; cgi++) {
      if (CHAT_EDITABLE.indexOf(cgChanged[cgi]) === -1) {
        throw new ForbiddenError("Bạn chỉ được sửa nội dung và file đính kèm của tin nhắn")
      }
    }
    return e.next()
  }

  return e.next()
})

// H3: also enforce the disabled-account check on deletes. deleteRule already gates WHO may
// delete; this revokes it for disabled accounts (e.g. deleting own pending leave / comments).
// No other collection-level guards are needed here — delete authorization is fully described
// by each collection's deleteRule.
onRecordDeleteRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var info = e.requestInfo()
  if (!info) return e.next()
  H.ensureEnabled(info)
  return e.next()
})

onRecordCreateRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.collection ? (e.collection.name || "") : ""
  var info = e.requestInfo()
  H.ensureEnabled(info) // H3: disabled accounts lose write access immediately

  // ---- announcements: auto-fill author_id from the authenticated user on create ----
  if (name === "announcements") {
    var actor = info ? info.auth : null
    if (!actor) return e.next()
    var actorId = ""
    try { actorId = actor.id || "" } catch (ex) { actorId = "" }
    if (actorId) e.record.set("author_id", actorId)
    return e.next()
  }

  // ---- chat_messages: bind user_id to the actor + restrict posting to channels they may use ----
  // The chat_messages.createRule requires @request.auth.id = user_id, but the client cannot be
  // trusted to supply its own id. In PB 0.26 request hooks run BEFORE the API rules, so setting
  // user_id here lets the rule pass while the value always comes from the session (no spoofing).
  // The client also sends user_id so the rule still holds if the create-rule check is moved
  // before the hook (upcoming v0.27 behavior).
  // Channel access is enforced here because the createRule alone cannot cleanly express
  // org/dept/group membership (1789600000 already gates READS via listRule; this gates writes).
  if (name === "chat_messages") {
    var chatActor = info ? info.auth : null
    if (chatActor && chatActor.isSuperuser && chatActor.isSuperuser()) return e.next()
    if (!chatActor || chatActor.collection().name !== "users") {
      throw new ForbiddenError("Chỉ tài khoản người dùng mới có thể gửi tin nhắn")
    }

    // authoritatively bind the sender (overwrites any client-supplied user_id)
    e.record.set("user_id", chatActor.id)

    var chatRoleId = chatActor.getString("role_id")
    var chatCanManage = false
    if (chatRoleId) {
      try {
        var chatRole = $app.findRecordById("roles", chatRoleId)
        if (chatRole) chatCanManage = chatRole.getBool("can_manage")
      } catch (ex) { /* role missing -> deny by default */ }
    }
    if (chatCanManage) return e.next()

    var chatType = e.record.getString("channel_type")
    if (chatType === "org") return e.next()

    if (chatType === "department") {
      var chatDeptId = e.record.getString("channel_dept_id")
      if (!chatDeptId || chatDeptId !== chatActor.getString("department_id")) {
        throw new ForbiddenError("Bạn không có quyền gửi tin nhắn vào kênh phòng ban này")
      }
      return e.next()
    }

    if (chatType === "group") {
      var chatGroupId = e.record.getString("channel_group_id")
      var chatGroupIds = chatActor.get("group_ids") || []
      if (!Array.isArray(chatGroupIds)) chatGroupIds = [chatGroupIds]
      if (!chatGroupId || chatGroupIds.indexOf(chatGroupId) === -1) {
        throw new ForbiddenError("Bạn không có quyền gửi tin nhắn vào kênh tổ chuyên môn này")
      }
      return e.next()
    }

    throw new ForbiddenError("Loại kênh không hợp lệ")
  }

  // ---- tasks: forbid creating completed/rated/deleted tasks (KPI manipulation) ----
  // can_add_tasks users could otherwise create tasks with status="completed", a backdated
  // completed_at, rating=10 and rated_by_id=<anyone> — the after-create hook in all.pb.js
  // upserts a KPI score immediately, so this would mint fake scores attributed to others.
  // They could also set is_deleted=true to bypass can_delete_tasks and hide the task.
  // can_manage / superusers keep full control. (is_high_impact stays a normal input field.)
  if (name === "tasks") {
    var tActor = info ? info.auth : null
    var tRi = H.roleInfo(tActor)
    if (tRi.isSuper || tRi.canManage) {
      // M8: entering the completed state via create is still a server-stamped event — a
      // manager cannot backdate completed_at on create either (all other fields stay theirs).
      if (e.record.getString("status") === "completed") {
        e.record.set("completed_at", new Date().toISOString())
      }
      return e.next()
    }
    e.record.set("status", "not_started")
    e.record.set("is_deleted", false)
    e.record.set("rating", null)      // number field has min=1, so unset via null
    e.record.set("rated_by_id", "")
    e.record.set("rated_at", null)
    e.record.set("completed_at", null)
    return e.next()
  }

  // ---- attendance_logs: no duplicate check-in per day + server-computed status ----
  // The client previously computed on_time/late and sent it with the record, so an employee could
  // forge check_in times and status via the API. The createRule only binds user_id to the actor,
  // so this guard (a) rejects a second check-in on the same UTC day and (b) recalculates the
  // status from check_in against the active attendance config (fallback 08:15), ignoring the
  // client-supplied value. Check-out remains owner-only via the update guard.
  if (name === "attendance_logs") {
    var attActor = info ? info.auth : null
    if (!attActor || attActor.collection().name !== "users") return e.next()

    // authoritatively bind the employee — overwrites any client-supplied user_id so nobody can
    // create check-in logs for other users (which would block their check-in / fake their day)
    e.record.set("user_id", attActor.id)

    // M1: never trust the client's check_in timestamp. A client could backdate/postdate the
    // check-in (faking on_time or logging a different day), so the server stamps the moment
    // the request arrives. All downstream logic (duplicate-day check, on_time/late status)
    // uses this server-authoritative value. The container must run in company time (see
    // docker-compose TZ) because status is derived with server-local Date methods.
    var attCheckIn = new Date().toISOString()
    e.record.set("check_in", attCheckIn)

    // duplicate check-in within the same UTC day (matches the client's day logic)
    var attDay = attCheckIn.slice(0, 10)
    var attDayStart = new Date(attDay + "T00:00:00Z")
    if (!isNaN(attDayStart.getTime())) {
      var attDayNext = new Date(attDayStart)
      attDayNext.setUTCDate(attDayNext.getUTCDate() + 1)
      var attDup = $app.findRecordsByFilter($app.findCollectionByNameOrId("attendance_logs"), 'user_id="' + attActor.id + '" && check_in >= "' + attDay + ' 00:00:00" && check_in < "' + attDayNext.toISOString() + '"', "", 1, 0)
      if (attDup.length > 0) {
        throw new BadRequestError("Bạn đã chấm công hôm nay rồi")
      }
    }

    // server-side status: never trust the client's value
    var attStatus = "on_time"
    var attConfigs = $app.findRecordsByFilter($app.findCollectionByNameOrId("attendance_configs"), "is_active=true", "office_name", 1, 0)
    var attCfg = attConfigs[0] || null
    var attTime = new Date(attCheckIn)
    if (attCfg && !isNaN(attTime.getTime())) {
      var attParts = (attCfg.getString("work_start_time") || "08:00").split(":")
      var attHour = parseInt(attParts[0], 10)
      var attMin = parseInt(attParts[1], 10)
      if (isNaN(attHour)) attHour = 8
      if (isNaN(attMin)) attMin = 0
      var attTolerance = attCfg.getFloat("late_tolerance_minutes") || 15
      var attThreshold = new Date(attTime)
      attThreshold.setHours(attHour, attMin + attTolerance, 0, 0)
      if (attTime.getTime() > attThreshold.getTime()) attStatus = "late"
    } else if (!isNaN(attTime.getTime())) {
      // no active config: default start 08:00 + 15m grace (same fallback the client used)
      if (attTime.getHours() > 8 || (attTime.getHours() === 8 && attTime.getMinutes() > 15)) attStatus = "late"
    }
    e.record.set("status", attStatus)

    // network verification: a browser cannot read the real WiFi SSID, so the only trustworthy
    // location signal is the request IP observed by the server. The client-supplied ip_address
    // is never trusted for the decision — it is overwritten below with the server-observed value.
    // Admins can whitelist office networks in attendance_configs.allowed_ips (exact IP, "*" or
    // CIDR); when that list is empty we fall back to requiring a private-range address.
    var attRole = H.roleInfo(attActor)
    if (!attRole.isSuper && !attRole.canManage) {
      var attRemote = ""
      // PB 0.39: IP accessors live on the EVENT object (e.realIP()/e.remoteIP()), not on
      // requestInfo() — info.remoteIP no longer exists there (verified against the
      // regenerated types.d.ts and a live instance). e.realIP() is the correct one: it
      // resolves the trusted proxy headers (X-Forwarded-For, configured via
      // PB_TRUST_PROXY + migration 1792300000) and falls back to the raw connection
      // address when no proxy is configured — exactly what this check needs. e.remoteIP()
      // would ALWAYS return the last hop (the proxy IP), silently defeating the check.
      try { attRemote = typeof e.realIP === "function" ? e.realIP() : (typeof e.remoteIP === "function" ? e.remoteIP() : "") } catch (ex) { attRemote = "" }
      attRemote = String(attRemote || "").trim().toLowerCase()
      // normalize IPv4-mapped IPv6 ("::ffff:1.2.3.4" and expanded forms)
      var attV4 = attRemote.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
      if (attV4) attRemote = attV4[1]

      // jsonArr: PB 0.39 returns json-type fields as raw []byte (see helpers.js) —
      // decode to a real string array so an EMPTY list falls through to the
      // private-range fallback instead of silently blocking every check-in.
      var attAllowed = H.jsonArr(attCfg ? attCfg.get("allowed_ips") : null)

      if (attAllowed.length > 0) {
        if (!H.ipInList(attRemote, attAllowed)) {
          throw new ForbiddenError("Thiết bị không nằm trong mạng nội bộ được phép chấm công")
        }
      } else if (!H.isPrivateIp(attRemote)) {
        throw new ForbiddenError("Chấm công chỉ được thực hiện trong mạng nội bộ công ty")
      }
      if (attRemote) e.record.set("ip_address", attRemote)
    }
    return e.next()
  }

  return e.next()
})

// ================= server-side audit logging (A11) =================
// Replaces web/src/services/systemLogService.ts (client-side logAction, bypassable
// by editing JS / forging API calls). These handlers are registered AFTER the guard
// handlers above, and PB runs same-event handlers in registration order, skipping
// later handlers when an earlier one throws — so only requests that passed both the
// collection rules AND the guards are logged (rejected attempts leave no trace, which
// is what a mutation audit wants). Verified on a live PB 0.39 instance:
//   - request hooks fire only after the collection rules pass;
//   - within a file, a throwing earlier handler stops later ones.
// The actor id comes from the server session (info.auth), the IP from e.realIP()
// (trusted-proxy aware). High-volume/low-value collections (chat_messages, comments,
// notifications, presence_* heartbeats/check logs) are intentionally not audited;
// those with self-auditing records (attendance_logs carries user_id+ip itself) are
// also skipped.

onRecordCreateRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.collection ? (e.collection.name || "") : ""
  if (!name || !H.auditCollections[name]) return e.next()
  var info = e.requestInfo()
  H.auditLog({
    actorId: H.auditActorId(info),
    action: "Tạo " + (H.auditNouns[name] || name),
    target: H.recordLabel(e.record),
    ip: H.requestIp(e),
  })
  return e.next()
})

onRecordUpdateRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = ""
  try { name = e.record && e.record.collection ? e.record.collection().name : "" } catch (ex) { name = "" }
  if (!name || !H.auditCollections[name]) return e.next()
  var info = e.requestInfo()
  var original = null
  try { original = $app.findRecordById(name, e.record.id) } catch (ex) { original = null }
  H.auditLog({
    actorId: H.auditActorId(info),
    action: H.auditUpdateAction(name, original, e.record),
    target: name === "tasks" ? H.auditStatusTarget(name, original, e.record) : H.recordLabel(e.record),
    ip: H.requestIp(e),
  })
  return e.next()
})

onRecordDeleteRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = ""
  try { name = e.record && e.record.collection ? e.record.collection().name : "" } catch (ex) { name = "" }
  if (!name || !H.auditCollections[name]) return e.next()
  var info = e.requestInfo()
  H.auditLog({
    actorId: H.auditActorId(info),
    action: "Xóa " + (H.auditNouns[name] || name),
    target: H.recordLabel(e.record),
    ip: H.requestIp(e),
  })
  return e.next()
})
