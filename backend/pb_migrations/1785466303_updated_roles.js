/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2105053228")

  // remove field
  if (collection.fields.getById("bool_appr_leave")) {
  collection.fields.removeById("bool_appr_leave")
}

  // remove field
  if (collection.fields.getById("select_appr_scope")) {
  collection.fields.removeById("select_appr_scope")
}

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2105053228")

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "bool_appr_leave",
    "name": "can_approve_leave",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "select_appr_scope",
    "maxSelect": 1,
    "name": "approval_scope",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "all",
      "department"
    ]
  }))

  return app.save(collection)
})
