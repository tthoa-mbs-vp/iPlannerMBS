/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "deleteRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation2809058197",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1034956143",
        "max": 0,
        "min": 0,
        "name": "organization",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text2789625508",
        "max": 0,
        "min": 0,
        "name": "position",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "date2502384312",
        "max": "",
        "min": "",
        "name": "start_date",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "help": "",
        "hidden": false,
        "id": "date1439537261",
        "max": "",
        "min": "",
        "name": "end_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text4098435127",
        "max": 0,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_6193051822",
    "indexes": [],
    "listRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "name": "work_experiences",
    "system": false,
    "type": "base",
    "updateRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "viewRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_6193051822");

  return app.delete(collection);
})
