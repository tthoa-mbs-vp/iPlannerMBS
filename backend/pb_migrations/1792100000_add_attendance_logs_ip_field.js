/// <reference path="../pb_data/types.d.ts" />
// Add ip_address to attendance_logs so the server-side network check (guards.pb.js) can persist
// the request IP it verified. The client previously sent an ip_address that was silently dropped
// because the field did not exist; with this field the value is always overwritten by the
// server-observed IP (never the client-supplied one).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attendance_logs")
  if (!collection.fields.getByName("ip_address")) {
    collection.fields.add(new TextField({ name: "ip_address", required: false }))
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("attendance_logs")
  if (collection.fields.getByName("ip_address")) {
    collection.fields.removeByName("ip_address")
  }
  return app.save(collection)
})
