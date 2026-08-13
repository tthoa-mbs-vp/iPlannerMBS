/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Create professional_groups collection
  const groups = new Collection({
    id: "pbc_professional_groups",
    name: "professional_groups",
    type: "base",
    system: false,
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    updateRule: '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    deleteRule: '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    fields: [
      { id: "text_pg_code", name: "code", type: "text", required: true, max: 100 },
      { id: "text_pg_name", name: "name", type: "text", required: true, max: 200 },
      { id: "text_pg_desc", name: "description", type: "text", required: false, max: 500 },
      { id: "rel_pg_dept", name: "department_id", type: "relation", required: false, collectionId: "pbc_3865025440", maxSelect: 1 },
      { id: "auto_pg_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, hidden: false, required: false, system: false, presentable: false },
      { id: "auto_pg_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, hidden: false, required: false, system: false, presentable: false }
    ]
  })
  groups.addIndex("idx_pg_code", true, "code", "")
  groups.addIndex("idx_pg_dept", false, "department_id", "")
  app.save(groups)

  // 2. Add group_ids (multiple professional groups) to users
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  users.fields.add(new Field({
    "collectionId": "pbc_professional_groups",
    "cascadeDelete": false,
    "hidden": false,
    "id": "rel_users_groups",
    "maxSelect": 50,
    "minSelect": 0,
    "name": "group_ids",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))
  app.save(users)

  // 3. Add optional group_id to plans
  const plans = app.findCollectionByNameOrId("pbc_4263585338")
  plans.fields.add(new Field({
    "collectionId": "pbc_professional_groups",
    "cascadeDelete": false,
    "hidden": false,
    "id": "rel_plans_group",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "group_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))
  app.save(plans)

  // 4. Extend role scopes with "group"
  const roles = app.findCollectionByNameOrId("roles")
  const viewScopeField = roles.fields.getByName("view_scope")
  viewScopeField.values = ["all", "department", "group", "personal"]
  const approvalScopeField = roles.fields.getByName("approval_scope")
  approvalScopeField.values = ["all", "department", "group"]
  app.save(roles)
}, (app) => {
  try {
    const groups = app.findCollectionByNameOrId("professional_groups")
    app.deleteCollection(groups)
  } catch (e) {}
  try {
    const users = app.findCollectionByNameOrId("_pb_users_auth_")
    const names = users.fields.fieldNames()
    if (names.includes("group_ids")) users.fields.removeByName("group_ids")
    app.save(users)
  } catch (e) {}
  try {
    const plans = app.findCollectionByNameOrId("pbc_4263585338")
    const names = plans.fields.fieldNames()
    if (names.includes("group_id")) plans.fields.removeByName("group_id")
    app.save(plans)
  } catch (e) {}
  try {
    const roles = app.findCollectionByNameOrId("roles")
    const names = roles.fields.fieldNames()
    if (names.includes("view_scope")) roles.fields.getByName("view_scope").values = ["all", "department", "personal"]
    if (names.includes("approval_scope")) roles.fields.getByName("approval_scope").values = ["all", "department"]
    app.save(roles)
  } catch (e) {}
})
