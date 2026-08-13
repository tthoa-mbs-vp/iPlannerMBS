/// <reference path="../pb_data/types.d.ts" />
// A8: scope chat_messages read access to the user's own channels.
// Previously listRule/viewRule were "@request.auth.id != \"\"" (any authed user could read every
// org/department/group channel). Now: org channels stay org-wide, department channels require
// matching department_id, group channels require membership in the professional group. can_manage
// roles and superusers keep full visibility.
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
  collection.listRule = "@request.auth.id != \"\"";
  collection.viewRule = "@request.auth.id != \"\"";
  return app.save(collection);
})
