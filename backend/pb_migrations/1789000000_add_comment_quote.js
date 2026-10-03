/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // add self-referencing quote_id field to comments
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  if (!collection.fields.getByName("quote_id")) {
  collection.fields.add(new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_533777971",
      "hidden": false,
      "id": "rel_comment_quote",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "quote_id",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }))
}

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  collection.fields.removeByName("quote_id")

  return app.save(collection)
})
