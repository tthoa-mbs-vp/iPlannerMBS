/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks")
  // Support the archive eligibility filter: status + completed_at (completed)
  // and sort/scan by updated. Fall back to the pre-existing deadline index.
  tasks.addIndex("idx_tasks_completed_at", false, "completed_at", "")
  tasks.addIndex("idx_tasks_updated", false, "updated", "")
  app.save(tasks)
}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks")
  tasks.removeIndex("idx_tasks_completed_at")
  tasks.removeIndex("idx_tasks_updated")
  app.save(tasks)
})