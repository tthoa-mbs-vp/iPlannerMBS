/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id = user_id",
    "updateRule": "@request.auth.id = user_id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // update collection data
  unmarshal({
    "deleteRule": null,
    "updateRule": null
  }, collection)

  return app.save(collection)
})
