/// <reference path="../pb_data/types.d.ts" />

// NOTE: the onRecordUpdateRequest guard for users (block self-service privilege edits) is
// consolidated in guards.pb.js (single registration per event — A1).

// Atomic upsert for employee_profiles (avoids client-side read-then-write race).
// Gated: the profile owner themselves, can_manage role holders, or superusers.
routerAdd("POST", "/api/custom/upsert-employee-profile", function(c) {
  var H = require(__hooks + "/helpers.js")
  var info = c.requestInfo();
  H.ensureEnabled(info); // H3
  var actor = info.auth;
  if (!actor) throw new ForbiddenError("Authentication required");

  var body = info.body || {};
  var userId = body.userId;
  if (!userId) throw new BadRequestError("Missing userId");

  var isOwner = actor.id === userId;
  var ri = H.roleInfo(actor);
  var canManage = ri.isSuper || ri.canManage;
  if (!isOwner && !canManage) throw new ForbiddenError("Bạn không có quyền cập nhật hồ sơ nhân sự này");

  var userRec = null;
  try { userRec = $app.findRecordById("users", userId); } catch (ex) {}
  if (!userRec) throw new NotFoundError("User not found");

  var coll = $app.findCollectionByNameOrId("employee_profiles");
  var existing = $app.findRecordsByFilter(coll, 'user_id="' + userId + '"', "", 1, 0);
  var rec = existing[0] || new Record(coll);

  var WHITELIST = ["phone", "dob", "identity_card", "tax_code", "bank_account", "bank_name", "join_date", "contract_type", "emergency_contact"];
  var data = body.data || {};
  for (var i = 0; i < WHITELIST.length; i++) {
    var field = WHITELIST[i];
    if (data[field] !== undefined) rec.set(field, data[field]);
  }
  rec.set("user_id", userId);
  try {
    $app.save(rec);
  } catch (ex) {
    throw new BadRequestError(ex && ex.message ? ex.message : "Failed to upsert profile");
  }

  // A11: server-side audit (endpoint writes via $app.save -> no request hook fires).
  H.auditLog({
    actorId: H.auditActorId(info),
    action: "Cập nhật hồ sơ nhân sự",
    target: userId,
    ip: H.requestIp(c),
  })

  return c.json(200, { success: true, id: rec.id, created: !existing[0] });
});

routerAdd("POST", "/api/custom/verify-user", function(c) {
  var info = c.requestInfo();
  var body = info.body || {};
  var userId = body.userId;
  if (!userId) throw new BadRequestError("Missing userId");

  var admin = info.auth;
  if (!admin || !admin.isSuperuser()) {
    throw new ForbiddenError("Only admins can verify users");
  }

  var record;
  try {
    record = $app.findRecordById("users", userId);
  } catch (ex) {
    throw new NotFoundError("User not found");
  }

  record.set("verified", body.verified !== false);
  try {
    $app.save(record);
  } catch (ex) {
    throw new BadRequestError("Failed to update user");
  }

  // A11: server-side audit.
  var H = require(__hooks + "/helpers.js")
  H.auditLog({
    actorId: H.auditActorId(info),
    action: body.verified !== false ? "Xác minh người dùng" : "Hủy xác minh người dùng",
    target: record.getString("email") || userId,
    ip: H.requestIp(c),
  })

  return c.json(200, { success: true });
});

routerAdd("POST", "/api/custom/change-user-email", function(c) {
  var H = require(__hooks + "/helpers.js")
  var info = c.requestInfo();
  H.ensureEnabled(info); // H3
  var actor = info.auth;
  if (!actor) throw new ForbiddenError("Authentication required");

  var canManage = H.roleInfo(actor).isSuper || H.roleInfo(actor).canManage;
  if (!canManage) throw new ForbiddenError("Only managers can change user email");

  var body = info.body || {};
  var userId = body.userId;
  var email = body.email;
  if (!userId) throw new BadRequestError("Missing userId");
  if (!email) throw new BadRequestError("Missing email");

  var record;
  try {
    record = $app.findRecordById("users", userId);
  } catch (ex) {
    throw new NotFoundError("User not found");
  }

  record.set("email", email);
  try {
    $app.save(record);
  } catch (ex) {
    throw new BadRequestError(ex && ex.message ? ex.message : "Failed to update email");
  }

  // A11: server-side audit.
  H.auditLog({
    actorId: H.auditActorId(info),
    action: "Đổi email người dùng",
    target: email,
    ip: H.requestIp(c),
  })

  return c.json(200, { success: true });
});
