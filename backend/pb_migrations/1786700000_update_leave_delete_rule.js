/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // allow requester to delete their own pending leave requests (managers/superusers delete any)
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.deleteRule = '@request.auth.id = user_id && status = "pending" || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  app.save(lr)
}, (app) => {
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.deleteRule = '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  app.save(lr)
})
