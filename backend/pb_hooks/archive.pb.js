/// <reference path="../pb_data/types.d.ts" />

function analyzeArchiveEligibility(cutoffIso) {
  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var plansColl = $app.findCollectionByNameOrId("plans")

  // Load all live tasks/plans once (used by both the trash-priority passes and the
  // age-based pass below). Tasks/plans in the trash bin (is_deleted=true) are the
  // HIGHEST priority archive targets - the user already decided to discard them.
  var allTasks = $app.findRecordsByFilter(tasksColl, "", "updated", 0, 0)
  var allPlans = $app.findRecordsByFilter(plansColl, "", "", 0, 0)

  var handledTaskIds = {}
  var finalEligibleTasks = []
  var finalEligiblePlans = []
  var partialPlanWarnings = []

  // Index live tasks by plan id.
  var tasksByPlan = {}
  for (var i = 0; i < allTasks.length; i++) {
    var t = allTasks[i]
    var planId = t.getString("plan_id")
    if (planId) {
      if (!tasksByPlan[planId]) tasksByPlan[planId] = []
      tasksByPlan[planId].push(t)
    }
  }

  // Split plans into trashed / active.
  var trashedPlans = []
  var activePlans = []
  for (var i2 = 0; i2 < allPlans.length; i2++) {
    if (allPlans[i2].getBool("is_deleted")) trashedPlans.push(allPlans[i2])
    else activePlans.push(allPlans[i2])
  }

  // ---- PRIORITY 1: TRASHED PLANS -> archive the whole plan + every task ----
  // A plan in the trash bin is gone for good, so archive it together with ALL its
  // tasks (any status/age) to avoid orphaning them via the plans delete hook.
  for (var ti = 0; ti < trashedPlans.length; ti++) {
    var tpId = trashedPlans[ti].id
    var tpTasks = tasksByPlan[tpId] || []
    for (var j = 0; j < tpTasks.length; j++) {
      var tpTask = tpTasks[j]
      if (!handledTaskIds[tpTask.id]) {
        handledTaskIds[tpTask.id] = true
        finalEligibleTasks.push(tpTask)
      }
    }
    finalEligiblePlans.push(tpId)
  }

  // ---- PRIORITY 2: TRASHED TASKS (standalone or of live plans) ----
  // Any trashed task is archived unconditionally, regardless of status/age.
  for (var k = 0; k < allTasks.length; k++) {
    var tk = allTasks[k]
    if (tk.getBool("is_deleted") && !handledTaskIds[tk.id]) {
      handledTaskIds[tk.id] = true
      finalEligibleTasks.push(tk)
    }
  }

  // ---- PRIORITY 3: ACTIVE (non-trashed) tasks/plans, age-based ----
  // Candidate tasks: completed/cancelled AND older than cutoff.
  // Use completed_at for completed tasks (immune to later edits bumping `updated`),
  // and updated for cancelled tasks (which carry no completed_at stamp).
  var ageFilter = '((status = "completed" && completed_at != "" && completed_at < "' + cutoffIso + '") || (status = "cancelled" && updated < "' + cutoffIso + '"))'
  var activeCandidates = $app.findRecordsByFilter(tasksColl, ageFilter + ' && is_deleted=false', "-updated", 0, 0)

  var standaloneCandidates = []
  var planEligibleMap = {} // planId -> eligible active tasks
  for (var m = 0; m < activeCandidates.length; m++) {
    var ac = activeCandidates[m]
    if (handledTaskIds[ac.id]) continue
    var aPlanId = ac.getString("plan_id")
    if (!aPlanId) {
      standaloneCandidates.push(ac)
    } else {
      if (!planEligibleMap[aPlanId]) planEligibleMap[aPlanId] = []
      planEligibleMap[aPlanId].push(ac)
    }
  }
  for (var sc = 0; sc < standaloneCandidates.length; sc++) {
    finalEligibleTasks.push(standaloneCandidates[sc])
  }

  // Check each ACTIVE plan: archive it only when it has no leftover tasks that would
  // be orphaned by the plans delete hook (every remaining task is eligible).
  for (var pi = 0; pi < activePlans.length; pi++) {
    var plan = activePlans[pi]
    var pId = plan.id
    var planStatus = plan.getString("status")

    // Remaining active tasks (trashed ones are already handled/archived above).
    var planTasks = tasksByPlan[pId] || []
    var remainingTasks = []
    for (var r = 0; r < planTasks.length; r++) {
      if (!handledTaskIds[planTasks[r].id]) remainingTasks.push(planTasks[r])
    }
    var eligibleNow = planEligibleMap[pId] || []

    if (planStatus !== "completed" && planStatus !== "cancelled") {
      partialPlanWarnings.push({
        plan_id: pId,
        plan_name: plan.getString("name") || pId,
        reason: "Kế hoạch chưa hoàn thành (trạng thái: " + planStatus + "). Giữ lại để bảo toàn Kế hoạch."
      })
      continue
    }

    if (remainingTasks.length === 0) {
      // All tasks of this plan were archived (this run or a previous run) - archive
      // the plan itself, there is nothing left to orphan.
      finalEligiblePlans.push(pId)
      continue
    }

    if (eligibleNow.length === remainingTasks.length) {
      // Every remaining task of this plan is eligible -> archive them all together.
      for (var e = 0; e < eligibleNow.length; e++) {
        if (!handledTaskIds[eligibleNow[e].id]) {
          handledTaskIds[eligibleNow[e].id] = true
          finalEligibleTasks.push(eligibleNow[e])
        }
      }
      finalEligiblePlans.push(pId)
    } else {
      partialPlanWarnings.push({
        plan_id: pId,
        plan_name: plan.getString("name") || pId,
        total_tasks: remainingTasks.length,
        eligible_tasks: eligibleNow.length,
        pending_tasks: remainingTasks.length - eligibleNow.length,
        reason: "Kế hoạch có " + eligibleNow.length + "/" + remainingTasks.length + " nhiệm vụ đủ 6 tháng, còn " + (remainingTasks.length - eligibleNow.length) + " nhiệm vụ chưa đủ điều kiện. Tạm giữ lại để bảo toàn trọn vẹn Kế hoạch."
      })
    }
  }

  return {
    eligibleTasks: finalEligibleTasks,
    eligiblePlans: finalEligiblePlans,
    warnings: partialPlanWarnings
  }
}

function runTaskArchive(months, dryRun) {
  var targetMonths = months || 6
  var cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - targetMonths)
  var cutoffIso = cutoff.toISOString().replace("T", " ")

  var archivedTasksColl = $app.findCollectionByNameOrId("archived_tasks")
  var archivedCommentsColl = $app.findCollectionByNameOrId("archived_comments")
  var archivedPlansColl = $app.findCollectionByNameOrId("archived_plans")
  var commentsColl = $app.findCollectionByNameOrId("comments")

  var analysis = analyzeArchiveEligibility(cutoffIso)
  var eligibleTasks = analysis.eligibleTasks
  var eligiblePlans = analysis.eligiblePlans || []
  var warnings = analysis.warnings

  if (dryRun) {
    return {
      eligible_count: eligibleTasks.length,
      eligible_plans_count: eligiblePlans.length,
      warnings_count: warnings.length,
      warnings: warnings,
      cutoff_date: cutoffIso,
      dry_run: true
    }
  }

  var archivedCount = 0
  var commentCount = 0
  var nowIso = new Date().toISOString()
  var failedPlanIds = {} // planId -> true when ANY of its tasks failed to archive

  for (var i = 0; i < eligibleTasks.length; i++) {
    var t = eligibleTasks[i]
    try {
      // 1. Create archived_task record.
      // plan_id keeps the ORIGINAL plans id: archived_plans.original_id holds the same
      // value, so the archive stores stay cross-linked even after the plan is deleted.
      var sourcePlanId = t.getString("plan_id")
      var archTask = new Record(archivedTasksColl)
      archTask.set("original_id", t.id)
      archTask.set("name", t.getString("name"))
      archTask.set("description", t.getString("description"))
      archTask.set("plan_id", sourcePlanId)
      archTask.set("executor_id", t.getString("executor_id"))
      archTask.set("supervisor_id", t.getString("supervisor_id"))
      archTask.set("status", t.getString("status"))
      // tasks collection has `category` + `is_high_impact` (no `priority` field) -> map category
      var archPriority = (t.getString("category") === "important" || t.getBool("is_high_impact")) ? "high" : (t.getString("category") === "sudden" || t.getBool("is_ad_hoc")) ? "low" : "medium"
      archTask.set("priority", archPriority)
      // archived_tasks schema uses start_date / due_date / completion_date; tasks uses start_date / deadline / completed_at
      archTask.set("start_date", t.getString("start_date"))
      archTask.set("due_date", t.getString("deadline"))
      archTask.set("completion_date", t.getString("completed_at") || t.getString("updated"))
      // Preserve real progress; trashed tasks keep their actual value (not forced to 0).
      var tStatus = t.getString("status")
      archTask.set("progress", tStatus === "completed" ? 100 : (tStatus === "cancelled" ? 0 : t.getFloat("progress")))
      archTask.set("weight", t.getFloat("weight"))
      archTask.set("archived_at", nowIso)
      $app.save(archTask)

      // 2. Move comments
      var relatedComments = $app.findRecordsByFilter(commentsColl, 'task_id="' + t.id + '"', "", 0, 0)
      for (var ci = 0; ci < relatedComments.length; ci++) {
        var c = relatedComments[ci]
        try {
          var archComm = new Record(archivedCommentsColl)
          archComm.set("archived_task_id", archTask.id)
          archComm.set("user_id", c.getString("user_id"))
          archComm.set("content", c.getString("content"))
          archComm.set("original_created", c.getString("created"))
          $app.save(archComm)
          $app.delete(c)
          commentCount++
        } catch (cex) {
          console.error("archive: comment move fail", cex)
        }
      }

      // 3. Delete task from tasks collection
      $app.delete(t)
      archivedCount++
    } catch (ex) {
      console.error("archive: task archive fail for " + t.id, ex)
      // If a task of a plan failed to archive, the plan still has live tasks and
      // must NOT be archived (deleted) this run, otherwise the leftover task would
      // be orphaned and its plan_id unset by the plans delete hook.
      if (t && t.getString("plan_id")) failedPlanIds[t.getString("plan_id")] = true
    }
  }

  // Archive fully-archived plans: when every task of a plan has been moved to the
  // archive, there is no reason to keep the plan in the live `plans` collection.
  // Snapshot it into archived_plans (preserving its stats: completed -> 100,
  // cancelled -> 0) and delete the original record.
  var archivedPlanCount = 0
  for (var pi = 0; pi < eligiblePlans.length; pi++) {
    var pId = eligiblePlans[pi]
    if (failedPlanIds[pId]) continue // one of its tasks failed -> keep plan intact
    try {
      var planRec = $app.findRecordById("plans", pId)

      // Idempotency guard: if a previous run already archived this plan (e.g. the
      // plan delete failed after the snapshot was saved), reuse the existing record
      // instead of creating a duplicate.
      var existingArchPlans = $app.findRecordsByFilter(archivedPlansColl, 'original_id="' + pId + '"', "", 0, 0)
      var archPlan = existingArchPlans[0] || new Record(archivedPlansColl)
      if (!existingArchPlans[0]) {
        archPlan.set("original_id", planRec.id)
        archPlan.set("name", planRec.getString("name"))
        archPlan.set("description", planRec.getString("description"))
        archPlan.set("leader_id", planRec.getString("leader_id"))
        archPlan.set("host_dept_id", planRec.getString("host_dept_id"))
        archPlan.set("partner_dept_ids", planRec.get("partner_dept_ids"))
        archPlan.set("group_id", planRec.getString("group_id"))
        archPlan.set("start_date", planRec.getString("start_date"))
        archPlan.set("end_date", planRec.getString("end_date"))
        archPlan.set("status", planRec.getString("status"))
        archPlan.set("is_sudden", planRec.getBool("is_sudden"))
        archPlan.set("is_high_impact", planRec.getBool("is_high_impact"))
        var planStatus = planRec.getString("status")
        archPlan.set("progress", planStatus === "completed" ? 100 : (planStatus === "cancelled" ? 0 : planRec.getFloat("progress")))
        archPlan.set("archived_at", nowIso)
      }
      $app.save(archPlan)

      $app.delete(planRec)
      archivedPlanCount++
    } catch (ex) {
      console.error("archive: plan archive fail for " + pId, ex)
    }
  }

  return {
    archived_tasks: archivedCount,
    archived_comments: commentCount,
    archived_plans: archivedPlanCount,
    warnings_count: warnings.length,
    warnings: warnings,
    cutoff_date: cutoffIso,
    dry_run: false
  }
}

// Rebuild a live `tasks` record from an archived_tasks record.
// planId is the id of the live plan to link ("" = standalone task).
// Returns { tasks: 1, comments: movedCount }.
function _restoreTask(archTask, planId) {
  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var archivedCommentsColl = $app.findCollectionByNameOrId("archived_comments")
  var commentsColl = $app.findCollectionByNameOrId("comments")

  var newTask = new Record(tasksColl)
  newTask.set("name", archTask.getString("name"))
  newTask.set("description", archTask.getString("description"))
  if (planId) newTask.set("plan_id", planId)
  newTask.set("executor_id", archTask.getString("executor_id"))
  newTask.set("supervisor_id", archTask.getString("supervisor_id"))
  newTask.set("status", archTask.getString("status"))

  // archived priority -> tasks category / flags (reverse of the archive mapping)
  var prio = archTask.getString("priority")
  if (prio === "high" || prio === "urgent") {
    newTask.set("category", "important")
    newTask.set("is_high_impact", true)
  } else if (prio === "low") {
    newTask.set("category", "sudden")
    newTask.set("is_ad_hoc", true)
  } else {
    newTask.set("category", "normal")
  }

  // archived_tasks uses due_date/completion_date; live tasks uses deadline/completed_at
  newTask.set("start_date", archTask.getString("start_date"))
  newTask.set("deadline", archTask.getString("due_date"))
  newTask.set("completed_at", archTask.getString("completion_date"))
  newTask.set("progress", archTask.getFloat("progress"))
  newTask.set("weight", archTask.getFloat("weight"))
  $app.save(newTask)

  // Move comments back (created timestamp cannot be preserved - autodate overwrites it)
  var moved = 0
  var archComments = $app.findRecordsByFilter(archivedCommentsColl, 'archived_task_id="' + archTask.id + '"', "", 0, 0)
  for (var ci = 0; ci < archComments.length; ci++) {
    var ac = archComments[ci]
    try {
      var newComm = new Record(commentsColl)
      newComm.set("task_id", newTask.id)
      newComm.set("user_id", ac.getString("user_id"))
      newComm.set("content", ac.getString("content"))
      $app.save(newComm)
      $app.delete(ac)
      moved++
    } catch (cex) {
      console.error("restore: comment fail", cex)
    }
  }

  $app.delete(archTask)
  return { tasks: 1, comments: moved }
}

// 1. Cron Job: Run at 02:00 on the 1st of every month
cronAdd("archive_old_tasks_cron", "0 2 1 * *", function() {
  try {
    console.log("Starting monthly task archiving cron job...")
    var res = runTaskArchive(6, false)
    console.log("Archiving cron completed:", JSON.stringify(res))
  } catch (err) {
    console.error("Archiving cron failed:", err)
  }
})

// 2. Custom API Endpoint for Manual Execution
routerAdd("POST", "/api/custom/archive-tasks", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo()) // H3
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể thực hiện lưu trữ nhiệm vụ")
  
  var data = $apis.requestInfo(c).body || {}
  var months = data.months ? parseInt(data.months, 10) : 6
  var dryRun = !!data.dry_run

  var res = runTaskArchive(months, dryRun)
  // A11: server-side audit (destructive operation; skip dry runs).
  if (!dryRun) {
    H.auditLog({
      actorId: H.auditActorId(c.requestInfo()),
      action: "Lưu trữ nhiệm vụ",
      target: "tasks=" + res.archived_tasks + ", plans=" + res.archived_plans + ", comments=" + res.archived_comments,
      ip: H.requestIp(c),
    })
  }
  return c.json(200, { success: true, result: res })
})

// 3. Custom API Endpoint for Stats
routerAdd("GET", "/api/custom/archive-stats", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo()) // H3
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể xem thống kê lưu trữ")

  var months = 6
  var cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  var cutoffIso = cutoff.toISOString().replace("T", " ")

  var archivedTasksColl = $app.findCollectionByNameOrId("archived_tasks")
  var archivedCommentsColl = $app.findCollectionByNameOrId("archived_comments")
  var archivedPlansColl = $app.findCollectionByNameOrId("archived_plans")

  var analysis = analyzeArchiveEligibility(cutoffIso)
  var archivedTasks = $app.findRecordsByFilter(archivedTasksColl, "", "", 0, 0)
  var archivedComments = $app.findRecordsByFilter(archivedCommentsColl, "", "", 0, 0)
  var archivedPlans = $app.findRecordsByFilter(archivedPlansColl, "", "", 0, 0)

  return c.json(200, {
    success: true,
    eligible_count: analysis.eligibleTasks.length,
    eligible_plans_count: analysis.eligiblePlans.length,
    warnings_count: analysis.warnings.length,
    warnings: analysis.warnings,
    archived_tasks_count: archivedTasks.length,
    archived_comments_count: archivedComments.length,
    archived_plans_count: archivedPlans.length,
    cutoff_date: cutoffIso
  })
})

// 4. Custom API Endpoint: Restore selected archived tasks/plans back to the live tables.
// Body: { plan_ids?: string[], task_ids?: string[], restore_plan_tasks?: boolean }
// Restoring a plan creates a fresh live plan (progress preserved) and, when
// restore_plan_tasks is true (default), also restores every archived task that
// carries that plan's original_id so the plan is restored as a whole.
routerAdd("POST", "/api/custom/restore-archive", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo()) // H3
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể khôi phục dữ liệu lưu trữ")

  var data = $apis.requestInfo(c).body || {}
  var planIds = Array.isArray(data.plan_ids) ? data.plan_ids : []
  var taskIds = Array.isArray(data.task_ids) ? data.task_ids : []
  var restorePlanTasks = data.restore_plan_tasks !== false

  var archivedTasksColl = $app.findCollectionByNameOrId("archived_tasks")
  var archivedPlansColl = $app.findCollectionByNameOrId("archived_plans")
  var plansColl = $app.findCollectionByNameOrId("plans")

  var restoredPlans = 0
  var restoredTasks = 0
  var restoredComments = 0
  var restoredTaskIds = {} // arch task ids consumed by plan restores (avoid double restore)
  var errors = []

  // ---- restore plans ----
  for (var pi = 0; pi < planIds.length; pi++) {
    var apId = planIds[pi]
    try {
      var archPlan = $app.findRecordById(archivedPlansColl, apId)
      var origPlanId = archPlan.getString("original_id")

      var newPlan = new Record(plansColl)
      newPlan.set("name", archPlan.getString("name"))
      newPlan.set("description", archPlan.getString("description"))
      newPlan.set("leader_id", archPlan.getString("leader_id"))
      newPlan.set("host_dept_id", archPlan.getString("host_dept_id"))
      newPlan.set("partner_dept_ids", archPlan.get("partner_dept_ids"))
      newPlan.set("group_id", archPlan.getString("group_id"))
      newPlan.set("start_date", archPlan.getString("start_date"))
      newPlan.set("end_date", archPlan.getString("end_date"))
      newPlan.set("status", archPlan.getString("status"))
      newPlan.set("is_sudden", archPlan.getBool("is_sudden"))
      newPlan.set("is_high_impact", archPlan.getBool("is_high_impact"))
      var planStatus = archPlan.getString("status")
      newPlan.set("progress", planStatus === "completed" ? 100 : (planStatus === "cancelled" ? 0 : archPlan.getFloat("progress")))
      $app.save(newPlan)
      restoredPlans++

      if (restorePlanTasks) {
        // Find archived tasks of this plan (they keep the original plans id in plan_id)
        var archTasksOfPlan = $app.findRecordsByFilter(archivedTasksColl, 'plan_id="' + origPlanId + '"', "archived_at", 0, 0)
        for (var ti = 0; ti < archTasksOfPlan.length; ti++) {
          var at = archTasksOfPlan[ti]
          if (restoredTaskIds[at.id]) continue
          try {
            var r = _restoreTask(at, newPlan.id)
            restoredTasks += r.tasks
            restoredComments += r.comments
            restoredTaskIds[at.id] = true
          } catch (tex) {
            console.error("restore: plan task fail for " + at.id, tex)
            errors.push("Khôi phục nhiệm vụ " + at.getString("name") + " thất bại")
          }
        }
      }

      $app.delete(archPlan)
    } catch (ex) {
      console.error("restore: plan fail for " + apId, ex)
      errors.push("Khôi phục Kế hoạch " + apId + " thất bại")
    }
  }

  // A11: server-side audit (destructive operation).
  H.auditLog({
    actorId: H.auditActorId(c.requestInfo()),
    action: "Khôi phục dữ liệu lưu trữ",
    target: "plans=" + restoredPlans + ", tasks=" + restoredTasks + ", comments=" + restoredComments,
    ip: H.requestIp(c),
  })

  // ---- restore standalone tasks ----
  for (var ti2 = 0; ti2 < taskIds.length; ti2++) {
    var atId = taskIds[ti2]
    if (restoredTaskIds[atId]) continue
    try {
      var archTask2 = $app.findRecordById(archivedTasksColl, atId)
      // If the original plan is still alive in `plans`, re-link; else standalone.
      var linkPlanId = ""
      var origPlan = archTask2.getString("plan_id")
      if (origPlan) {
        try {
          var livePlan = $app.findRecordById(plansColl, origPlan)
          if (livePlan) linkPlanId = livePlan.id
        } catch (pe) { /* plan gone -> standalone */ }
      }
      var r2 = _restoreTask(archTask2, linkPlanId)
      restoredTasks += r2.tasks
      restoredComments += r2.comments
    } catch (ex) {
      console.error("restore: task fail for " + atId, ex)
      errors.push("Khôi phục Nhiệm vụ " + atId + " thất bại")
    }
  }

  return c.json(200, {
    success: true,
    result: {
      restored_plans: restoredPlans,
      restored_tasks: restoredTasks,
      restored_comments: restoredComments,
      errors: errors
    }
  })
})
