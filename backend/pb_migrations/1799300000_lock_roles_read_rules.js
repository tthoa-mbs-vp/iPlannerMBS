/// <reference path="../pb_data/types.d.ts" />

// S1: the `roles` collection is the authorisation lookup table. Each record carries the
// whole org's permission bits — can_view_salary, can_manage, view_scope, approval_scope —
// so the previous open read rules ("@request.auth.id != \"\"") let ANY logged-in account
// enumerate the entire permission model, including exactly which role can read salary data.
//
// The fix is deliberately SPLIT, because the two rules do different jobs:
//
//   listRule → can_manage (+ superuser escape hatch)
//     Enumerating the table is only needed by the admin-only RoleManager / UserManager
//     screens. This is the leak being closed, and it is what lets a regular employee
//     discover which roles hold can_view_salary.
//
//   viewRule → own role, or can_manage, or superuser
//     Every permission flag in the web app comes from ONE call:
//       pb.collection("users").getOne(ownId, { expand: "department_id,role_id,group_ids" })
//     and then user.expand.role_id.can_view_salary / .can_manage — Sidebar, HRPage,
//     HRDetailPage, LeavePage, AdminPage, DataPage, LogsPage, TrashPage, DiscussionPage,
//     DashboardPage, mobile/*.pb
//     PocketBase DOES apply the viewRule of a related collection to expanded records, so
//     locking viewRule to can_manage-only would strip every non-admin of their permissions
//     while every frontend unit test kept passing. That exact regression is what
//     backend/test/roles_rule.test.js was written to catch, and it caught it.
//     Allowing `@request.auth.role_id.id = id` keeps that path alive: a user reads exactly
//     one role — their own — which is not sensitive beyond what the UI must already know,
//     and they still cannot read or list anyone else's role.
migrate((app) => {
  const listRule = '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  const viewRule = '@request.auth.role_id.id = id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  const coll = app.findCollectionByNameOrId("roles")
  if (!coll) return
  if (coll.listRule === listRule && coll.viewRule === viewRule) return // already applied — stay idempotent
  coll.listRule = listRule
  coll.viewRule = viewRule
  app.save(coll)
}, (app) => {
  // Rule-only rollback: restores the previous read rules. Touches no data, so it is safe
  // for a migration chain that never drops collections or records.
  const open = '@request.auth.id != ""'
  const coll = app.findCollectionByNameOrId("roles")
  if (!coll) return
  coll.listRule = open
  coll.viewRule = open
  app.save(coll)
})
