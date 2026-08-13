/// <reference path="../pb_data/types.d.ts" />

// Presence-check campaigns.
// Flow:
//   1. Mobile apps ping POST /api/custom/presence/heartbeat periodically while open.
//   2. An authorized (can_manage / superuser) user starts a campaign (open window).
//   3. At close/check time, the system evaluates who sent a heartbeat inside the
//      campaign window -> those users are "present" (responded). Results are stored
//      in presence_check_logs for auditing.
// NOTE: PB 0.26 isolates handler contexts, so every helper/constant must be
// defined INSIDE each routerAdd callback (top-level scope is not shared).

// ---- mobile app heartbeat: any authenticated user ----
routerAdd("POST", "/api/custom/presence/heartbeat", function(c) {
  var H = require(__hooks + "/helpers.js")
  var PRESENT_MIN_GAP_MS = 15 * 1000

  var info = c.requestInfo()
  H.ensureEnabled(info) // H3: disabled accounts cannot heartbeat
  var actor = info.auth
  if (!actor) throw new ForbiddenError("Authentication required")
  if (actor.collection().name !== "users") throw new ForbiddenError("Chỉ tài khoản người dùng mới gửi heartbeat")

  var body = info.body || {}
  var deviceInfo = body.device_info ? String(body.device_info).slice(0, 255) : ""
  var now = new Date().toISOString()

  var coll = $app.findCollectionByNameOrId("presence_heartbeats")
  var existing = $app.findRecordsByFilter(coll, 'user_id="' + actor.id + '"', "", 1, 0)
  var rec = existing[0]

  if (rec) {
    var lastSeen = rec.getString("last_seen_at")
    if (lastSeen && (Date.now() - new Date(lastSeen).getTime()) < PRESENT_MIN_GAP_MS) {
      return c.json(200, { ok: true, throttled: true })
    }
    rec.set("last_seen_at", now)
    if (deviceInfo) rec.set("device_info", deviceInfo)
    $app.save(rec)
  } else {
    rec = new Record(coll)
    rec.set("user_id", actor.id)
    rec.set("last_seen_at", now)
    rec.set("device_info", deviceInfo)
    $app.save(rec)
  }

  return c.json(200, { ok: true, last_seen_at: now })
})

// ---- who is currently online (recent heartbeat) ----
routerAdd("GET", "/api/custom/presence/present", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo()) // H3
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể xem danh sách có mặt")

  var PRESENT_TTL_MS = 60 * 1000
  var cutoff = new Date(Date.now() - PRESENT_TTL_MS).toISOString()
  var coll = $app.findCollectionByNameOrId("presence_heartbeats")
  var records = $app.findRecordsByFilter(coll, 'last_seen_at >= "' + cutoff + '"', "-last_seen_at", 0, 0)

  var users = []
  for (var i = 0; i < records.length; i++) {
    var userId = records[i].getString("user_id")
    var userRec = null
    try { userRec = $app.findRecordById("users", userId) } catch (ex) { userRec = null }
    if (!userRec) continue
    users.push({
      user_id: userId,
      name: userRec.getString("name") || userRec.getString("email"),
      department_id: userRec.getString("department_id"),
      role_id: userRec.getString("role_id"),
      last_seen_at: records[i].getString("last_seen_at"),
      device_info: records[i].getString("device_info"),
    })
  }

  return c.json(200, { present: users, ttl_seconds: PRESENT_TTL_MS / 1000 })
})

// ---- start a campaign (open the check window) ----
routerAdd("POST", "/api/custom/presence/start", function(c) {
  var H = require(__hooks + "/helpers.js")
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể kích hoạt đợt kiểm tra")

  var info = c.requestInfo()
  H.ensureEnabled(info) // H3
  var body = info.body || {}
  var actor = info.auth
  var actorId = actor && actor.collection().name === "users" ? actor.id : ""

  // Only one active campaign at a time.
  var coll = $app.findCollectionByNameOrId("presence_campaigns")
  var active = $app.findRecordsByFilter(coll, 'status="active"', "", 1, 0)
  if (active.length > 0) {
    throw new BadRequestError("Đã có đợt kiểm tra đang hoạt động. Hãy đóng đợt hiện tại trước.")
  }

  var rec = new Record(coll)
  rec.set("name", (body.name ? String(body.name).slice(0, 200) : "Đợt kiểm tra hiện diện"))
  rec.set("status", "active")
  if (actorId) rec.set("started_by", actorId)
  rec.set("started_at", new Date().toISOString())
  if (body.notes !== undefined) rec.set("notes", String(body.notes).slice(0, 2000))
  $app.save(rec)

  return c.json(200, { ok: true, id: rec.id, name: rec.getString("name"), status: "active", started_at: rec.getString("started_at") })
})

// ---- close a campaign ----
routerAdd("POST", "/api/custom/presence/stop", function(c) {
  var H = require(__hooks + "/helpers.js")
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể đóng đợt kiểm tra")

  var info = c.requestInfo()
  H.ensureEnabled(info) // H3
  var body = info.body || {}
  var coll = $app.findCollectionByNameOrId("presence_campaigns")

  var id = body.id
  var rec = null
  if (id) {
    try { rec = $app.findRecordById(coll, id) } catch (ex) { rec = null }
  } else {
    var active = $app.findRecordsByFilter(coll, 'status="active"', "", 1, 0)
    rec = active[0] || null
  }
  if (!rec) throw new NotFoundError("Không tìm thấy đợt kiểm tra")

  rec.set("status", "closed")
  rec.set("ended_at", new Date().toISOString())
  $app.save(rec)

  return c.json(200, { ok: true, id: rec.id, status: "closed", ended_at: rec.getString("ended_at") })
})

// ---- evaluate the campaign window: who responded (heartbeat inside window) ----
routerAdd("POST", "/api/custom/presence/run-check", function(c) {
  var H = require(__hooks + "/helpers.js")
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể chạy kiểm tra")

  var info = c.requestInfo()
  H.ensureEnabled(info) // H3
  var body = info.body || {}
  var campId = body.id
  if (!campId) throw new BadRequestError("Thiếu id đợt kiểm tra")

  var campColl = $app.findCollectionByNameOrId("presence_campaigns")
  var campaign = null
  try { campaign = $app.findRecordById(campColl, campId) } catch (ex) { campaign = null }
  if (!campaign) throw new NotFoundError("Không tìm thấy đợt kiểm tra")

  var windowStartIso = campaign.getString("started_at") || campaign.getString("created")
  var windowEndIso = campaign.getString("ended_at") || new Date().toISOString()
  var windowStart = new Date(windowStartIso).getTime()
  var windowEnd = new Date(windowEndIso).getTime()

  // Collect heartbeats inside the window, keeping the earliest per user.
  var respondedAt = {}
  var hbColl = $app.findCollectionByNameOrId("presence_heartbeats")
  var hbs = $app.findRecordsByFilter(hbColl, "", "", 0, 0)
  for (var i = 0; i < hbs.length; i++) {
    var uid = hbs[i].getString("user_id")
    var iso = hbs[i].getString("last_seen_at")
    var ts = new Date(iso).getTime()
    if (ts < windowStart || ts > windowEnd) continue
    if (!respondedAt[uid]) respondedAt[uid] = { at: iso, device: hbs[i].getString("device_info") }
  }

  // Evaluate every active user.
  var usersColl = $app.findCollectionByNameOrId("users")
  var allUsers = $app.findRecordsByFilter(usersColl, "verified=true && disabled=false", "", 0, 0)

  var responded = 0
  var absent = 0
  for (var u = 0; u < allUsers.length; u++) {
    var userId = allUsers[u].id
    var hit = respondedAt[userId]
    var hitAt = hit ? hit.at : null
    var device = hit ? hit.device : ""

    // Upsert a presence_check_logs row for this user in this campaign.
    var logColl = $app.findCollectionByNameOrId("presence_check_logs")
    var existing = $app.findRecordsByFilter(logColl, 'campaign_id="' + campId + '" && user_id="' + userId + '"', "", 1, 0)
    var logRec = existing[0] || new Record(logColl)
    logRec.set("campaign_id", campId)
    logRec.set("user_id", userId)
    logRec.set("responded", !!hitAt)
    if (hitAt) logRec.set("responded_at", hitAt)
    if (device) logRec.set("device_info", String(device).slice(0, 255))
    $app.save(logRec)

    if (hitAt) responded++
    else absent++
  }

  return c.json(200, {
    ok: true,
    campaign_id: campId,
    window_start: new Date(windowStart).toISOString(),
    window_end: new Date(windowEnd).toISOString(),
    total_users: allUsers.length,
    responded: responded,
    absent: absent,
  })
})

// ---- list campaigns with per-campaign stats ----
routerAdd("GET", "/api/custom/presence/campaigns", function(c) {
  var H = require(__hooks + "/helpers.js")
  H.ensureEnabled(c.requestInfo()) // H3
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể xem lịch sử đợt kiểm tra")

  var coll = $app.findCollectionByNameOrId("presence_campaigns")
  var records = $app.findRecordsByFilter(coll, "", "-created", 0, 0)

  var logColl = $app.findCollectionByNameOrId("presence_check_logs")
  var out = []
  for (var i = 0; i < records.length; i++) {
    var cid = records[i].id
    var logs = $app.findRecordsByFilter(logColl, 'campaign_id="' + cid + '"', "", 0, 0)
    var respondedCount = 0
    for (var li = 0; li < logs.length; li++) {
      if (logs[li].getBool("responded")) respondedCount++
    }
    var startedBy = ""
    try {
      var sb = $app.findRecordById("users", records[i].getString("started_by"))
      startedBy = sb.getString("name") || sb.getString("email")
    } catch (ex) { startedBy = "" }

    out.push({
      id: cid,
      name: records[i].getString("name"),
      status: records[i].getString("status"),
      started_at: records[i].getString("started_at"),
      ended_at: records[i].getString("ended_at"),
      notes: records[i].getString("notes"),
      started_by: startedBy,
      total_logs: logs.length,
      responded: respondedCount,
      absent: logs.length - respondedCount,
      created: records[i].getString("created"),
    })
  }

  return c.json(200, { campaigns: out })
})

// ---- per-campaign detail: who responded / who was absent ----
routerAdd("GET", "/api/custom/presence/check-logs", function(c) {
  var H = require(__hooks + "/helpers.js")
  if (!H.isManager(c)) throw new ForbiddenError("Chỉ quản trị viên mới có thể xem kết quả kiểm tra")

  var info = c.requestInfo()
  H.ensureEnabled(info) // H3
  var query = info.query || {}
  var campId = String(query.campaign_id || "")
  if (!campId) throw new BadRequestError("Thiếu campaign_id")

  var logColl = $app.findCollectionByNameOrId("presence_check_logs")
  var logs = $app.findRecordsByFilter(logColl, 'campaign_id="' + campId + '"', "-responded", 0, 0)

  var out = []
  for (var i = 0; i < logs.length; i++) {
    var userId = logs[i].getString("user_id")
    var userRec = null
    try { userRec = $app.findRecordById("users", userId) } catch (ex) { userRec = null }
    if (!userRec) continue
    out.push({
      user_id: userId,
      name: userRec.getString("name") || userRec.getString("email"),
      department_id: userRec.getString("department_id"),
      responded: logs[i].getBool("responded"),
      responded_at: logs[i].getString("responded_at"),
      device_info: logs[i].getString("device_info"),
    })
  }

  return c.json(200, { logs: out })
})
