/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3865025440")

  // add field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "hidden": false,
    "id": "relation1930776276",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "leader_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3865025440")

  // remove field
  collection.fields.removeById("relation1930776276")

  return app.save(collection)
})
