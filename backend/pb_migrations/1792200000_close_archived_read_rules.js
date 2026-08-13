/// <reference path="../pb_data/types.d.ts" />

// M5: archived_* collections previously had open read rules ("@request.auth.id != \"\"") —
// any authenticated employee could read the full org's archived task history (names,
// executors, descriptions, comments), bypassing roles.view_scope entirely. Archive data is
// now manager/superuser read-only. The server-side archive/restore endpoints use $app.*
// directly (rule-bypassing) so they are unaffected, and the only web consumer is the
// admin-only /admin/data page.
migrate((app) => {
  const rule = '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  for (const name of ["archived_tasks", "archived_comments", "archived_plans"]) {
    const coll = app.findCollectionByNameOrId(name)
    if (!coll) continue
    coll.listRule = rule
    coll.viewRule = rule
    app.save(coll)
  }
}, (app) => {
  const open = '@request.auth.id != ""'
  for (const name of ["archived_tasks", "archived_comments", "archived_plans"]) {
    const coll = app.findCollectionByNameOrId(name)
    if (!coll) continue
    coll.listRule = open
    coll.viewRule = open
    app.save(coll)
  }
})
