/// <reference path="../pb_data/types.d.ts" />
// Auto-approve mechanism: tasks in pending_approval and proposals with pending status
// are auto-approved after a configurable delay (default: 2 days).
// Runs every 30 minutes via cronAdd. Setting stored in system_configs collection.

// ---- Helper: read auto-approve config ----
function _getAutoApproveConfig() {
  var coll = $app.findCollectionByNameOrId("system_configs")
  var enabledRecs = $app.findRecordsByFilter(coll, 'key="auto_approve_enabled"', "", 1, 0)
  if (enabledRecs.length === 0) {
    return { enabled: false, delayDays: 2 }
  }
  var rec = enabledRecs[0]
  return {
    enabled: rec.getBool("enabled"),
    delayDays: rec.getInt("int_value") || 2
  }
}

// ---- Helper: auto-approve pending tasks ----
function _autoApproveTasks(cfg) {
  if (!cfg.enabled) return { approved: 0 }

  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var now = new Date()
  var cutoff = new Date(now.getTime() - cfg.delayDays * 24 * 60 * 60 * 1000)
  var cutoffIso = cutoff.toISOString()

  // Find tasks in pending_approval status that are older than the delay
  var pendingTasks = $app.findRecordsByFilter(tasksColl,
    'status="pending_approval" && is_deleted=false && updated < "' + cutoffIso + '"',
    "", 0, 0)

  var approved = 0
  for (var i = 0; i < pendingTasks.length; i++) {
    var task = pendingTasks[i]
    try {
      task.set("status", "completed")
      task.set("completed_at", new Date().toISOString())
      task.set("rating", 1) // Auto-approved = worst rating (không được thẩm định, thang 1-10)
      $app.save(task)
      approved++
    } catch (ex) {
      console.error("auto_approve: failed to approve task " + task.id, ex)
    }
  }
  return { approved: approved }
}

// ---- Helper: auto-approve pending proposals ----
function _autoApproveProposals(cfg) {
  if (!cfg.enabled) return { extensions: 0, cancellations: 0 }

  var propColl = $app.findCollectionByNameOrId("proposals")
  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var now = new Date()
  var cutoff = new Date(now.getTime() - cfg.delayDays * 24 * 60 * 60 * 1000)
  var cutoffIso = cutoff.toISOString()

  // Find pending proposals older than the delay
  var pendingProposals = $app.findRecordsByFilter(propColl,
    'status="pending" && created < "' + cutoffIso + '"',
    "", 0, 0)

  var extensions = 0
  var cancellations = 0

  for (var i = 0; i < pendingProposals.length; i++) {
    var proposal = pendingProposals[i]
    var type = proposal.getString("type")
    var taskId = proposal.getString("task_id")
    if (!taskId) continue

    try {
      var task = $app.findRecordById(tasksColl, taskId)
      if (!task) continue

      if (type === "extension") {
        // Auto-approve extension: update task deadline and reset status
        var newDeadline = proposal.getString("new_deadline")
        if (newDeadline) {
          task.set("deadline", newDeadline)
        }
        task.set("status", "in_progress")
        $app.save(task)

        proposal.set("status", "approved")
        proposal.set("approver_id", "") // system auto-approve
        $app.save(proposal)
        extensions++
      } else if (type === "cancellation") {
        // Auto-approve cancellation: cancel the task
        task.set("status", "cancelled")
        $app.save(task)

        proposal.set("status", "approved")
        proposal.set("approver_id", "") // system auto-approve
        $app.save(proposal)
        cancellations++
      }
    } catch (ex) {
      console.error("auto_approve: failed to approve proposal " + proposal.id, ex)
    }
  }
  return { extensions: extensions, cancellations: cancellations }
}

// ---- Cron Job: Run every 30 minutes ----
cronAdd("auto_approve_stale", "*/30 * * * *", function() {
  try {
    console.log("Starting auto-approve cron job...")
    var cfg = _getAutoApproveConfig()
    if (!cfg.enabled) {
      console.log("Auto-approve is disabled, skipping.")
      return
    }

    var taskResult = _autoApproveTasks(cfg)
    var proposalResult = _autoApproveProposals(cfg)

    console.log("Auto-approve completed:", JSON.stringify({
      tasks_approved: taskResult.approved,
      extension_proposals_approved: proposalResult.extensions,
      cancellation_proposals_approved: proposalResult.cancellations,
      delay_days: cfg.delayDays
    }))
  } catch (err) {
    console.error("Auto-approve cron failed:", err)
  }
})

// ---- API: GET auto-approve settings ----
routerAdd("GET", "/api/custom/auto-approve-settings", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo())
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể xem cài đặt")

  var cfg = _getAutoApproveConfig()
  return c.json(200, {
    success: true,
    enabled: cfg.enabled,
    delay_days: cfg.delayDays
  })
})

// ---- API: PUT auto-approve settings ----
routerAdd("PUT", "/api/custom/auto-approve-settings", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo())
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể sửa cài đặt")

  var data = $apis.requestInfo(c).body || {}
  var coll = $app.findCollectionByNameOrId("system_configs")

  // Get or create the config record
  var existing = $app.findRecordsByFilter(coll, 'key="auto_approve_enabled"', "", 1, 0)
  var rec

  if (existing.length > 0) {
    rec = existing[0]
  } else {
    rec = new Record(coll)
    rec.set("key", "auto_approve_enabled")
  }

  // Update fields
  if (typeof data.enabled === "boolean") {
    rec.set("enabled", data.enabled)
  }
  if (typeof data.delay_days === "number" && data.delay_days >= 1 && data.delay_days <= 30) {
    rec.set("int_value", data.delay_days)
  }

  $app.save(rec)

  // A11: audit
  H.auditLog({
    actorId: H.auditActorId(c.requestInfo()),
    action: "Cập nhật cài đặt tự động phê duyệt",
    target: "enabled=" + rec.getBool("enabled") + ", delay_days=" + rec.getInt("int_value"),
    ip: H.requestIp(c),
  })

  return c.json(200, {
    success: true,
    enabled: rec.getBool("enabled"),
    delay_days: rec.getInt("int_value")
  })
})

// ---- API: POST manual trigger for testing ----
routerAdd("POST", "/api/custom/auto-approve-run", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo())
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể chạy tự động phê duyệt")

  var cfg = _getAutoApproveConfig()
  var taskResult = _autoApproveTasks(cfg)
  var proposalResult = _autoApproveProposals(cfg)

  H.auditLog({
    actorId: H.auditActorId(c.requestInfo()),
    action: "Chạy tự động phê duyệt thủ công",
    target: "tasks=" + taskResult.approved + ", extensions=" + proposalResult.extensions + ", cancellations=" + proposalResult.cancellations,
    ip: H.requestIp(c),
  })

  return c.json(200, {
    success: true,
    tasks_approved: taskResult.approved,
    extension_proposals_approved: proposalResult.extensions,
    cancellation_proposals_approved: proposalResult.cancellations,
    delay_days: cfg.delayDays,
    enabled: cfg.enabled
  })
})
