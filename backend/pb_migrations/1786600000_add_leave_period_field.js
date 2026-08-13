/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // add half-day period field to leave_requests
  const collection = app.findCollectionByNameOrId("leave_requests")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "select_lv_period",
    "maxSelect": 1,
    "name": "period",
    "required": false,
    "system": false,
    "type": "select",
    "values": ["full", "morning", "afternoon"]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("leave_requests")

  // remove field
  collection.fields.removeById("select_lv_period")

  return app.save(collection)
})
