routerAdd("POST", "/api/custom/approve-leave", function(c) {
  var H = require(__hooks + "/helpers.js")
  var info = c.requestInfo();
  H.ensureEnabled(info); // H3: disabled accounts cannot approve/reject leave
  var actor = info.auth;
  if (!actor) throw new ForbiddenError("Authentication required");

  var body = info.body || {};
  var id = body.id;
  var action = body.action;
  var reason = body.rejection_reason;
  if (!id) throw new BadRequestError("Missing id");
  if (action !== "approve" && action !== "reject") throw new BadRequestError("Invalid action");

  var record;
  try {
    record = $app.findRecordById("leave_requests", id);
  } catch (ex) {
    throw new NotFoundError("Leave request not found");
  }

  var requesterId = record.getString("user_id");
  var isSuper = actor.isSuperuser();

  var roleLevel = "";
  var canManage = false;
  var canApproveLeave = false;
  var approvalScope = "";
  if (isSuper) {
    canManage = true;
  } else if (actor.collection().name === "users") {
    var roleId = actor.getString("role_id");
    if (roleId) {
      var role = null;
      try { role = $app.findRecordById("roles", roleId); } catch (ex) {}
      if (role) {
        roleLevel = role.getString("level");
        canManage = role.getBool("can_manage");
        canApproveLeave = role.getBool("can_approve_leave");
        approvalScope = role.getString("approval_scope");
      }
    }
  }

  if (!canManage && !canApproveLeave) {
    throw new ForbiddenError("Khong co quyen phe duyet nghi phep");
  }

  var isLeadership = roleLevel === "leadership";

  // management/employee with approval permission cannot self-approve their own request
  if (!isLeadership && !isSuper && actor.id === requesterId) {
    throw new ForbiddenError("Khong the tu phe duyet don nghi cua minh");
  }

  if (!canManage) {
    if (approvalScope === "all") {
      // ok
    } else if (approvalScope === "department") {
      var totalDays = record.getFloat("total_days") || 0;
      var requester = null;
      try { requester = $app.findRecordById("users", requesterId); } catch (ex) {}
      var requesterDept = requester ? requester.getString("department_id") : "";
      var actorDept = actor.getString("department_id");
      if (totalDays >= 3 || requesterDept !== actorDept) {
        throw new ForbiddenError("Ngoai pham vi phe duyet");
      }
    } else if (approvalScope === "group") {
      var totalDays = record.getFloat("total_days") || 0;
      var requester = null;
      try { requester = $app.findRecordById("users", requesterId); } catch (ex) {}
      var requesterGroups = requester ? requester.get("group_ids") || [] : [];
      if (!Array.isArray(requesterGroups)) requesterGroups = [requesterGroups];
      var actorGroups = actor.get("group_ids") || [];
      if (!Array.isArray(actorGroups)) actorGroups = [actorGroups];
      var sharedGroup = false;
      for (var gi = 0; gi < actorGroups.length; gi++) {
        if (requesterGroups.indexOf(actorGroups[gi]) !== -1) { sharedGroup = true; break; }
      }
      if (totalDays >= 3 || !sharedGroup) {
        throw new ForbiddenError("Ngoai pham vi phe duyet");
      }
    } else {
      throw new ForbiddenError("Khong co pham vi phe duyet");
    }
  }

  var newStatus = action === "approve" ? "approved" : "rejected";
  record.set("status", newStatus);
  record.set("approver_id", actor.id);
  if (action === "reject") {
    record.set("rejection_reason", reason || "");
  }
  try {
    $app.save(record);
  } catch (ex) {
    throw new BadRequestError(ex && ex.message ? ex.message : "Failed to update leave request");
  }

  // A11: server-side audit (this is a $app.save, so no request hook fires — log here).
  H.auditLog({
    actorId: H.auditActorId(info),
    action: action === "approve" ? "Duyệt đơn nghỉ phép" : "Từ chối đơn nghỉ phép",
    target: H.recordLabel(record),
    ip: H.requestIp(c),
  })

  return c.json(200, { success: true });
});
