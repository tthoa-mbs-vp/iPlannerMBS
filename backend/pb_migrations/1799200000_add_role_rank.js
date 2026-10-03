/// <reference path="../pb_data/types.d.ts" />
// Add `roles.rank` — a numeric position in the company hierarchy.
//
// `level` (leadership / management / employee) only has three buckets, so it
// cannot tell a Director (giám đốc) apart from their Deputy (phó giám đốc),
// nor Trưởng phòng from Phó phòng. `rank` gives the fine-grained order the
// business actually uses:
//
//   rank = 1 -> highest position  (giám đốc)
//   rank = 2 -> their deputy      (phó giám đốc)
//   rank = 3 -> one below that    (trưởng phòng)
//   ...
//   rank = N -> lowest position
//
// SMALLER number = HIGHER position, so ordering is a plain ascending sort and
// "is A above B" is `A.rank < B.rank`.
//
// This is purely additive: `level` keeps driving every permission decision
// (can_manage, view_scope, leave approval) so no existing access control
// changes behaviour. `rank` is ordering/display metadata until something
// explicitly consumes it.
//
// Backfill for existing deployments derives a starting rank from `level`
// (leadership=1, management=2, employee=3). Roles that end up sharing a rank
// are ordered by their existing `level` then `name`, so the list stays stable;
// an admin re-numbers them from the Chức vụ screen to match the real org chart.
//
// Idempotent: only adds the field when missing, only writes ranks when the
// role still has none.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2105053228")
  if (!collection) return

  if (!collection.fields.getByName("rank")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "number_role_rank",
      "max": null,
      "min": 1,
      "name": "rank",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
    app.save(collection)
    console.log("  roles.rank added (min 1, integer)")
  }

  // Backfill: only roles that have no rank yet. Migrations run with `app`, not
  // the hook-scoped `$app`, so use the app methods here.
  const LEVEL_DEFAULT = { leadership: 1, management: 2, employee: 3 }
  const roles = app.findRecordsByFilter("roles", "rank = 0 || rank = null || rank = ''", "", 0, 0)
  for (var i = 0; i < roles.length; i++) {
    var role = roles[i]
    var lvl = role.getString("level") || "employee"
    role.set("rank", LEVEL_DEFAULT[lvl] || 3)
    app.save(role)
  }
  if (roles.length > 0) {
    console.log("  roles.rank backfilled for " + roles.length + " role(s)")
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2105053228")
  if (!collection) return

  const field = collection.fields.getByName("rank")
  if (field) {
    collection.fields.removeById(field.id)
    app.save(collection)
    console.log("  roles.rank removed")
  }
})
