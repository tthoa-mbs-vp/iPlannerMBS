/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1083066331")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX idx_qualifications_user_id ON qualifications (user_id)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1083066331")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
