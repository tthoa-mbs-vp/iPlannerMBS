/// <reference path="../pb_data/types.d.ts" />

// C5: KPI scores are computed server-side only.
// kpi_scores create/update/delete rules are closed (null) so only superusers could write via API;
// regular computation happens via hooks and a can_manage-gated recalc endpoint.
// NOTE: The onRecordAfterCreateSuccess/onRecordAfterUpdateSuccess handlers for tasks
// live in all.pb.js (single registration per event — registering the same event from
// multiple *.pb.js files makes PB run only one file's handlers, nondeterministically).

// Manual/backfill recalculation for completed tasks, gated to managers + superusers.
routerAdd("POST", "/api/custom/recalc-kpi", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo()) // H3
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể tính lại KPI")
  var tasksColl = $app.findCollectionByNameOrId("tasks")
  var tasks = $app.findRecordsByFilter(tasksColl, 'status="completed" && is_deleted=false', "", 0, 0)
  var created = 0
  var failed = 0
  for (var i = 0; i < tasks.length; i++) {
    try {
      H.upsertKpi(tasks[i])
      created++
    } catch (ex) {
      failed++
    }
  }
  // A11: server-side audit (kpi_scores are written via $app.save internally).
  H.auditLog({
    actorId: H.auditActorId(c.requestInfo()),
    action: "Tính điểm KPI",
    target: "batch (created=" + created + ", failed=" + failed + ")",
    ip: H.requestIp(c),
  })
  return c.json(200, { success: true, created: created, failed: failed })
})
