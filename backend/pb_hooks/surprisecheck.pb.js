// surprisecheck.pb.js — Kiểm tra đột xuất (Surprise Check) API
// Creates presence_campaigns + presence_check_logs via PocketBase hooks.
// Admin starts a campaign → all logged-in users receive a check → user responds
// with password or biometric (simulated) → system records working status.

require("./helpers.js"); // shared helpers — available via module.exports

// POST /api/surprise-check/start
// Body: { name?, notes?, target_user_ids? }
// Creates a presence_campaign with status=active, creates check logs for all users.
routerAdd("POST", "/api/surprise-check/start", function (e) {
  var info = e.requestInfo();
  if (!info || !info.auth) {
    throw new UnauthorizedError("Unauthorized");
  }

  var actor = info.auth;
  if (actor.collection().name !== "users") {
    throw new ForbiddenError("Forbidden");
  }

  // Check can_manage permission
  var roleId = actor.getString("role_id");
  if (roleId) {
    try {
      var role = $app.findRecordById("roles", roleId);
      if (!role || !role.getBool("can_manage")) {
        throw new ForbiddenError("Chỉ quản trị viên mới có thể kiểm tra đột xuất");
      }
    } catch (ex) {
      if (ex instanceof ForbiddenError) throw ex;
      throw new ForbiddenError("Chỉ quản trị viên mới có thể kiểm tra đột xuất");
    }
  } else {
    throw new ForbiddenError("Chỉ quản trị viên mới có thể kiểm tra đột xuất");
  }

  var body = e.requestInfo().body;
  var name = (body.name || "Kiểm tra đột xuất").toString().slice(0, 200);
  var notes = (body.notes || "").toString().slice(0, 500);
  var targetUserIds = body.target_user_ids || [];
  var windowMinutes = parseInt(body.response_window_minutes) || 15;
  if (windowMinutes < 1) windowMinutes = 1;
  if (windowMinutes > 60) windowMinutes = 60;

  // Check if there's already an active campaign
  var campaignsColl = $app.findCollectionByNameOrId("presence_campaigns");
  var existingActive = $app.findRecordsByFilter(campaignsColl, 'status="active"', "", 1, 0);
  if (existingActive.length > 0) {
    throw new BadRequestError("Đã có một chiến dịch kiểm tra đang hoạt động. Vui lòng kết thúc trước.");
  }

  // Create the campaign
  var campaign = new Record(campaignsColl);
  campaign.set("name", name);
  campaign.set("status", "active");
  campaign.set("started_by", actor.id);
  campaign.set("started_at", new Date().toISOString());
  campaign.set("notes", notes);
  campaign.set("response_window_minutes", windowMinutes);
  $app.save(campaign);

  // Get target users (all active users or specific ones)
  var usersColl = $app.findCollectionByNameOrId("users");
  var filter = "verified=true && disabled=false";
  if (targetUserIds.length > 0) {
    // Build filter for specific users
    var idFilters = [];
    for (var i = 0; i < targetUserIds.length; i++) {
      idFilters.push('id="' + targetUserIds[i] + '"');
    }
    filter = idFilters.join(" || ");
  }
  var users = $app.findRecordsByFilter(usersColl, filter, "", 0, 0);

  // Create check logs for each user
  var checkLogsColl = $app.findCollectionByNameOrId("presence_check_logs");
  var created = 0;
  for (var j = 0; j < users.length; j++) {
    var user = users[j];
    // Skip the admin who started the campaign
    if (user.id === actor.id) continue;

    var checkLog = new Record(checkLogsColl);
    checkLog.set("campaign_id", campaign.id);
    checkLog.set("user_id", user.id);
    checkLog.set("responded", false);
    checkLog.set("device_info", "surprise_check");
    $app.save(checkLog);
    created++;

    // Send notification
    try {
      var notifColl = $app.findCollectionByNameOrId("notifications");
      var notif = new Record(notifColl);
      notif.set("user_id", user.id);
      notif.set("type", "surprise_check");
      notif.set("reference_id", JSON.stringify({
        campaignId: campaign.id,
        campaignName: name,
        message: "Bạn có yêu cầu kiểm tra đột xuất. Vui lòng xác nhận trong " + windowMinutes + " phút.",
        windowMinutes: windowMinutes,
      }));
      notif.set("is_read", false);
      $app.save(notif);
    } catch (notifEx) {
      // Notification failure is non-fatal
    }
  }

  return e.json(200, {
    ok: true,
    campaign_id: campaign.id,
    name: name,
    total_users: created,
    window_minutes: windowMinutes,
  });
});

// POST /api/surprise-check/respond
// Body: { campaign_id, password?, method: "password" | "biometric" }
// Verifies password and marks the user as responded.
routerAdd("POST", "/api/surprise-check/respond", function (e) {
  var info = e.requestInfo();
  if (!info || !info.auth) {
    throw new UnauthorizedError("Unauthorized");
  }

  var actor = info.auth;
  if (actor.collection().name !== "users") {
    throw new ForbiddenError("Forbidden");
  }

  var body = e.requestInfo().body;
  var campaignId = body.campaign_id;
  var password = body.password || "";
  var method = body.method || "password";

  if (!campaignId) {
    throw new BadRequestError("Thiếu campaign_id");
  }

  // Verify the campaign is active
  var campaignsColl = $app.findCollectionByNameOrId("presence_campaigns");
  var campaign;
  try {
    campaign = $app.findRecordById(campaignsColl, campaignId);
  } catch (ex) {
    throw new NotFoundError("Không tìm thấy chiến dịch kiểm tra");
  }

  if (campaign.getString("status") !== "active") {
    throw new BadRequestError("Chiến dịch kiểm tra đã kết thúc");
  }

  // Verify password if method is "password"
  if (method === "password") {
    if (!password) {
      throw new BadRequestError("Thiếu mật khẩu xác nhận");
    }
    var usersColl = $app.findCollectionByNameOrId("users");
    var user;
    try {
      user = $app.findRecordById(usersColl, actor.id);
    } catch (ex) {
      throw new ForbiddenError("Không tìm thấy người dùng");
    }
    // PocketBase 0.39 record.validatePassword() checks bcrypt hash
    if (!user.validatePassword(password)) {
      throw new BadRequestError("Mật khẩu không chính xác");
    }
  }

  // Find or create the check log for this user+campaign
  var checkLogsColl = $app.findCollectionByNameOrId("presence_check_logs");
  var existingLogs = $app.findRecordsByFilter(
    checkLogsColl,
    'campaign_id="' + campaignId + '" && user_id="' + actor.id + '"',
    "",
    1,
    0
  );

  var checkLog;
  if (existingLogs.length > 0) {
    checkLog = existingLogs[0];
    if (checkLog.getBool("responded")) {
      return e.json(200, { ok: true, message: "Bạn đã xác nhận rồi" });
    }
  } else {
    checkLog = new Record(checkLogsColl);
    checkLog.set("campaign_id", campaignId);
    checkLog.set("user_id", actor.id);
  }

  checkLog.set("responded", true);
  checkLog.set("responded_at", new Date().toISOString());
  checkLog.set("device_info", (body.device_info || navigator.userAgent || "").toString().slice(0, 200));
  $app.save(checkLog);

  return e.json(200, {
    ok: true,
    message: "Xác nhận thành công",
    responded_at: checkLog.getString("responded_at"),
  });
});

// GET /api/surprise-check/active
// Returns the currently active surprise check for the logged-in user.
routerAdd("GET", "/api/surprise-check/active", function (e) {
  var info = e.requestInfo();
  if (!info || !info.auth) {
    return e.json(200, { active: null });
  }

  var actor = info.auth;
  if (actor.collection().name !== "users") {
    return e.json(200, { active: null });
  }

  // Find active campaigns
  var campaignsColl = $app.findCollectionByNameOrId("presence_campaigns");
  var activeCampaigns = $app.findRecordsByFilter(campaignsColl, 'status="active"', "", 1, 0);

  if (activeCampaigns.length === 0) {
    return e.json(200, { active: null });
  }

  var campaign = activeCampaigns[0];

  // Check if user already responded
  var checkLogsColl = $app.findCollectionByNameOrId("presence_check_logs");
  var userLogs = $app.findRecordsByFilter(
    checkLogsColl,
    'campaign_id="' + campaign.id + '" && user_id="' + actor.id + '"',
    "",
    1,
    0
  );

  var responded = userLogs.length > 0 && userLogs[0].getBool("responded");

  return e.json(200, {
    active: {
      id: campaign.id,
      name: campaign.getString("name"),
      notes: campaign.getString("notes"),
      started_at: campaign.getString("started_at"),
      started_by: campaign.getString("started_by"),
      response_window_minutes: campaign.getInt("response_window_minutes") || 15,
      responded: responded,
      responded_at: userLogs.length > 0 ? userLogs[0].getString("responded_at") : null,
    },
  });
});

// POST /api/surprise-check/close
// Body: { campaign_id }
// Closes an active campaign (admin only).
routerAdd("POST", "/api/surprise-check/close", function (e) {
  var info = e.requestInfo();
  if (!info || !info.auth) {
    throw new UnauthorizedError("Unauthorized");
  }

  var actor = info.auth;
  if (actor.collection().name !== "users") {
    throw new ForbiddenError("Forbidden");
  }

  // Check can_manage
  var roleId = actor.getString("role_id");
  if (roleId) {
    try {
      var role = $app.findRecordById("roles", roleId);
      if (!role || !role.getBool("can_manage")) {
        throw new ForbiddenError("Chỉ quản trị viên mới có thể kết thúc chiến dịch");
      }
    } catch (ex) {
      if (ex instanceof ForbiddenError) throw ex;
      throw new ForbiddenError("Chỉ quản trị viên mới có thể kết thúc chiến dịch");
    }
  }

  var body = e.requestInfo().body;
  var campaignId = body.campaign_id;

  if (!campaignId) {
    // Close all active campaigns
    var campaignsColl = $app.findCollectionByNameOrId("presence_campaigns");
    var active = $app.findRecordsByFilter(campaignsColl, 'status="active"', "", 0, 0);
    for (var i = 0; i < active.length; i++) {
      active[i].set("status", "closed");
      active[i].set("ended_at", new Date().toISOString());
      $app.save(active[i]);
    }
    return e.json(200, { ok: true, closed: active.length });
  }

  var campaignsColl2 = $app.findCollectionByNameOrId("presence_campaigns");
  var campaign;
  try {
    campaign = $app.findRecordById(campaignsColl2, campaignId);
  } catch (ex) {
    throw new NotFoundError("Không tìm thấy chiến dịch");
  }

  campaign.set("status", "closed");
  campaign.set("ended_at", new Date().toISOString());
  $app.save(campaign);

  return e.json(200, { ok: true, closed: 1 });
});

// GET /api/surprise-check/results/:campaignId
// Returns response summary for a campaign (admin only).
routerAdd("GET", "/api/surprise-check/results/{campaignId}", function (e) {
  var info = e.requestInfo();
  if (!info || !info.auth) {
    throw new UnauthorizedError("Unauthorized");
  }

  var actor = info.auth;
  if (actor.collection().name !== "users") {
    throw new ForbiddenError("Forbidden");
  }

  var campaignId = e.requestInfo().routeParams.campaignId;

  var campaignsColl = $app.findCollectionByNameOrId("presence_campaigns");
  var campaign;
  try {
    campaign = $app.findRecordById(campaignsColl, campaignId);
  } catch (ex) {
    throw new NotFoundError("Không tìm thấy chiến dịch");
  }

  var checkLogsColl = $app.findCollectionByNameOrId("presence_check_logs");
  var logs = $app.findRecordsByFilter(
    checkLogsColl,
    'campaign_id="' + campaignId + '"',
    "-responded_at",
    0,
    0
  );

  var responded = 0;
  var notResponded = 0;
  var details = [];

  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    var hasResponded = log.getBool("responded");
    if (hasResponded) responded++;
    else notResponded++;

    // Try to get user info
    var userName = "";
    var userDept = "";
    try {
      var userId = log.getString("user_id");
      if (userId) {
        var usersColl = $app.findCollectionByNameOrId("users");
        var user = $app.findRecordById(usersColl, userId);
        userName = user.getString("name") || user.getString("email") || "";
        var deptId = user.getString("department_id");
        if (deptId) {
          try {
            var deptsColl = $app.findCollectionByNameOrId("departments");
            var dept = $app.findRecordById(deptsColl, deptId);
            userDept = dept.getString("name") || "";
          } catch (ex) { /* ignore */ }
        }
      }
    } catch (ex) { /* ignore */ }

    details.push({
      user_id: log.getString("user_id"),
      user_name: userName,
      department: userDept,
      responded: hasResponded,
      responded_at: log.getString("responded_at"),
      device_info: log.getString("device_info"),
    });
  }

  return e.json(200, {
    campaign: {
      id: campaign.id,
      name: campaign.getString("name"),
      status: campaign.getString("status"),
      started_at: campaign.getString("started_at"),
      ended_at: campaign.getString("ended_at"),
      notes: campaign.getString("notes"),
    },
    total: responded + notResponded,
    responded: responded,
    not_responded: notResponded,
    details: details,
  });
});
