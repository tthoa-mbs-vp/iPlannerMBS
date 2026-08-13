/// <reference path="../pb_data/types.d.ts" />
// A3 companion: leave_balances numeric fields must accept 0 (this PB version rejects 0 on required
// number fields as "blank"). used_days legitimately becomes 0 when no approved leaves remain, and
// remaining_days can be 0 when the full balance is consumed.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("leave_balances");
  if (!collection) return;
  for (let i = 0; i < collection.fields.length; i++) {
    const field = collection.fields[i];
    if (["used_days", "total_days", "remaining_days"].includes(field.name)) {
      field.required = false;
    }
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("leave_balances");
  if (!collection) return;
  for (let i = 0; i < collection.fields.length; i++) {
    const field = collection.fields[i];
    if (["used_days", "total_days", "remaining_days"].includes(field.name)) {
      field.required = true;
    }
  }
  return app.save(collection);
})
