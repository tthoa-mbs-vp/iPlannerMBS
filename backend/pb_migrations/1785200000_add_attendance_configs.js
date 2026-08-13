/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    id: "pbc_attendance_configs",
    name: "attendance_configs",
    type: "base",
    system: false,
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    updateRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_cfg_office", name: "office_name", type: "text", required: true },
      { id: "text_cfg_ssid", name: "wifi_ssid", type: "text", required: true },
      { id: "text_cfg_bssid", name: "wifi_bssid", type: "text", required: false },
      { id: "json_cfg_ips", name: "allowed_ips", type: "json", required: false },
      { id: "text_cfg_start", name: "work_start_time", type: "text", required: true },
      { id: "text_cfg_end", name: "work_end_time", type: "text", required: true },
      { id: "num_cfg_late", name: "late_tolerance_minutes", type: "number", required: false },
      { id: "bool_cfg_active", name: "is_active", type: "bool", required: false }
    ]
  })
  app.save(collection)
}, (app) => {
  try {
    const coll = app.findCollectionByNameOrId("attendance_configs")
    if (coll) app.deleteCollection(coll)
  } catch (e) {}
})
