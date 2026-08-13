/// <reference path="../pb_data/types.d.ts" />
// Public announcements / notice board. All authenticated users can read;
// only can_manage roles (or superusers) can create/update/delete.
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
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_ann_title",
        "max": 200,
        "min": 0,
        "name": "title",
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
        "id": "editor_ann_content",
        "max": 0,
        "min": 0,
        "name": "content",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "editor"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation_ann_author",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "author_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool_ann_pinned",
        "name": "is_pinned",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool_ann_active",
        "name": "is_active",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "date_ann_published",
        "max": "",
        "min": "",
        "name": "published_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_announcements",
    "indexes": [],
    "listRule": '@request.auth.id != "" || @request.auth.collectionName = "_superusers"',
    "name": "announcements",
    "system": false,
    "type": "base",
    "updateRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "viewRule": '@request.auth.id != "" || @request.auth.collectionName = "_superusers"'
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_announcements");
  return app.delete(collection);
})
