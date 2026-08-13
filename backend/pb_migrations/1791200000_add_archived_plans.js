/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Create archived_plans collection mirroring the plans schema + archive metadata.
  // archived_tasks.plan_id keeps pointing at the original `plans` collection and stores
  // the original plan id; archived_plans.original_id holds the same value, so the two
  // archive stores are cross-linked by that id without any relation repointing.
  const archivedPlans = new Collection({
    id: "pbc_archived_plans",
    name: "archived_plans",
    type: "base",
    system: false,
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    updateRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    deleteRule: "@request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\"",
    fields: [
      { id: "text_archp_orig_id", name: "original_id", type: "text", required: true },
      { id: "text_archp_name", name: "name", type: "text", required: true },
      { id: "text_archp_desc", name: "description", type: "text", required: false },
      { id: "rel_archp_leader", name: "leader_id", type: "relation", required: false, collectionId: "_pb_users_auth_", maxSelect: 1 },
      { id: "rel_archp_host", name: "host_dept_id", type: "relation", required: false, collectionId: "pbc_3865025440", maxSelect: 1 },
      { id: "rel_archp_partner", name: "partner_dept_ids", type: "relation", required: false, collectionId: "pbc_3865025440", maxSelect: 50 },
      { id: "rel_archp_group", name: "group_id", type: "relation", required: false, collectionId: "pbc_professional_groups", maxSelect: 1 },
      { id: "date_archp_start", name: "start_date", type: "date", required: false },
      { id: "date_archp_end", name: "end_date", type: "date", required: false },
      { id: "select_archp_status", name: "status", type: "select", required: true, values: ["not_started", "in_progress", "completed", "paused", "cancelled"] },
      { id: "bool_archp_sudden", name: "is_sudden", type: "bool", required: false },
      { id: "bool_archp_impact", name: "is_high_impact", type: "bool", required: false },
      { id: "num_archp_progress", name: "progress", type: "number", required: false },
      { id: "date_archp_time", name: "archived_at", type: "date", required: true }
    ]
  })
  archivedPlans.addIndex("idx_archp_orig_id", false, "original_id", "")
  archivedPlans.addIndex("idx_archp_status_time", false, "status, archived_at", "")
  app.save(archivedPlans)
}, (app) => {
  try {
    const coll = app.findCollectionByNameOrId("archived_plans")
    if (coll) app.deleteCollection(coll)
  } catch (e) {}
})