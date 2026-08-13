/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "deleteRule": "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text8542943769",
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
        "hidden": false,
        "id": "select7375397047",
        "maxSelect": 1,
        "name": "channel_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "org",
          "department",
          "group"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3865025440",
        "help": "",
        "hidden": false,
        "id": "relation1943227386",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "channel_dept_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_professional_groups",
        "help": "",
        "hidden": false,
        "id": "relation8139217575",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "channel_group_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation9525810821",
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
        "id": "text5266591272",
        "max": 0,
        "min": 0,
        "name": "content",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "file9106781944",
        "maxSelect": 99,
        "maxSize": 20971520,
        "mimeTypes": [
          "image/png",
          "image/jpeg",
          "image/gif",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv"
        ],
        "name": "files",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "type": "file"
      },
      {
        "hidden": false,
        "id": "autodate4588265819",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate7913808483",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_4821957337",
    "indexes": [
      "CREATE INDEX idx_chat_channel ON chat_messages (channel_type, channel_dept_id, channel_group_id, created)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "name": "chat_messages",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "viewRule": "@request.auth.id != \"\""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4821957337");

  return app.delete(collection);
})
