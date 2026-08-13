/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Plans indexes
  const plans = app.findCollectionByNameOrId("plans")
  plans.addIndex("idx_plans_deleted", false, "is_deleted", "")
  plans.addIndex("idx_plans_host_dept", false, "host_dept_id", "")
  plans.addIndex("idx_plans_status", false, "status", "")
  plans.addIndex("idx_plans_leader_deleted", false, "leader_id, is_deleted", "")
  app.save(plans)

  // Tasks indexes
  const tasks = app.findCollectionByNameOrId("tasks")
  tasks.addIndex("idx_tasks_deleted", false, "is_deleted", "")
  tasks.addIndex("idx_tasks_executor_status", false, "executor_id, status", "")
  tasks.addIndex("idx_tasks_plan_id", false, "plan_id", "")
  tasks.addIndex("idx_tasks_deadline", false, "deadline", "")
  tasks.addIndex("idx_tasks_host_dept", false, "host_dept_id", "")
  app.save(tasks)

  // Comments indexes
  const comments = app.findCollectionByNameOrId("comments")
  comments.addIndex("idx_comments_task_id", false, "task_id", "")
  app.save(comments)

  // Notifications indexes
  const notifications = app.findCollectionByNameOrId("notifications")
  notifications.addIndex("idx_notif_user_read", false, "user_id, is_read", "")
  app.save(notifications)

  // Proposals indexes
  const proposals = app.findCollectionByNameOrId("proposals")
  proposals.addIndex("idx_proposals_task_id", false, "task_id", "")
  proposals.addIndex("idx_proposals_status", false, "status", "")
  app.save(proposals)

  // KPI scores indexes
  const kpiScores = app.findCollectionByNameOrId("kpi_scores")
  kpiScores.addIndex("idx_kpi_task_id", false, "task_id", "")
  app.save(kpiScores)

  // Users indexes
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  users.addIndex("idx_users_role_id", false, "role_id", "")
  users.addIndex("idx_users_dept_id", false, "department_id", "")
  app.save(users)
}, (app) => {
  // Remove all added indexes
  const removeIndexes = (collectionId, indexNames) => {
    const collection = app.findCollectionByNameOrId(collectionId)
    for (const name of indexNames) {
      collection.removeIndex(name)
    }
    app.save(collection)
  }
  removeIndexes("plans", ["idx_plans_deleted", "idx_plans_host_dept", "idx_plans_status", "idx_plans_leader_deleted"])
  removeIndexes("tasks", ["idx_tasks_deleted", "idx_tasks_executor_status", "idx_tasks_plan_id", "idx_tasks_deadline", "idx_tasks_host_dept"])
  removeIndexes("comments", ["idx_comments_task_id"])
  removeIndexes("notifications", ["idx_notif_user_read"])
  removeIndexes("proposals", ["idx_proposals_task_id", "idx_proposals_status"])
  removeIndexes("kpi_scores", ["idx_kpi_task_id"])
  removeIndexes("_pb_users_auth_", ["idx_users_role_id", "idx_users_dept_id"])
})
