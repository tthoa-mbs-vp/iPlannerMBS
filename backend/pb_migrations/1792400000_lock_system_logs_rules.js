/// <reference path="../pb_data/types.d.ts" />

// A11: move audit logging from the client to the server. Previously the web client
// wrote system_logs through logAction() (web/src/services/systemLogService.ts) via the
// owner-bound createRule `@request.auth.id = user_id` — trivially bypassable and
// forgeable by any user. Audit rows are now written exclusively server-side
// (guards.pb.js request hooks, audit.pb.js auth events, and the custom endpoints),
// all through $app.save() which bypasses rules.
//
// This migration locks the create rule to null (nobody can create system_logs via the
// API, superusers included — writes are server-internal only). list/view stay as-is
// (can_manage / superuser read-only), and update/delete were already null.
migrate((app) => {
  const coll = app.findCollectionByNameOrId("system_logs")
  if (!coll) return
  coll.createRule = null
  app.save(coll)
}, (app) => {
  const coll = app.findCollectionByNameOrId("system_logs")
  if (!coll) return
  coll.createRule = '@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  app.save(coll)
})
