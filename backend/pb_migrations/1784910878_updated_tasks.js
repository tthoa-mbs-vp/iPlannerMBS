/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "hidden": false,
    "id": "relation4281338252",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "collaborator_ids",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "hidden": false,
    "id": "relation4281338252",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "collaborator_ids",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
