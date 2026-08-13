/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4263585338")

  // update field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3865025440",
    "hidden": false,
    "id": "relation2420751968",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "partner_dept_ids",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4263585338")

  // update field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3865025440",
    "hidden": false,
    "id": "relation2420751968",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "partner_dept_ids",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
