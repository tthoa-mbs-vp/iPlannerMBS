/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Collections created in 1785000002_add_hrm_collections.js are missing the
  // standard autodate `created`/`updated` fields, which makes sorting by
  // `-created` / `-updated` fail with a 400 error. Add them back.
  const collections = ["attendance_logs", "leave_balances", "employee_profiles", "leave_requests"]
  for (const name of collections) {
    const coll = app.findCollectionByNameOrId(name)
    const names = coll.fields.fieldNames()
    if (!names.includes("created")) {
      coll.fields.add(new Field({
        "type": "autodate",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "hidden": false,
        "required": false,
        "system": false,
        "presentable": false
      }))
    }
    if (!names.includes("updated")) {
      coll.fields.add(new Field({
        "type": "autodate",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "hidden": false,
        "required": false,
        "system": false,
        "presentable": false
      }))
    }
    app.save(coll)
  }
}, (app) => {
  const collections = ["attendance_logs", "leave_balances", "employee_profiles", "leave_requests"]
  for (const name of collections) {
    try {
      const coll = app.findCollectionByNameOrId(name)
      const names = coll.fields.fieldNames()
      if (names.includes("created")) coll.fields.removeByName("created")
      if (names.includes("updated")) coll.fields.removeByName("updated")
      app.save(coll)
    } catch (e) {}
  }
})
