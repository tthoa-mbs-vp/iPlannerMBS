/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_745715485")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX idx_salary_records_user_id ON salary_records (user_id)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_745715485")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
