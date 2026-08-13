/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Allow archiving trashed tasks of any status. The trash bin is now the highest
  // priority archive target, so archived_tasks must accept every task status, not
  // only completed/cancelled.
  const collection = app.findCollectionByNameOrId("pbc_archived_tasks")
  const statusField = collection.fields.getByName("status")
  statusField.values = [
    "not_started",
    "in_progress",
    "pending_approval",
    "completed",
    "proposed_extension",
    "proposed_cancellation",
    "cancelled",
  ]
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_archived_tasks")
  const statusField = collection.fields.getByName("status")
  statusField.values = ["completed", "cancelled"]
  return app.save(collection)
})
