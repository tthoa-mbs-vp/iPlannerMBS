/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3865025440")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "deleteRule": "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "updateRule": "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3865025440")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.role_id.can_manage = true",
    "deleteRule": "@request.auth.role_id.can_manage = true",
    "updateRule": "@request.auth.role_id.can_manage = true"
  }, collection)

  return app.save(collection)
})
