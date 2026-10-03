import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL || "http://localhost:8090";
const EMAIL = process.env.PB_ADMIN_EMAIL || "admin@mbs.com";
const PASSWORD = process.env.PB_ADMIN_PASSWORD || "Admin@123456";

const pb = new PocketBase(PB_URL);
await pb.collection("_superusers").authWithPassword(EMAIL, PASSWORD);
console.log("Authenticated");

// PB 0.39: all field options are TOP-LEVEL on the field object, not nested in `options`
const U = "_pb_users_auth_";
const txt = (name, required) => ({ name, type: "text", required: !!required });
const num = (name, required) => ({ name, type: "number", required: !!required });
const bool_ = (name, required) => ({ name, type: "bool", required: !!required });
const dt = (name, required) => ({ name, type: "date", required: !!required });
const fl = (name) => ({ name, type: "file" });
const sel = (name, values, required) => ({ name, type: "select", required: !!required, values });
const rel = (name, collectionId, required, opts = {}) => ({
  name, type: "relation", required: !!required,
  collectionId, maxSelect: opts.maxSelect ?? 1, cascadeDelete: opts.cascadeDelete ?? false
});

// Create in dependency order
const ALL = [
  // === Group 1: No custom deps ===
  { name: "departments", type: "base", listRule: "", viewRule: "",
    createRule: "@request.auth.role_id.can_manage = true",
    updateRule: "@request.auth.role_id.can_manage = true",
    deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [txt("code", 1), txt("name", 1), bool_("is_counted"), rel("leader_id", U)]
  },
  { name: "roles", type: "base", listRule: "", viewRule: "",
    createRule: "@request.auth.role_id.can_manage = true",
    updateRule: "@request.auth.role_id.can_manage = true",
    deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [txt("code", 1), txt("name", 1), txt("description"),
      sel("level", ["leadership", "management", "employee"], 1),
      sel("view_scope", ["all", "department", "group", "personal"], 1),
      bool_("can_add_plans"), bool_("can_edit_plans"), bool_("can_delete_plans"),
      bool_("can_add_tasks"), bool_("can_edit_tasks"), bool_("can_delete_tasks"),
      bool_("can_manage"), bool_("can_approve_leave"), bool_("can_view_salary"),
      sel("approval_scope", ["all", "department", "group"])
    ]
  },
];

async function create(col) {
  try {
    const ex = await pb.collections.getOne(col.name).catch(() => null);
    if (ex) { console.log(`  ${col.name} exists (${ex.id})`); return ex.id; }
    const r = await pb.collections.create(col);
    console.log(`  ${col.name} created (${r.id})`);
    return r.id;
  } catch (e) {
    console.error(`  ${col.name} FAIL: ${e.response?.message || e.message}`);
    if (e.data?.data?.fields) console.error(`    Detail:`, JSON.stringify(e.data.data.fields));
    return null;
  }
}

console.log("\n=== Group 1 ===");
const ids = {};
for (const c of ALL) ids[c.name] = await create(c);

// === Group 2: Refs group1 + _pb_users_auth_ only ===
console.log("\n=== Group 2 ===");
ids.professional_groups = await create({ name: "professional_groups", type: "base", listRule: "", viewRule: "",
  createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
  fields: [txt("code", 1), txt("name", 1), txt("description"), rel("department_id", ids.departments)]
});

ids.presence_campaigns = await create({ name: "presence_campaigns", type: "base", listRule: "", viewRule: "",
  createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
  fields: [txt("name", 1), sel("status", ["active", "closed"], 1), rel("started_by", U), dt("started_at", 1), dt("ended_at"), txt("notes")]
});

ids.attendance_configs = await create({ name: "attendance_configs", type: "base", listRule: "", viewRule: "",
  createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
  fields: [txt("office_name", 1), txt("wifi_ssid", 1), txt("wifi_bssid"), txt("allowed_ips"), txt("work_start_time", 1), txt("work_end_time", 1), num("late_tolerance_minutes"), bool_("is_active")]
});

ids.system_configs = await create({ name: "system_configs", type: "base",
  listRule: "@request.auth.role_id.can_manage = true", viewRule: "@request.auth.role_id.can_manage = true",
  createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
  fields: [txt("key", 1), txt("value"), txt("description")]
});

// === Group 3: Refs group1+2 ===
console.log("\n=== Group 3 ===");
ids.plans = await create({ name: "plans", type: "base", listRule: "", viewRule: "",
  createRule: "@request.auth.role_id.can_add_plans = true", updateRule: "@request.auth.role_id.can_edit_plans = true", deleteRule: "@request.auth.role_id.can_delete_plans = true",
  fields: [txt("name", 1), txt("description"), rel("leader_id", U, 1), rel("host_dept_id", ids.departments, 1),
    rel("partner_dept_ids", ids.departments), rel("group_id", ids.professional_groups),
    dt("start_date", 1), dt("end_date", 1), sel("status", ["not_started", "in_progress", "completed", "paused", "cancelled"], 1),
    bool_("is_sudden"), bool_("is_high_impact"), bool_("is_deleted"), num("progress")]
});

for (const c of [
  { name: "notifications", listRule: "@request.auth.id = @record.user_id", viewRule: "@request.auth.id = @record.user_id", createRule: "", updateRule: "@request.auth.id = @record.user_id", deleteRule: "@request.auth.id = @record.user_id",
    fields: [rel("user_id", U, 1), sel("type", ["mention", "reply", "deadline_warning", "task_update", "proposal_update", "announcement"], 1), txt("reference_id", 1), bool_("is_read")] },
  { name: "attendance_logs", listRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", viewRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", createRule: "@request.auth.id = @record.user_id", updateRule: "@request.auth.id = @record.user_id || @request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), dt("check_in", 1), dt("check_out"), sel("method", ["gps", "wifi", "face_id", "manual"], 1), txt("location_gps"), txt("device_info"), sel("status", ["on_time", "late", "early_leave", "absent"], 1), txt("notes")] },
  { name: "leave_requests", listRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", viewRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", createRule: "", updateRule: "@request.auth.id = @record.user_id || @request.auth.role_id.can_approve_leave = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), sel("leave_type", ["annual", "sick", "unpaid", "maternity", "special"], 1), dt("start_date", 1), dt("end_date", 1), num("total_days", 1), txt("reason", 1), sel("status", ["pending", "approved", "rejected", "cancelled"], 1), sel("period", ["full", "morning", "afternoon"]), rel("approver_id", U), txt("rejection_reason")] },
  { name: "leave_balances", listRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", viewRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), num("year", 1), num("total_days", 1), num("used_days"), num("remaining_days")] },
  { name: "employee_profiles", listRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", viewRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), txt("phone"), dt("dob"), txt("identity_card"), txt("tax_code"), txt("bank_account"), txt("bank_name"), dt("join_date"), txt("contract_type"), txt("emergency_contact")] },
  { name: "qualifications", listRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", viewRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), txt("name", 1), txt("training_place", 1), dt("start_date", 1), dt("end_date", 1), txt("training_type", 1), txt("certificate_type", 1)] },
  { name: "salary_records", listRule: "@request.auth.role_id.can_view_salary = true", viewRule: "@request.auth.role_id.can_view_salary = true", createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), dt("start_date", 1), num("salary_coefficient", 1), num("allowance_coefficient", 1), txt("decision_number", 1)] },
  { name: "work_experiences", listRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", viewRule: "@request.auth.role_id.can_manage = true || @request.auth.id = @record.user_id", createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [rel("user_id", U, 1), txt("organization", 1), txt("position", 1), dt("start_date", 1), dt("end_date"), txt("description")] },
  { name: "announcements", listRule: "", viewRule: "", createRule: "@request.auth.role_id.can_manage = true", updateRule: "@request.auth.role_id.can_manage = true", deleteRule: "@request.auth.role_id.can_manage = true",
    fields: [txt("title", 1), txt("content", 1), rel("author_id", U, 1), bool_("is_pinned"), bool_("is_active"), dt("published_at")] },
  { name: "presence_heartbeats", listRule: "", viewRule: "", createRule: "", updateRule: "@request.auth.id = @record.user_id", deleteRule: "",
    fields: [rel("user_id", U, 1), dt("last_seen_at", 1), txt("device_info")] },
  { name: "presence_check_logs", listRule: "", viewRule: "", createRule: "", updateRule: "@request.auth.id = @record.user_id", deleteRule: "",
    fields: [rel("campaign_id", ids.presence_campaigns, 1), rel("user_id", U, 1), bool_("responded"), dt("responded_at"), txt("device_info")] },
  { name: "system_logs", listRule: "@request.auth.role_id.can_manage = true", viewRule: "@request.auth.role_id.can_manage = true", createRule: "", updateRule: "", deleteRule: "",
    fields: [rel("user_id", U, 1), txt("action", 1), txt("target"), txt("ip_address")] },
  { name: "chat_messages", listRule: "", viewRule: "", createRule: "", updateRule: "@request.auth.id = @record.user_id", deleteRule: "@request.auth.id = @record.user_id || @request.auth.role_id.can_manage = true",
    fields: [sel("channel_type", ["org", "department", "group"], 1), rel("channel_dept_id", ids.departments), rel("channel_group_id", ids.professional_groups), rel("user_id", U, 1), txt("content", 1), fl("files")] },
]) {
  ids[c.name] = await create({ type: "base", ...c });
}

// === Group 4: Refs plans ===
console.log("\n=== Group 4 ===");
ids.tasks = await create({ name: "tasks", type: "base", listRule: "", viewRule: "",
  createRule: "@request.auth.role_id.can_add_tasks = true", updateRule: "@request.auth.role_id.can_edit_tasks = true", deleteRule: "@request.auth.role_id.can_delete_tasks = true",
  fields: [txt("name", 1), txt("description"), rel("plan_id", ids.plans), sel("category", ["normal", "sudden", "important"], 1),
    rel("host_dept_id", ids.departments, 1), rel("executor_id", U, 1), rel("supervisor_id", U, 1), rel("collaborator_ids", U),
    dt("start_date", 1), dt("deadline", 1),
    sel("status", ["not_started", "in_progress", "pending_approval", "completed", "proposed_extension", "proposed_cancellation", "cancelled"], 1),
    bool_("is_recurring"), sel("recurring_type", ["monthly", "weekly"]), num("recurring_value"),
    bool_("is_ad_hoc"), bool_("is_high_impact"), rel("coordinating_dept_id", ids.departments),
    dt("completed_at"), num("rating"), rel("rated_by_id", U), dt("rated_at"), bool_("is_deleted")]
});

ids.archived_tasks = await create({ name: "archived_tasks", type: "base", listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
  fields: [txt("original_id", 1), txt("name", 1), txt("description"), rel("plan_id", ids.plans),
    rel("executor_id", U), rel("supervisor_id", U), rel("approver_id", U),
    sel("status", ["completed", "cancelled"], 1), dt("start_date"), dt("due_date"), dt("completion_date"), num("progress"), dt("archived_at", 1)]
});

// === Group 5: Refs tasks ===
console.log("\n=== Group 5 ===");
ids.comments = await create({ name: "comments", type: "base", listRule: "", viewRule: "", createRule: "", updateRule: "@request.auth.id = @record.user_id", deleteRule: "@request.auth.id = @record.user_id || @request.auth.role_id.can_manage = true",
  fields: [rel("task_id", ids.tasks, 1), rel("user_id", U, 1), txt("content", 1), fl("files")] });

ids.kpi_scores = await create({ name: "kpi_scores", type: "base", listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
  fields: [rel("task_id", ids.tasks, 1), num("base_score", 1), num("difficulty_coeff", 1), num("max_converted_score"), num("progress_score", 1), num("result_rating", 1), num("final_score", 1)] });

ids.proposals = await create({ name: "proposals", type: "base", listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
  fields: [rel("task_id", ids.tasks, 1), sel("type", ["extension", "cancellation"], 1), txt("reason", 1), dt("new_deadline"),
    sel("status", ["pending", "approved", "rejected", "withdrawn"], 1), rel("requester_id", U, 1), rel("approver_id", U, 1)] });

ids.archived_comments = await create({ name: "archived_comments", type: "base", listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
  fields: [rel("archived_task_id", ids.archived_tasks, 1), rel("user_id", U), txt("content", 1), dt("original_created")] });

// Step 6: Add comment.quote_id self-ref (requires existing collection)
console.log("\n=== Step 6: Add self-references ===");
try {
  const col = await pb.collections.getOne("comments");
  const updatedFields = [...col.fields, rel("quote_id", ids.comments)];
  await pb.collections.update("comments", { fields: updatedFields });
  console.log("  comments.quote_id -> comments");
} catch (e) {
  console.error(`  comments.quote_id FAILED: ${e.response?.message || e.message}`);
}

// Step 7: Update users collection to add extra fields
console.log("\n=== Step 7: Update users fields ===");
try {
  const usersCol = await pb.collections.getOne("_pb_users_auth_");
  const existingNames = usersCol.fields.map(f => f.name);
  const newFields = [];
  if (!existingNames.includes("department_id")) newFields.push(rel("department_id", ids.departments));
  if (!existingNames.includes("role_id")) newFields.push(rel("role_id", ids.roles));
  if (!existingNames.includes("group_ids")) newFields.push({ ...rel("group_ids", ids.professional_groups), maxSelect: 10 });
  if (!existingNames.includes("reminder_days")) newFields.push(num("reminder_days"));
  if (!existingNames.includes("disabled")) newFields.push(bool_("disabled"));
  if (!existingNames.includes("username")) newFields.push(txt("username"));

  if (newFields.length > 0) {
    await pb.collections.update("_pb_users_auth_", { fields: [...usersCol.fields, ...newFields] });
    console.log(`  users: added ${newFields.length} fields: ${newFields.map(f => f.name).join(", ")}`);
  } else {
    console.log("  users: all fields already present");
  }
} catch (e) {
  console.error(`  users FAILED: ${e.response?.message || e.message}`);
}

console.log("\n✅ All done!");
console.log("Collections created:", Object.keys(ids).length);
console.log("\nIDs:", JSON.stringify(ids, null, 2));
