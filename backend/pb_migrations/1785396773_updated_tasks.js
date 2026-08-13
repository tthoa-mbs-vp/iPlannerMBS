/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.role_id.can_edit_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\" || @request.auth.id = executor_id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.role_id.can_edit_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, collection)

  return app.save(collection)
})
