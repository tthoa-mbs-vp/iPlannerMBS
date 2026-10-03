/// <reference path="../pb_data/types.d.ts" />
// Widen `tasks.rating` from 1-5 to 1-10.
//
// The KPI formula (backend/pb_hooks/_kpi-formula.cjs) has always divided the
// result rating by 10, but the schema still capped the field at 5 — so a
// supervisor literally could not give a task more than half marks, and the
// worst case (rating=1) scored better than it should. This migration makes the
// schema match the formula and the UI.
//
// Existing rows keep their stored value: old ratings 1..5 are still valid in a
// 1..10 field and are re-interpreted proportionally (see the "legacy" notes in
// the KPI formula). No data rewrite is performed on purpose — silently doubling
// historical scores would corrupt already-reported KPIs.
//
// Idempotent: it only touches the field when its current max is below 10.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")
  if (!collection) return

  const field = collection.fields.getByName("rating")
  if (!field) {
    console.log("  skip tasks.rating: field not present")
    return
  }
  if ((field.max ?? 0) >= 10) return

  field.max = 10
  field.min = 1
  app.save(collection)
  console.log("  tasks.rating: max 5 -> 10")
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")
  if (!collection) return

  const field = collection.fields.getByName("rating")
  if (!field) return

  field.max = 5
  app.save(collection)
  console.log("  tasks.rating: max 10 -> 5")
})
