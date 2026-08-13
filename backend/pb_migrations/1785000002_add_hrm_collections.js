/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Create attendance_logs collection
  const attendanceLogs = new Collection({
    id: "pbc_attendance_logs",
    name: "attendance_logs",
    type: "base",
    system: false,
    listRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    viewRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    createRule: "@request.auth.id != \"\"",
    updateRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_att_user", name: "user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "date_att_checkin", name: "check_in", type: "date", required: true },
      { id: "date_att_checkout", name: "check_out", type: "date", required: false },
      { id: "select_att_method", name: "method", type: "select", required: true, values: ["gps", "wifi", "face_id", "manual"] },
      { id: "text_att_gps", name: "location_gps", type: "text", required: false },
      { id: "text_att_device", name: "device_info", type: "text", required: false },
      { id: "select_att_status", name: "status", type: "select", required: true, values: ["on_time", "late", "early_leave", "absent"] },
      { id: "text_att_notes", name: "notes", type: "text", required: false }
    ]
  })
  attendanceLogs.addIndex("idx_att_user_checkin", false, "user_id, check_in", "")
  app.save(attendanceLogs)

  // 2. Create leave_requests collection
  const leaveRequests = new Collection({
    id: "pbc_leave_requests",
    name: "leave_requests",
    type: "base",
    system: false,
    listRule: "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    viewRule: "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    createRule: "@request.auth.id != \"\"",
    updateRule: "@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_lv_user", name: "user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "select_lv_type", name: "leave_type", type: "select", required: true, values: ["annual", "sick", "unpaid", "maternity", "special"] },
      { id: "date_lv_start", name: "start_date", type: "date", required: true },
      { id: "date_lv_end", name: "end_date", type: "date", required: true },
      { id: "num_lv_days", name: "total_days", type: "number", required: true },
      { id: "text_lv_reason", name: "reason", type: "text", required: true },
      { id: "select_lv_status", name: "status", type: "select", required: true, values: ["pending", "approved", "rejected", "cancelled"] },
      { id: "text_lv_approver", name: "approver_id", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "text_lv_rejection", name: "rejection_reason", type: "text", required: false }
    ]
  })
  leaveRequests.addIndex("idx_leave_user_status", false, "user_id, status", "")
  app.save(leaveRequests)

  // 3. Create leave_balances collection
  const leaveBalances = new Collection({
    id: "pbc_leave_balances",
    name: "leave_balances",
    type: "base",
    system: false,
    listRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    viewRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    createRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    updateRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_bal_user", name: "user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "num_bal_year", name: "year", type: "number", required: true },
      { id: "num_bal_total", name: "total_days", type: "number", required: true },
      { id: "num_bal_used", name: "used_days", type: "number", required: true },
      { id: "num_bal_rem", name: "remaining_days", type: "number", required: true }
    ]
  })
  leaveBalances.addIndex("idx_bal_user_year", true, "user_id, year", "")
  app.save(leaveBalances)

  // 4. Create employee_profiles collection
  const employeeProfiles = new Collection({
    id: "pbc_employee_profiles",
    name: "employee_profiles",
    type: "base",
    system: false,
    listRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    viewRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    createRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    updateRule: "@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_prof_user", name: "user_id", type: "relation", required: true, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "text_prof_phone", name: "phone", type: "text", required: false },
      { id: "date_prof_dob", name: "dob", type: "date", required: false },
      { id: "text_prof_identity", name: "identity_card", type: "text", required: false },
      { id: "text_prof_tax", name: "tax_code", type: "text", required: false },
      { id: "text_prof_bank_acc", name: "bank_account", type: "text", required: false },
      { id: "text_prof_bank_name", name: "bank_name", type: "text", required: false },
      { id: "date_prof_join", name: "join_date", type: "date", required: false },
      { id: "text_prof_contract", name: "contract_type", type: "text", required: false },
      { id: "text_prof_emergency", name: "emergency_contact", type: "text", required: false }
    ]
  })
  employeeProfiles.addIndex("idx_prof_user", true, "user_id", "")
  app.save(employeeProfiles)
}, (app) => {
  const collections = ["employee_profiles", "leave_balances", "leave_requests", "attendance_logs"]
  for (const name of collections) {
    try {
      const coll = app.findCollectionByNameOrId(name)
      if (coll) app.deleteCollection(coll)
    } catch (e) {}
  }
})
