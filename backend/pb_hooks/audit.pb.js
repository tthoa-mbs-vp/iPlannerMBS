/// <reference path="../pb_data/types.d.ts" />

// Server-side audit for authentication (part of the A11 audit overhaul that replaced
// the client-side systemLogService).
//
// PB 0.39 exposes only onRecordAuthWithPasswordRequest (no after-success auth event),
// and it fires BEFORE the credentials are verified — e.record is the identity found
// by email/username (nil when the identity is unknown, still present when the PASSWORD
// is wrong). We therefore log every login ATTEMPT, not only successful logins; this
// matches security-audit practice (failed attempts are the most interesting signal)
// and is strictly better than the old client-side "Đăng nhập" log, which only fired
// after a successful login in the UI.
//
// The actor id is the targeted identity (may not have authenticated successfully).
// Superuser logins are logged too (user_id stays empty — system_logs.user_id is a
// relation to the users collection, and superusers do not exist there).

onRecordAuthWithPasswordRequest(function(e) {
  var H = require(__hooks + "/helpers.js")
  try {
    // Only users-collection identities may be stored in the system_logs.user_id
    // relation. Superuser logins are still logged (target = email), with a null
    // user_id. A failed identity search yields e.record = null -> also null.
    var actorId = ""
    if (e.record) {
      try {
        if (e.record.collection() && e.record.collection().name === "users") actorId = e.record.id
      } catch (ex) { actorId = "" }
    }
    H.auditLog({
      actorId: actorId,
      action: "Đăng nhập",
      target: String(e.identity || "").slice(0, 200),
      ip: H.requestIp(e),
    })
  } catch (ex) {
    // audit must never break the auth flow
    console.error("audit: auth log fail " + ex)
  }
  return e.next()
})
