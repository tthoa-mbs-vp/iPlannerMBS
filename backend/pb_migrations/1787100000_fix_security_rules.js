/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // C2: users - only managers/superusers can create user records
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  unmarshal({
    "createRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  }, users)
  app.save(users)

  // C3: salary_records - sensitive, managers/superusers only
  const salaryRecords = app.findCollectionByNameOrId("salary_records")
  unmarshal({
    "listRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "viewRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "createRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "updateRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "deleteRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  }, salaryRecords)
  app.save(salaryRecords)

  // C4: qualifications - sensitive, managers/superusers only
  const qualifications = app.findCollectionByNameOrId("qualifications")
  unmarshal({
    "listRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "viewRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "createRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "updateRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"',
    "deleteRule": '@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"'
  }, qualifications)
  app.save(qualifications)

  // C5: kpi_scores - server computes, close client write + add max_converted_score
  const kpiScores = app.findCollectionByNameOrId("kpi_scores")
  const kpiNames = kpiScores.fields.fieldNames()
  if (!kpiNames.includes("max_converted_score")) {
    kpiScores.fields.add(new Field({
      "hidden": false,
      "id": "number_max_converted_score",
      "max": null,
      "min": null,
      "name": "max_converted_score",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    }))
  }
  unmarshal({
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, kpiScores)
  app.save(kpiScores)

  // C7: system_logs - read-only, close update
  const systemLogs = app.findCollectionByNameOrId("system_logs")
  unmarshal({
    "updateRule": null
  }, systemLogs)
  app.save(systemLogs)
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  unmarshal({ "createRule": "" }, users)
  app.save(users)

  const managerRule = ''
  const salaryRecords = app.findCollectionByNameOrId("salary_records")
  unmarshal({
    "listRule": managerRule, "viewRule": managerRule,
    "createRule": managerRule, "updateRule": managerRule, "deleteRule": managerRule
  }, salaryRecords)
  app.save(salaryRecords)

  const qualifications = app.findCollectionByNameOrId("qualifications")
  unmarshal({
    "listRule": managerRule, "viewRule": managerRule,
    "createRule": managerRule, "updateRule": managerRule, "deleteRule": managerRule
  }, qualifications)
  app.save(qualifications)

  const kpiScores = app.findCollectionByNameOrId("kpi_scores")
  unmarshal({ "createRule": "@request.auth.id != \"\"", "updateRule": "@request.auth.id != \"\"" }, kpiScores)
  app.save(kpiScores)

  const systemLogs = app.findCollectionByNameOrId("system_logs")
  unmarshal({ "updateRule": "@request.auth.id != \"\"" }, systemLogs)
  app.save(systemLogs)
})
