/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4263585338")

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "bool3977085845",
    "name": "is_deleted",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4263585338")

  // remove field
  collection.fields.removeById("bool3977085845")

  return app.save(collection)
})
