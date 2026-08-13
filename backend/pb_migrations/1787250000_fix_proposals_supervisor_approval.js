/// <reference path="../pb_data/types.d.ts" />

// Fix proposals approval: the updateRule only allowed the requester, can_manage roles
// and superusers, so the task supervisor could never reach the record to approve/reject
// (they got a 404 before the onRecordUpdateRequest guard could authorize them).
// The guard in all.pb.js already enforces the real rules (supervisor-only approve/reject,
// requester withdraw/edit-reason, can_manage/superuser pass-through), so we relax the
// rule to let any authenticated user reach the record and let the guard decide.
migrate((app) => {
  const proposals = app.findCollectionByNameOrId("proposals")
  unmarshal({
    "updateRule": "@request.auth.id != \"\""
  }, proposals)
  app.save(proposals)
}, (app) => {
  const proposals = app.findCollectionByNameOrId("proposals")
  unmarshal({
    "updateRule": "@request.auth.id = requester_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = \"_superusers\""
  }, proposals)
  app.save(proposals)
})
