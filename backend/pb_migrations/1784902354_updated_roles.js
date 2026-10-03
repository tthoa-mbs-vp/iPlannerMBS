/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2105053228")

  // add field
  if (!collection.fields.getByName("description")) {
  collection.fields.addAt(12, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1843675174",
      "max": 0,
      "min": 0,
      "name": "description",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
}

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2105053228")

  // remove field
  collection.fields.removeById("text1843675174")

  return app.save(collection)
})
