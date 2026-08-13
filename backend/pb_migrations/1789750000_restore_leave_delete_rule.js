/// <reference path="../pb_data/types.d.ts" />
// A11: 1786800000 removed can_manage/superuser from the leave deleteRule (owner+ pending only),
// but the balance-recompute-on-delete hook (all.pb.js) expects managers/superusers to be able to
// remove leaves for corrections. Restore manager/superuser delete while keeping owner-pending cancel.
migrate((app) => {
  const lr = app.findCollectionByNameOrId("leave_requests");
  if (!lr) return;
  lr.deleteRule =
    '@request.auth.id = user_id && status = "pending" || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"';
  return app.save(lr);
}, (app) => {
  const lr = app.findCollectionByNameOrId("leave_requests");
  if (!lr) return;
  lr.deleteRule = '@request.auth.id = user_id && status = "pending"';
  return app.save(lr);
})
