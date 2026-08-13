/// <reference path="../pb_data/types.d.ts" />
// Finer-grained permissions: add can_view_salary to roles so HR staff who do not
// have full can_manage can still READ salary/HR records without being able to write.
migrate((app) => {
  const roles = app.findCollectionByNameOrId("pbc_2105053228")
  const roleFields = roles.fields.fieldNames()
  if (!roleFields.includes("can_view_salary")) {
    roles.fields.add(new Field({
      "hidden": false,
      "id": "bool_view_salary",
      "name": "can_view_salary",
      "required": false,
      "system": false,
      "type": "bool"
    }))
    app.save(roles)
  }

  // Default: any role that already manages HR (can_manage) also gets salary view.
  const roleColl = app.findCollectionByNameOrId("roles")
  const roleRecords = app.findRecordsByFilter(roleColl, "", "", 0, 0)
  for (const r of roleRecords) {
    if (r.getBool("can_manage") && !r.getBool("can_view_salary")) {
      r.set("can_view_salary", true)
      app.save(r)
    }
  }

  const readRule = '@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'

  // salary_records: can_view_salary may LIST/VIEW (read-only). Writes stay can_manage only.
  const salaryRecords = app.findCollectionByNameOrId("salary_records")
  salaryRecords.listRule = readRule
  salaryRecords.viewRule = readRule
  app.save(salaryRecords)

  // employee_profiles: self OR can_view_salary OR can_manage may read. Writes unchanged.
  const ep = app.findCollectionByNameOrId("employee_profiles")
  const epRead = '@request.auth.id = user_id || @request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  ep.listRule = epRead
  ep.viewRule = epRead
  app.save(ep)

  // qualifications + work_experiences: same HR read permission.
  const quals = app.findCollectionByNameOrId("qualifications")
  quals.listRule = readRule
  quals.viewRule = readRule
  app.save(quals)

  const we = app.findCollectionByNameOrId("work_experiences")
  we.listRule = readRule
  we.viewRule = readRule
  app.save(we)
}, (app) => {
  const roles = app.findCollectionByNameOrId("pbc_2105053228")
  try {
    roles.fields.removeById("bool_view_salary")
    app.save(roles)
  } catch (e) {}

  const managerRule = '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  const salaryRecords = app.findCollectionByNameOrId("salary_records")
  salaryRecords.listRule = managerRule
  salaryRecords.viewRule = managerRule
  app.save(salaryRecords)

  const ep = app.findCollectionByNameOrId("employee_profiles")
  const epRead = '@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  ep.listRule = epRead
  ep.viewRule = epRead
  app.save(ep)

  const quals = app.findCollectionByNameOrId("qualifications")
  quals.listRule = managerRule
  quals.viewRule = managerRule
  app.save(quals)

  const we = app.findCollectionByNameOrId("work_experiences")
  we.listRule = managerRule
  we.viewRule = managerRule
  app.save(we)
})
