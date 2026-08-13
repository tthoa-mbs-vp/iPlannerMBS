/// <reference path="../pb_data/types.d.ts" />
// The announcements collection is missing the created/updated autodate fields
// (their migrations never declared them), so sorting by created/updated fails
// with `invalid sort field "created"`. Add them explicitly like PocketBase
// does when editing a collection from the admin UI.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_announcements")
  const names = collection.fields.fieldNames()

  if (!names.includes("created")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "autodate_ann_created",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }))
  }

  if (!names.includes("updated")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "autodate_ann_updated",
      "name": "updated",
      "onCreate": true,
      "onUpdate": true,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_announcements")
  collection.fields.removeById("autodate_ann_created")
  collection.fields.removeById("autodate_ann_updated")
  return app.save(collection)
})
