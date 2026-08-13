/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "not_started",
      "in_progress",
      "pending_approval",
      "completed",
      "proposed_extension",
      "proposed_cancellation",
      "cancelled"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "in_progress",
      "pending_approval",
      "completed",
      "proposed_extension",
      "proposed_cancellation",
      "cancelled"
    ]
  }))

  return app.save(collection)
})
