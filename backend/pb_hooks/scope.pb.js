/// <reference path="../pb_data/types.d.ts" />

// C6: server-side view_scope enforcement for plans + tasks + kpi_scores + comments +
// proposals (M4), and — since the former hr.pb.js handlers were merged here (H4) — for
// the HR collections as well (salary_records, employee_profiles, qualifications,
// work_experiences).
// Replicates the client-side filter semantics of DashboardPage.tsx (overviewTasks/overviewPlans)
// and groupScope.ts so that roles.view_scope is enforced at the API layer.
// NOTE: PB 0.26+ isolates each handler, so helpers are required inside each handler.
// NOTE: ALL list/view scoping lives in this single handler — registering the same event
// from multiple *.pb.js files is unreliable in PB 0.26 (only one file's handlers may run),
// so scope.pb.js is the one and only registration point for onRecordsListRequest /
// onRecordViewRequest. See hr.pb.js (now comment-only) and the H4 note.

onRecordsListRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.collection ? e.collection.name : ""
  var info = e.requestInfo()
  H.ensureEnabled(info) // H3: disabled accounts lose read access immediately
  if (name !== "plans" && name !== "tasks" && name !== "kpi_scores" && name !== "comments" && name !== "proposals" && H.hrCollections.indexOf(name) === -1) return e.next()
  try {
    // ---- HR collections: scope by roles.view_scope for can_view_salary holders ----
    // Collection rules gate WHO may read; this gates WHAT they may see so a department-scoped
    // HR officer cannot list the whole org's salary data. can_manage / superusers bypass.
    if (H.hrCollections.indexOf(name) !== -1) {
      var hrCtx = H.hrScopeContext(e)
      if (!hrCtx) return e.next()
      var hrResult = e.result
      var hrItems = hrResult && hrResult.items ? hrResult.items : (e.records || [])
      for (var hi = hrItems.length - 1; hi >= 0; hi--) {
        var hrec = hrItems[hi]
        if (!hrec) { hrItems.splice(hi, 1); continue }
        if (!H.hrUserInScope(hrec.getString("user_id"), hrCtx)) hrItems.splice(hi, 1)
      }
      return e.next()
    }

    // ---- plans / tasks / kpi_scores ----
    var ctx = H.scopeContext(e)
    if (!ctx || ctx.scope === "all") return e.next()
    var planCache = {}
    var taskCache = {}
    var personalIds = ctx.scope === "personal" ? H.personalPlanIds(ctx) : null
    var result = e.result
    var items = result && result.items ? result.items : (e.records || [])
    // PB JSVM: e.result.items is a Go-managed slice, so filter by removing
    // out-of-scope entries in place (reverse iteration + splice).
    // NOTE: totalItems is intentionally left at the DB-reported value. Rewriting it to the
    // filtered page length would under-report totals for paginated callers; the in-memory
    // scope filter can only see the current page, so callers must fetch enough perPage
    // (the web client uses getFullList with a large batch for scoped collections).
    for (var i = items.length - 1; i >= 0; i--) {
      var rec = items[i]
      if (!rec) { items.splice(i, 1); continue }
      var ok = false
      if (name === "plans") {
        if (ctx.scope === "personal") {
          ok = rec.getString("leader_id") === ctx.userId || !!personalIds[rec.id]
        } else {
          ok = H.planInScope(rec, ctx)
        }
      } else if (name === "tasks") {
        ok = H.taskInScope(rec, ctx, planCache)
      } else {
        // kpi_scores / comments / proposals (M4): scoped through the related task — a
        // task outside the user's view_scope must not leak its discussion or proposals.
        var task = H.loadTask(rec.getString("task_id"), taskCache)
        ok = !!task && H.taskInScope(task, ctx, planCache)
      }
      if (!ok) items.splice(i, 1)
    }
  } catch (ex) {
    // fail-closed: never return unfiltered records on an error
    console.error("scope.pb.js list fail on " + name, ex)
    var res = e.result
    if (res && res.items) { res.totalItems = 0; res.items.length = 0 }
    else if (e.records) e.records.length = 0
  }
  return e.next()
})

onRecordViewRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  var name = e.collection ? e.collection.name : ""
  var info = e.requestInfo()
  H.ensureEnabled(info) // H3: disabled accounts lose read access immediately
  if (name !== "plans" && name !== "tasks" && name !== "kpi_scores" && name !== "comments" && name !== "proposals" && H.hrCollections.indexOf(name) === -1) return e.next()
  var rec = e.record
  if (!rec) return e.next()
  try {
    // ---- HR collections ----
    if (H.hrCollections.indexOf(name) !== -1) {
      var hrCtx = H.hrScopeContext(e)
      if (!hrCtx) return e.next()
      if (!H.hrUserInScope(rec.getString("user_id"), hrCtx)) {
        throw new NotFoundError("The requested resource was not found.")
      }
      return e.next()
    }

    // ---- plans / tasks / kpi_scores ----
    var ctx = H.scopeContext(e)
    if (!ctx || ctx.scope === "all") return e.next()
    var ok = false
    try {
      if (name === "plans") {
        if (ctx.scope === "personal") {
          var personalIds = H.personalPlanIds(ctx)
          ok = rec.getString("leader_id") === ctx.userId || !!personalIds[rec.id]
        } else {
          ok = H.planInScope(rec, ctx)
        }
      } else if (name === "tasks") {
        ok = H.taskInScope(rec, ctx, {})
      } else {
        // kpi_scores / comments / proposals (M4): scoped through the related task
        var task = H.loadTask(rec.getString("task_id"), {})
        ok = !!task && H.taskInScope(task, ctx, {})
      }
    } catch (ex) {
      console.error("scope.pb.js view fail on " + name, ex)
      ok = false
    }
    if (!ok) throw new NotFoundError("The requested resource was not found.")
    return e.next()
  } catch (ex) {
    // rethrow the 404 we raised ourselves; anything else also fails closed
    if (ex && ex.name === "NotFoundError") throw ex
    console.error("scope.pb.js view fail on " + name, ex)
    throw new NotFoundError("The requested resource was not found.")
  }
})
