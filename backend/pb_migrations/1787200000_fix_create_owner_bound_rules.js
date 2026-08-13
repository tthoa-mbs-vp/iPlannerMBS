/// <reference path="../pb_data/types.d.ts" />

// C8: bind createRule to the acting user so nobody can forge another user's ownership.
// Before this, an authenticated user could create records with arbitrary user_id/requester_id,
// e.g. spoofing attendance for someone else, fabricating comments/leaves/proposals, or polluting
// system_logs / notifications with a different actor. Client flows always send the current user's id
// (AttendancePage, LeavePage, CommentSection, ProposalSection, systemLogService), so owner-binding
// does not break legitimate use. Server-side creation uses $app.save() which bypasses rules.
migrate((app) => {
  const bind = (collectionName, ownerField) => {
    const coll = app.findCollectionByNameOrId(collectionName)
    const rule = '@request.auth.id = ' + ownerField + ' || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
    unmarshal({ "createRule": rule }, coll)
    app.save(coll)
  }

  bind("comments", "user_id")
  bind("proposals", "requester_id")
  bind("notifications", "user_id")
  bind("system_logs", "user_id")
  bind("attendance_logs", "user_id")
  bind("leave_requests", "user_id")
}, (app) => {
  const rollback = (collectionName) => {
    const coll = app.findCollectionByNameOrId(collectionName)
    unmarshal({ "createRule": '@request.auth.id != ""' }, coll)
    app.save(coll)
  }

  rollback("comments")
  rollback("proposals")
  rollback("notifications")
  rollback("system_logs")
  rollback("attendance_logs")
  rollback("leave_requests")
})
