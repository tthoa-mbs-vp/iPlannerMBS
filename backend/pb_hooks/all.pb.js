// NOTE: PB 0.26 isolates each handler, so helpers are required inside each handler.

onRecordAfterCreateSuccess(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.record?.collection()?.name
  if (!name) return
  try {
    // NOTE: audit logging is handled client-side (web/src/services/systemLogService.ts -> logAction),
    // which records the real session user via the owner-bound system_logs.createRule. Backend-side
    // logging here was removed because these model events (a) have no requestInfo() to read the actor,
    // (b) fire on internal $app.save() calls too (e.g. recalcPlanProgress rewriting plan.progress on
    // every task update), producing misleading spam with an empty/wrong user_id, and (c) duplicated
    // the client logs.

    // ---- plans: recalc progress on task create ----
    if (name === "tasks") {
      var planId = e.record?.getString("plan_id")
      if (planId) H.recalcPlanProgress(planId)
    }

    // ---- tasks: notify participants on task create ----
    if (name === "tasks") {
      var actorId = ""
      try { actorId = e.requestInfo().auth?.id || "" } catch (ex) { actorId = "" }
      var taskForNotif = e.record
      var participantIds = H.taskParticipantIds(taskForNotif)
      for (var pid in participantIds) {
        if (pid === actorId) continue
        H.notifyTask(pid, "task_update", e.record.id, e.record.getString("name"))
      }
    }

    // ---- tasks: compute KPI score on task create (see kpi.pb.js recalc endpoint) ----
    if (name === "tasks") {
      try {
        H.upsertKpi(e.record)
      } catch (ex) {
        console.error("kpi upsert on create fail", ex)
      }
    }

    // ---- comments: notify mentions + participants on comment create ----
    if (name === "comments") {
      var commentTaskId = e.record?.getString("task_id")
      var commentAuthorId = e.record?.getString("user_id")
      var commentContent = e.record?.getString("content") || ""
      var commentTask = H.getTask(commentTaskId)
      if (commentTask) {
        var commentTaskName = commentTask.getString("name") || commentTaskId
        var mentioned = {}
        var usersColl = $app.findCollectionByNameOrId("users")
        var allUsers = $app.findRecordsByFilter(usersColl, "verified=true && disabled=false", "", 0, 0)
        for (var ui = 0; ui < allUsers.length; ui++) {
          var u = allUsers[ui]
          var uname = u.getString("name") || (u.getString("email") || "").split("@")[0]
          if (uname && commentContent.indexOf("@" + uname) >= 0 && u.id !== commentAuthorId) {
            mentioned[u.id] = true
          }
        }
        for (var mid in mentioned) {
          H.notifyTask(mid, "mention", commentTaskId, commentTaskName)
        }
        var replySet = H.taskParticipantIds(commentTask)
        for (var rpid in replySet) {
          if (rpid === commentAuthorId || mentioned[rpid]) continue
          H.notifyTask(rpid, "reply", commentTaskId, commentTaskName)
        }
      }
    }

    // ---- proposals: notify supervisor on proposal create ----
    if (name === "proposals") {
      var requesterId = e.record?.getString("requester_id")
      var proposalTask = H.getTask(e.record?.getString("task_id"))
      if (proposalTask) {
        var recipient = proposalTask.getString("supervisor_id") || proposalTask.getString("executor_id")
        if (recipient && recipient !== requesterId) {
          H.notifyTask(recipient, "proposal_update", proposalTask.id, proposalTask.getString("name"))
        }
      }
    }

    } catch (ex) {
    console.error("all.pb.js: create fail on " + name, ex)
  }
})

onRecordAfterDeleteSuccess(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.record?.collection()?.name
  if (!name) return
  try {
    // ---- tasks: cascade delete related records on permanent delete ----
    if (name === "tasks") {
      var taskId = e.record.id

      // ---- plans: recalc progress on task permanent delete ----
      var planId = e.record?.getString("plan_id")
      if (planId) {
        try { H.recalcPlanProgress(planId) } catch (ex) { console.error("plan recalc on task delete fail", ex) }
      }

      // delete related kpi_scores
      var ksColl = $app.findCollectionByNameOrId("kpi_scores")
      var kpiRecords = $app.findRecordsByFilter(ksColl, 'task_id="' + taskId + '"', "", 0, 0)
      for (var ki = 0; ki < kpiRecords.length; ki++) {
        try { $app.delete(kpiRecords[ki]) } catch (ex) { /* skip */ }
      }

      // delete related proposals (their notifications reference the task and are removed below)
      var propColl = $app.findCollectionByNameOrId("proposals")
      var proposals = $app.findRecordsByFilter(propColl, 'task_id="' + taskId + '"', "", 0, 0)
      for (var pi = 0; pi < proposals.length; pi++) {
        try { $app.delete(proposals[pi]) } catch (ex) { /* skip */ }
      }

      // delete related comments
      var commColl = $app.findCollectionByNameOrId("comments")
      var comments = $app.findRecordsByFilter(commColl, 'task_id="' + taskId + '"', "", 0, 0)
      for (var ci = 0; ci < comments.length; ci++) {
        try { $app.delete(comments[ci]) } catch (ex) { /* skip */ }
      }

      // delete related notifications — matches BOTH the legacy "<taskId>-<name>" format and the
      // current JSON reference_id format ({"taskId":"...","taskName":"..."})
      var notifColl = $app.findCollectionByNameOrId("notifications")
      var notifs = $app.findRecordsByFilter(notifColl, '(reference_id ~ "' + taskId + '-") || (reference_id ~ "\\"taskId\\":\\"' + taskId + '\\"")', "", 0, 0)
      for (var ni = 0; ni < notifs.length; ni++) {
        try { $app.delete(notifs[ni]) } catch (ex) { /* skip */ }
      }
    }

    // ---- plans: make tasks unassigned on permanent delete ----
    if (name === "plans") {
      var planId = e.record.id
      var taskColl = $app.findCollectionByNameOrId("tasks")
      var planTasks = $app.findRecordsByFilter(taskColl, 'plan_id="' + planId + '"', "", 0, 0)
      for (var ti = 0; ti < planTasks.length; ti++) {
        planTasks[ti].set("plan_id", "")
        $app.save(planTasks[ti])
      }
    }

    // NOTE: proposal notifications reference the TASK (see helpers._notifyTask), so they are
    // cleaned up by the task-delete branch above — no per-proposal cleanup needed here.
  } catch (ex) {
    console.error("all.pb.js: delete fail on " + name, ex)
  }
})

onRecordAfterUpdateSuccess(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.record?.collection()?.name
  if (!name) return
  try {
    // NOTE: audit logging is handled client-side via logAction (see the create handler comment above).

    // ---- plans: recalc progress on task update ----
    if (name === "tasks") {
      var planId = e.record?.getString("plan_id")
      if (planId) H.recalcPlanProgress(planId)
    }

    // ---- tasks: notify participants on task update ----
    if (name === "tasks") {
      var updateActorId = ""
      try { updateActorId = e.requestInfo().auth?.id || "" } catch (ex) { updateActorId = "" }
      var updatedParticipants = H.taskParticipantIds(e.record)
      for (var upid in updatedParticipants) {
        if (upid === updateActorId) continue
        H.notifyTask(upid, "task_update", e.record.id, e.record.getString("name"))
      }
    }

    // ---- tasks: recompute KPI score on task update (see kpi.pb.js recalc endpoint) ----
    if (name === "tasks") {
      try {
        H.upsertKpi(e.record)
      } catch (ex) {
        console.error("kpi upsert on update fail", ex)
      }
    }

    // ---- proposals: notify requester on proposal update ----
    if (name === "proposals") {
      var updateRequesterId = e.record?.getString("requester_id")
      var proposalUpdateTask = H.getTask(e.record?.getString("task_id"))
      var proposalRefId = e.record?.id || ""
      var proposalRefName = ""
      if (proposalUpdateTask) {
        proposalRefId = proposalUpdateTask.id
        proposalRefName = proposalUpdateTask.getString("name")
      }
      if (updateRequesterId) {
        H.notifyTask(updateRequesterId, "proposal_update", proposalRefId, proposalRefName)
      }
    }

    } catch (ex) {
    console.error("all.pb.js: update fail on " + name, ex)
  }
})

// ---- proposals: guard who can approve/reject/withdraw is in guards.pb.js (single onRecordUpdateRequest) ----
