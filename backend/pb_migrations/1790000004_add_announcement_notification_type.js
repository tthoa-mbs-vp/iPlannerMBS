/// <reference path="../pb_data/types.d.ts" />
// Add "announcement" to the notifications `type` select values so that
// _notifyAnnouncement (helpers.js) can create records; previously the invalid
// select value made the announcement notifications silently fail.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("notifications")
  const field = collection.fields.getByName("type")
  const values = field.values || []
  if (values.indexOf("announcement") === -1) {
    values.push("announcement")
    field.values = values
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("notifications")
  const field = collection.fields.getByName("type")
  const values = (field.values || []).filter((v) => v !== "announcement")
  field.values = values
  return app.save(collection)
})
