/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Users - fix viewRule from restrictive to allow authenticated users
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, users)
  app.save(users)

  // 2. Departments - require auth for list/view
  const departments = app.findCollectionByNameOrId("departments")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, departments)
  app.save(departments)

  // 3. Roles - require auth for list/view
  const roles = app.findCollectionByNameOrId("roles")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, roles)
  app.save(roles)

  // 4. Plans - require auth + role-based create/update/delete
  const plans = app.findCollectionByNameOrId("plans")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.role_id.can_add_plans = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "updateRule": "@request.auth.role_id.can_edit_plans = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "deleteRule": "@request.auth.role_id.can_delete_plans = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, plans)
  app.save(plans)

  // 5. Tasks - require auth + role-based create/update/delete
  const tasks = app.findCollectionByNameOrId("tasks")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.role_id.can_add_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "updateRule": "@request.auth.role_id.can_edit_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "deleteRule": "@request.auth.role_id.can_delete_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, tasks)
  app.save(tasks)

  // 6. Proposals - require auth, only requester or admin can update
  const proposals = app.findCollectionByNameOrId("proposals")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id = requester_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "deleteRule": "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, proposals)
  app.save(proposals)

  // 7. Comments - require auth for list/view/create
  const comments = app.findCollectionByNameOrId("comments")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id = user_id",
    "deleteRule": "@request.auth.id = user_id"
  }, comments)
  app.save(comments)

  // 8. Notifications - users can only see/manage their own, system creates
  const notifications = app.findCollectionByNameOrId("notifications")
  unmarshal({
    "listRule": "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "viewRule": "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "createRule": "",
    "updateRule": "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "deleteRule": null
  }, notifications)
  app.save(notifications)

  // 9. System logs - managers only can view, users can create
  const systemLogs = app.findCollectionByNameOrId("system_logs")
  unmarshal({
    "listRule": "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "viewRule": "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": null,
    "deleteRule": null
  }, systemLogs)
  app.save(systemLogs)

  // 10. KPI scores - require auth, read-only
  const kpiScores = app.findCollectionByNameOrId("kpi_scores")
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, kpiScores)
  app.save(kpiScores)
}, (app) => {
  // Revert to original defaults (create-collections.mjs baseline)
  const defaults = {
    "_pb_users_auth_": { listRule: null, viewRule: "" },
    "departments": { listRule: "", viewRule: "", createRule: null, updateRule: null, deleteRule: null },
    "roles": { listRule: "", viewRule: "", createRule: null, updateRule: null, deleteRule: null },
    "plans": { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: null },
    "tasks": { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: null },
    "proposals": { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: null },
    "comments": { listRule: "", viewRule: "", createRule: "", updateRule: "@request.auth.id = user_id", deleteRule: "@request.auth.id = user_id" },
    "notifications": { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: null },
    "system_logs": { listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null },
    "kpi_scores": { listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null }
  }
  for (const [id, rules] of Object.entries(defaults)) {
    const collection = app.findCollectionByNameOrId(id)
    unmarshal(rules, collection)
    app.save(collection)
  }
})
