/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_leave_requests")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "updateRule": "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    "viewRule": "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_leave_requests")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = \"all\" || @request.auth.role_id.approval_scope = \"department\" && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = \"_superusers\"",
    "updateRule": "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = \"all\" || @request.auth.role_id.approval_scope = \"department\" && total_days < 3 && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = \"_superusers\"",
    "viewRule": "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = \"all\" || @request.auth.role_id.approval_scope = \"department\" && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = \"_superusers\""
  }, collection)

  return app.save(collection)
})
