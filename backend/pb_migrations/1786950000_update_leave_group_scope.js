/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Extend leave approval rules with "group" scope (shared professional group)
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.listRule = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && user_id.group_ids ~ @request.auth.group_ids) || @request.auth.collectionName = "_superusers"'
  lr.viewRule = lr.listRule
  lr.updateRule = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && total_days < 3 && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && total_days < 3 && user_id.group_ids ~ @request.auth.group_ids) || @request.auth.collectionName = "_superusers"'
  app.save(lr)
}, (app) => {
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.listRule = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = "_superusers"'
  lr.viewRule = lr.listRule
  lr.updateRule = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && total_days < 3 && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = "_superusers"'
  app.save(lr)
})
