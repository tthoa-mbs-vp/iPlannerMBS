/// <reference path="../pb_data/types.d.ts" />

// Health check endpoints for monitoring, load balancers, and deployment
// readiness — no authentication required.
//
// NOTE: PocketBase 0.39 already serves GET /api/health itself. Registering that
// same pattern here makes the router panic on boot ("pattern conflicts with
// pattern"), so the DB-aware variant lives on its own path instead. Keep
// /api/health in sync with upstream rather than shadowing it.

// GET /api/healthcheck — richer status, including a real DB round-trip.
routerAdd("GET", "/api/healthcheck", function(c) {
  try {
    var now = new Date().toISOString()

    // Quick DB connectivity check
    var dbOk = true
    try {
      var coll = $app.findCollectionByNameOrId("users")
      $app.findRecordsByFilter(coll, "", "", 1, 0)
    } catch (ex) {
      dbOk = false
    }

    return c.json(200, {
      status: dbOk ? "healthy" : "degraded",
      timestamp: now,
      db: dbOk ? "connected" : "disconnected",
      uptime: process.uptime ? Math.round(process.uptime()) : 0,
    })
  } catch (ex) {
    return c.json(503, {
      status: "error",
      timestamp: new Date().toISOString(),
      error: ex && ex.message ? ex.message : "unknown",
    })
  }
})

// Ready check — returns 200 when PocketBase is fully initialized
routerAdd("GET", "/api/ready", function(c) {
  return c.json(200, { ready: true })
})
