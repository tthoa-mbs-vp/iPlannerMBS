/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // only the requester can delete their leave request, and only while it is still pending
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.deleteRule = '@request.auth.id = user_id && status = "pending"'
  app.save(lr)
}, (app) => {
  const lr = app.findCollectionByNameOrId("leave_requests")
  lr.deleteRule = '@request.auth.id = user_id && status = "pending" || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  app.save(lr)
})
