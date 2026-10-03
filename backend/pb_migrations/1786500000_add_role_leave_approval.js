/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // add approval permission + approval scope fields to roles
  const roles = app.findCollectionByNameOrId("pbc_2105053228")

  if (!roles.fields.getByName("can_approve_leave")) {
  roles.fields.add(new Field({
      "hidden": false,
      "id": "bool_appr_leave",
      "name": "can_approve_leave",
      "required": false,
      "system": false,
      "type": "bool"
    }))
}

  if (!roles.fields.getByName("approval_scope")) {
  roles.fields.add(new Field({
      "hidden": false,
      "id": "select_appr_scope",
      "maxSelect": 1,
      "name": "approval_scope",
      "required": false,
      "system": false,
      "type": "select",
      "values": ["all", "department"]
    }))
}

  app.save(roles)

  // update leave_requests rules with leave-approval authority
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.listRule = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = "_superusers"'
  lr.viewRule = lr.listRule
  lr.updateRule = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && total_days < 3 && user_id.department_id = @request.auth.department_id) || @request.auth.collectionName = "_superusers"'
  app.save(lr)

  // default approval authority for existing roles
  const setRoleApproval = (roleId, canApprove, scope) => {
    try {
      const r = app.findRecordById("roles", roleId)
      r.set("can_approve_leave", canApprove)
      r.set("approval_scope", scope)
      app.save(r)
    } catch (e) {}
  }
  setRoleApproval("zb0688o5iv3x94i", true, "all") // Giám đốc
  setRoleApproval("y40qb5t39uqq0mx", true, "all") // Phó Giám đốc
  setRoleApproval("b3pxu46514c5ezw", true, "department") // Chánh Văn phòng
  setRoleApproval("7amx6my09a78y98", true, "department") // Phó Chánh Văn phòng
  setRoleApproval("6u119a0huo4bi03", true, "department") // Trưởng phòng
  setRoleApproval("gpz22082hf88mi8", true, "department") // Phó Trưởng phòng
}, (app) => {
  // remove fields
  const roles = app.findCollectionByNameOrId("pbc_2105053228")
  roles.fields.removeById("bool_appr_leave")
  roles.fields.removeById("select_appr_scope")
  app.save(roles)

  // restore original leave_requests rules
  const lr = app.findCollectionByNameOrId("leave_requests")
  const orig = '@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  lr.listRule = orig
  lr.viewRule = orig
  lr.updateRule = orig
  app.save(lr)
})
