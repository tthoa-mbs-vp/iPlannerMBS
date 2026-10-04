/// <reference path="../pb_data/types.d.ts" />

// S1 support endpoint — /api/custom/role-directory
//
// Why this exists: S1 tightened the `roles` collection so a plain list requires
// can_manage (see 1799300000_lock_roles_read_rules.js). That is correct for the permission
// TABLE, but it broke one legitimate consumer: HRPage's "lọc theo chức vụ" dropdown.
//
// HR officers hold `can_view_salary` WITHOUT `can_manage`, so they are allowed into /hr
// (HRPage gates on isAdmin || canViewSalary) yet can no longer list `roles`. Silently
// emptying that dropdown would be a functional regression, so this endpoint serves the
// narrow slice the UI actually needs.
//
// What it returns: id, code, name, level — and nothing else. In particular NONE of the
// permission bits (can_view_salary, can_manage, can_approve_leave, view_scope,
// approval_scope) are ever serialised, so the leak S1 closed stays closed: knowing that a
// role exists and what it is called is not the same as learning what it is allowed to do.
//
// Access mirrors the pages that consume it: can_view_salary or can_manage (plus the
// superuser escape hatch), and disabled accounts are rejected by ensureEnabled (H3) just
// like every other request.

routerAdd("GET", "/api/custom/role-directory", function (c) {
  var H = require(__hooks + "/helpers.js")
  var info = c.requestInfo()
  H.ensureEnabled(info) // H3: disabled accounts lose access immediately

  var allowed = false
  if (info.hasSuperuserAuth()) {
    allowed = true
  } else if (info.auth && info.auth.collection().name === "users") {
    var roleId = info.auth.getString("role_id")
    if (roleId) {
      try {
        var role = $app.findRecordById("roles", roleId)
        allowed = !!(role && (role.getBool("can_manage") || role.getBool("can_view_salary")))
      } catch (ex) {
        allowed = false // fail-closed if the role record cannot be resolved
      }
    }
  }
  if (!allowed) throw new ForbiddenError("Bạn không có quyền xem danh sách chức vụ")

  var roles = $app.findRecordsByFilter("roles", "", "code", 0, 0)
  var items = []
  for (var i = 0; i < roles.length; i++) {
    var r = roles[i]
    // Explicit allow-list: never spread the record, so a future field cannot leak by default.
    items.push({
      id: r.getString("id"),
      code: r.getString("code"),
      name: r.getString("name"),
      level: r.getString("level"),
    })
  }
  return c.json(200, { items: items })
})
