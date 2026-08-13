/// <reference path="../pb_data/types.d.ts" />
// A8 follow-up: the first rule version used `?=` for group membership, which PB does not evaluate
// for relation containment in this filter context. `~` is the codebase's established operator for
// group overlap (see leave_requests listRule/updateRule). Re-apply the corrected rule.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("chat_messages");
  if (!collection) return;

  const rule =
    "@request.auth.collectionName = \"_superusers\" || @request.auth.role_id.can_manage = true || " +
    "channel_type = \"org\" || " +
    "(channel_type = \"department\" && channel_dept_id = @request.auth.department_id) || " +
    "(channel_type = \"group\" && @request.auth.group_ids ~ channel_group_id)";

  collection.listRule = rule;
  collection.viewRule = rule;

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("chat_messages");
  if (!collection) return;
  const rule =
    "@request.auth.collectionName = \"_superusers\" || @request.auth.role_id.can_manage = true || " +
    "channel_type = \"org\" || " +
    "(channel_type = \"department\" && channel_dept_id = @request.auth.department_id) || " +
    "(channel_type = \"group\" && @request.auth.group_ids ?= channel_group_id)";
  collection.listRule = rule;
  collection.viewRule = rule;
  return app.save(collection);
})
