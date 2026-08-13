/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id = id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id = id || @request.auth.role_id.can_manage = true"
  }, collection)

  return app.save(collection)
})
