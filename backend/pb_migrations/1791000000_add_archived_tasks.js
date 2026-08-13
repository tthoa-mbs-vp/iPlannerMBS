/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Create archived_tasks collection
  const archivedTasks = new Collection({
    id: "pbc_archived_tasks",
    name: "archived_tasks",
    type: "base",
    system: false,
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    updateRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_arch_orig_id", name: "original_id", type: "text", required: true },
      { id: "text_arch_name", name: "name", type: "text", required: true },
      { id: "text_arch_desc", name: "description", type: "text", required: false },
      { id: "rel_arch_plan", name: "plan_id", type: "relation", required: false, collectionId: "pbc_4263585338", maxSelect: 1 },
      { id: "rel_arch_exec", name: "executor_id", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "rel_arch_super", name: "supervisor_id", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "rel_arch_appr", name: "approver_id", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "select_arch_status", name: "status", type: "select", required: true, values: ["completed", "cancelled"] },
      { id: "select_arch_priority", name: "priority", type: "select", required: false, values: ["low", "medium", "high", "urgent"] },
      { id: "date_arch_start", name: "start_date", type: "date", required: false },
      { id: "date_arch_due", name: "due_date", type: "date", required: false },
      { id: "date_arch_comp", name: "completion_date", type: "date", required: false },
      { id: "num_arch_progress", name: "progress", type: "number", required: false },
      { id: "num_arch_weight", name: "weight", type: "number", required: false },
      { id: "date_arch_time", name: "archived_at", type: "date", required: true }
    ]
  })
  archivedTasks.addIndex("idx_arch_orig_id", false, "original_id", "")
  archivedTasks.addIndex("idx_arch_status_time", false, "status, archived_at", "")
  app.save(archivedTasks)

  // 2. Create archived_comments collection
  const archivedComments = new Collection({
    id: "pbc_archived_comments",
    name: "archived_comments",
    type: "base",
    system: false,
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    updateRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_arch_c_task_id", name: "archived_task_id", type: "relation", required: true, collectionId: "pbc_archived_tasks", maxSelect: 1 },
      { id: "text_arch_c_user_id", name: "user_id", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "text_arch_c_content", name: "content", type: "text", required: true },
      { id: "date_arch_c_orig_created", name: "original_created", type: "date", required: false }
    ]
  })
  archivedComments.addIndex("idx_arch_c_task", false, "archived_task_id", "")
  app.save(archivedComments)
}, (app) => {
  const collections = ["archived_comments", "archived_tasks"]
  for (const name of collections) {
    try {
      const coll = app.findCollectionByNameOrId(name)
      if (coll) app.deleteCollection(coll)
    } catch (e) {}
  }
})
