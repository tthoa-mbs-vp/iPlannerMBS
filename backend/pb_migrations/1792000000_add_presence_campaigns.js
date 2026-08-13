/// <reference path="../pb_data/types.d.ts" />
// Presence / presence-check campaign feature.
// - presence_heartbeats: latest heartbeat per user (mobile app pings a custom endpoint).
// - presence_campaigns: an inspection window started/stopped by an authorized (can_manage) user.
// - presence_check_logs: who responded (heartbeat seen inside the campaign window) per campaign.
// All writes happen through custom endpoints in presence.pb.js, so create/update/delete rules are closed.
migrate((app) => {
  // 1. presence_heartbeats
  const heartbeats = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": true, "collectionId": "_pb_users_auth_", "hidden": false, "id": "rel_hb_user", "maxSelect": 1, "minSelect": 0, "name": "user_id", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "hidden": false, "id": "date_hb_last_seen", "max": "", "min": "", "name": "last_seen_at", "presentable": false, "required": true, "system": false, "type": "date" },
      { "autogeneratePattern": "", "hidden": false, "id": "text_hb_device", "max": 255, "min": 0, "name": "device_info", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "autodate_hb_created", "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" },
      { "hidden": false, "id": "autodate_hb_updated", "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }
    ],
    "id": "pbc_presence_heartbeats",
    "indexes": [],
    "listRule": '@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "name": "presence_heartbeats",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": '@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  })
  app.save(heartbeats)

  // 2. presence_campaigns
  const campaigns = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "autogeneratePattern": "", "hidden": false, "id": "text_cmp_name", "max": 200, "min": 0, "name": "name", "pattern": "", "presentable": false, "primaryKey": false, "required": true, "system": false, "type": "text" },
      { "hidden": false, "id": "select_cmp_status", "maxSelect": 1, "name": "status", "presentable": false, "required": true, "system": false, "type": "select", "values": ["active", "closed"] },
      { "cascadeDelete": true, "collectionId": "_pb_users_auth_", "hidden": false, "id": "rel_cmp_started_by", "maxSelect": 1, "minSelect": 0, "name": "started_by", "presentable": false, "required": false, "system": false, "type": "relation" },
      { "hidden": false, "id": "date_cmp_started_at", "max": "", "min": "", "name": "started_at", "presentable": false, "required": true, "system": false, "type": "date" },
      { "hidden": false, "id": "date_cmp_ended_at", "max": "", "min": "", "name": "ended_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "autogeneratePattern": "", "hidden": false, "id": "text_cmp_notes", "max": 2000, "min": 0, "name": "notes", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "autodate_cmp_created", "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" },
      { "hidden": false, "id": "autodate_cmp_updated", "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }
    ],
    "id": "pbc_presence_campaigns",
    "indexes": [],
    "listRule": '@request.auth.id != "" || @request.auth.collectionName = "_superusers"',
    "name": "presence_campaigns",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": '@request.auth.id != "" || @request.auth.collectionName = "_superusers"'
  })
  app.save(campaigns)

  // 3. presence_check_logs
  const logs = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      { "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256", "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$", "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text" },
      { "cascadeDelete": true, "collectionId": "pbc_presence_campaigns", "hidden": false, "id": "rel_log_campaign", "maxSelect": 1, "minSelect": 0, "name": "campaign_id", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "cascadeDelete": true, "collectionId": "_pb_users_auth_", "hidden": false, "id": "rel_log_user", "maxSelect": 1, "minSelect": 0, "name": "user_id", "presentable": false, "required": true, "system": false, "type": "relation" },
      { "hidden": false, "id": "bool_log_responded", "name": "responded", "presentable": false, "required": false, "system": false, "type": "bool" },
      { "hidden": false, "id": "date_log_responded_at", "max": "", "min": "", "name": "responded_at", "presentable": false, "required": false, "system": false, "type": "date" },
      { "autogeneratePattern": "", "hidden": false, "id": "text_log_device", "max": 255, "min": 0, "name": "device_info", "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text" },
      { "hidden": false, "id": "autodate_log_created", "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" },
      { "hidden": false, "id": "autodate_log_updated", "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }
    ],
    "id": "pbc_presence_check_logs",
    "indexes": [],
    "listRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "name": "presence_check_logs",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  })
  app.save(logs)
}, (app) => {
  const collections = ["presence_check_logs", "presence_campaigns", "presence_heartbeats"]
  for (const name of collections) {
    try {
      const coll = app.findCollectionByNameOrId(name)
      if (coll) app.deleteCollection(coll)
    } catch (e) {}
  }
})
