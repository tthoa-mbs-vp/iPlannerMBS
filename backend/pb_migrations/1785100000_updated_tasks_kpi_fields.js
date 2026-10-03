/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // add is_ad_hoc bool
  if (!collection.fields.getByName("is_ad_hoc")) {
  collection.fields.addAt(17, new Field({
      "hidden": false,
      "id": "bool2718281828",
      "name": "is_ad_hoc",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }))
}

  // add is_high_impact bool
  if (!collection.fields.getByName("is_high_impact")) {
  collection.fields.addAt(18, new Field({
      "hidden": false,
      "id": "bool3141592653",
      "name": "is_high_impact",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "bool"
    }))
}

  // add coordinating_dept_id relation to departments
  if (!collection.fields.getByName("coordinating_dept_id")) {
  collection.fields.addAt(19, new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_3865025440",
      "hidden": false,
      "id": "relation1618033988",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "coordinating_dept_id",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }))
}

  // add completed_at datetime
  if (!collection.fields.getByName("completed_at")) {
  collection.fields.addAt(20, new Field({
      "hidden": false,
      "id": "date5772156649",
      "name": "completed_at",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }))
}

  // add rating number (1-5)
  if (!collection.fields.getByName("rating")) {
  collection.fields.addAt(21, new Field({
      "hidden": false,
      "id": "number1618033989",
      "max": 5,
      "min": 1,
      "name": "rating",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
}

  // add rated_by_id relation to users
  if (!collection.fields.getByName("rated_by_id")) {
  collection.fields.addAt(22, new Field({
      "cascadeDelete": false,
      "collectionId": "_pb_users_auth_",
      "hidden": false,
      "id": "relation2718281829",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "rated_by_id",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }))
}

  // add rated_at datetime
  if (!collection.fields.getByName("rated_at")) {
  collection.fields.addAt(23, new Field({
      "hidden": false,
      "id": "date3141592654",
      "name": "rated_at",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }))
}

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  collection.fields.removeById("bool2718281828")
  collection.fields.removeById("bool3141592653")
  collection.fields.removeById("relation1618033988")
  collection.fields.removeById("date5772156649")
  collection.fields.removeById("number1618033989")
  collection.fields.removeById("relation2718281829")
  collection.fields.removeById("date3141592654")

  return app.save(collection)
})
