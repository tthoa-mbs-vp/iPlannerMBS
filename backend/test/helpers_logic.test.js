// Unit tests for the core business logic in backend/pb_hooks/helpers.js:
//   - recalcPlanProgress (weighted plan progress + status transitions)
//   - upsertKpi / the KPI formula (schedule lateness, rating, difficulty, ad-hoc base)
//   - recomputeLeaveBalance (approved days vs 12-day quota)
//   - isPrivateIp / ipInList (exact, "*", CIDR)
//
// Pattern: load the REAL helpers.js with mocked PocketBase globals ($app, Record),
// like guard_proxy.test.js does — fast, deterministic, no server needed.
//
// Run:  node backend/test/helpers_logic.test.js   (expect "ALL N TESTS PASSED")

"use strict"
const path = require("path")
const assert = require("assert")

// ---------------------------------------------------------------- PB mocks
function MockRecord(name, data) {
  // PB passes a collection OBJECT to `new Record(coll)` — normalize to its name.
  this._name = typeof name === "string" ? name : (name && name.name ? name.name : String(name))
  this._data = data || {}
}
MockRecord.prototype.collection = function () { return { name: this._name }; }
MockRecord.prototype.get = function (k) { return this._data[k]; }
MockRecord.prototype.getString = function (k) { const v = this._data[k]; return v === null || v === undefined ? "" : String(v); }
MockRecord.prototype.getBool = function (k) { return !!this._data[k]; }
MockRecord.prototype.getFloat = function (k) { const v = this._data[k]; return typeof v === "number" ? v : (parseFloat(v) || 0); }
MockRecord.prototype.set = function (k, v) { this._data[k] = v; }

const state = {
  tasks: [],         // all tasks in the collection (filtered by is_deleted in the mock)
  plan: null,
  kpi: [],           // existing kpi_scores for the task under test
  approvedLeave: [], // approved leave_requests for recomputeLeaveBalance
  balance: null,
  saved: [],
  deleted: [],
}

global.Record = MockRecord
global.$app = {
  findCollectionByNameOrId: (n) => ({ name: n }),
  findRecordsByFilter: (coll, filter) => {
    const f = String(filter)
    if (f.indexOf("is_deleted=false") !== -1) return state.tasks.filter((t) => !t.getBool("is_deleted"))
    if (f.indexOf('status="approved"') !== -1) return state.approvedLeave
    if (f.indexOf("year=") !== -1) return state.balance ? [state.balance] : []
    if (f.indexOf("task_id=") !== -1) return state.kpi
    return []
  },
  findRecordById: (coll, id) => {
    // Some helpers pass the collection object (findCollectionByNameOrId result),
    // others pass the name string — accept both.
    const cname = typeof coll === "string" ? coll : (coll && coll.name)
    if (cname === "plans") return state.plan
    return null
  },
  save: (rec) => state.saved.push(rec),
  delete: (rec) => state.deleted.push(rec),
}

const H = require(path.join(__dirname, "..", "pb_hooks", "helpers.js"))

// ------------------------------------------------------------------ helpers
function reset() {
  state.tasks = []
  state.plan = null
  state.kpi = []
  state.approvedLeave = []
  state.balance = null
  state.saved = []
  state.deleted = []
}
function planRec(overrides) {
  return new MockRecord("plans", Object.assign({ id: "plan1", status: "not_started", progress: 0 }, overrides))
}
function taskRec(overrides) {
  return new MockRecord("tasks", Object.assign({
    id: "t1", plan_id: "plan1", status: "not_started", weight: 100, is_deleted: false,
  }, overrides))
}
function kpiRec(overrides) {
  return new MockRecord("kpi_scores", Object.assign({ id: "k1", task_id: "t1", final_score: 0 }, overrides))
}
const DAY = 24 * 60 * 60 * 1000
const iso = (d) => new Date(d).toISOString()

let passed = 0
function ok(name) { passed++; console.log("  ✓ " + name) }

// =============================================================== recalcPlanProgress
console.log("recalcPlanProgress:")
{
  reset()
  state.plan = planRec()
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, 0, "no tasks -> progress 0")
  assert.strictEqual(state.plan._data.status, "not_started", "status untouched when no tasks")
  assert.strictEqual(state.saved.length, 1, "plan saved once")
  ok("no tasks -> progress 0")

  reset()
  state.plan = planRec()
  state.tasks = [taskRec({ status: "completed" }), taskRec({ id: "t2", status: "completed" })]
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, 100, "all completed -> 100")
  assert.strictEqual(state.plan._data.status, "completed", "all completed -> plan completed")
  ok("all tasks completed -> progress 100, plan completed")

  reset()
  state.plan = planRec()
  state.tasks = [taskRec({ status: "completed", weight: 70 }), taskRec({ id: "t2", status: "in_progress", weight: 30 })]
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, 85, "(70*100 + 30*50)/100 = 85")
  assert.strictEqual(state.plan._data.status, "in_progress", "started but not all done -> in_progress")
  ok("weighted mix -> 85, plan in_progress")

  reset()
  state.plan = planRec()
  state.tasks = [
    taskRec({ status: "pending_approval", weight: 50 }),
    taskRec({ id: "t2", status: "completed", weight: 50 }),
  ]
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, Math.round((50 * 75 + 50 * 100) / 100), "pending_approval counts 75")
  ok("pending_approval maps to 75")

  reset()
  state.plan = planRec()
  state.tasks = [taskRec({ status: "completed" }), taskRec({ id: "t2", status: "in_progress", is_deleted: true })]
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, 100, "soft-deleted task excluded from calculation")
  ok("soft-deleted tasks are excluded")

  reset()
  state.plan = planRec()
  state.tasks = [taskRec({ status: "in_progress", weight: 0 })]
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, 0, "zero total weight -> 0 (no division blow-up)")
  ok("zero weight -> progress 0")

  reset()
  state.plan = planRec({ status: "cancelled" })
  state.tasks = [taskRec({ status: "completed" })]
  H.recalcPlanProgress("plan1")
  assert.strictEqual(state.plan._data.progress, 100, "progress still recomputed for cancelled plans")
  assert.strictEqual(state.plan._data.status, "cancelled", "cancelled plan never flips back to completed")
  ok("cancelled plan keeps its status")

  reset()
  state.plan = planRec()
  H.recalcPlanProgress("")
  assert.strictEqual(state.saved.length, 0, "empty plan id -> no-op")
  ok("empty plan id -> no-op")
}

// =================================================================== upsertKpi
console.log("upsertKpi (KPI formula):")
{
  reset()
  const existing = kpiRec()
  state.kpi = [existing]
  const task = taskRec({ status: "in_progress" })
  H.upsertKpi(task)
  assert.strictEqual(state.deleted.length, 1, "stale score deleted when task leaves completed")
  assert.strictEqual(state.deleted[0], existing, "the existing score is removed")
  assert.strictEqual(state.saved.length, 0, "no new score created")
  ok("task not completed -> stale kpi_scores removed")

  reset()
  const onTime = taskRec({
    status: "completed",
    category: "normal",
    completed_at: iso(Date.UTC(2026, 5, 30)),
    deadline: iso(Date.UTC(2026, 5, 30)),
    rating: 5,
  })
  H.upsertKpi(onTime)
  const rec = state.saved[0]
  assert(rec, "kpi score saved")
  assert.strictEqual(rec._data.base_score, 10, "base 10 for normal tasks")
  assert.strictEqual(rec._data.difficulty_coeff, 1.0, "difficulty 1.0")
  assert.strictEqual(rec._data.progress_score, 100, "on-time -> schedule 100%")
  assert.strictEqual(rec._data.result_rating, 5, "rating preserved")
  assert.strictEqual(rec._data.final_score, 10, "on-time rating-5 -> 10.0")
  assert.strictEqual(rec._data.max_converted_score, 10, "max 10")
  ok("completed on-time, rating 5 -> final 10.0")

  reset()
  const late2 = taskRec({
    status: "completed",
    completed_at: iso(Date.UTC(2026, 6, 2)), // 2 days late
    deadline: iso(Date.UTC(2026, 5, 30)),
    rating: 4,
  })
  H.upsertKpi(late2)
  const r2 = state.saved[0]
  assert.strictEqual(r2._data.progress_score, 80, "2 days late -> schedule 80%")
  assert.strictEqual(r2._data.final_score, 8.0, "10*(0.3*0.8 + 0.7*0.8) = 8.0")
  ok("2 days late, rating 4 -> 8.0")

  reset()
  const late6 = taskRec({
    status: "completed",
    completed_at: iso(Date.UTC(2026, 6, 6)), // 6 days late (Jul 6 - Jun 30)
    deadline: iso(Date.UTC(2026, 5, 30)),
    rating: 4,
  })
  H.upsertKpi(late6)
  const r3 = state.saved[0]
  assert.strictEqual(r3._data.progress_score, 0, ">5 days late -> schedule 0%")
  assert.strictEqual(r3._data.final_score, 5.6, "10*0.7*0.8 = 5.6")
  ok("6 days late -> schedule 0, final 5.6")

  reset()
  const important = taskRec({
    status: "completed",
    is_high_impact: true,
    completed_at: iso(Date.UTC(2026, 5, 30)),
    deadline: iso(Date.UTC(2026, 5, 30)),
    rating: 5,
  })
  H.upsertKpi(important)
  const r4 = state.saved[0]
  assert.strictEqual(r4._data.difficulty_coeff, 1.2, "high-impact -> difficulty 1.2")
  assert.strictEqual(r4._data.final_score, 12, "10 * 1.2 = 12")
  assert.strictEqual(r4._data.max_converted_score, 12, "max 12")
  ok("high-impact -> difficulty 1.2, final 12")

  reset()
  const sudden = taskRec({
    status: "completed",
    category: "sudden",
    completed_at: iso(Date.UTC(2026, 5, 30)),
    deadline: iso(Date.UTC(2026, 5, 30)),
    rating: 5,
  })
  H.upsertKpi(sudden)
  const r5 = state.saved[0]
  assert.strictEqual(r5._data.base_score, 12, "sudden -> base 12")
  assert.strictEqual(r5._data.final_score, 12, "sudden on-time rating-5 -> 12")
  ok("sudden task -> base 12")

  reset()
  const partner = taskRec({
    status: "completed",
    coordinating_dept_id: "deptX",
    completed_at: iso(Date.UTC(2026, 5, 30)),
    deadline: iso(Date.UTC(2026, 5, 30)),
    rating: 5,
  })
  H.upsertKpi(partner)
  const r6 = state.saved[0]
  assert.strictEqual(r6._data.difficulty_coeff, 1.1, "partner department -> difficulty 1.1")
  assert.strictEqual(r6._data.final_score, 11, "10 * 1.1 = 11")
  ok("partner department -> difficulty 1.1")

  reset()
  const noStamp = taskRec({ status: "completed", deadline: "", completed_at: "" })
  H.upsertKpi(noStamp)
  const r7 = state.saved[0]
  assert.strictEqual(r7._data.progress_score, 100, "missing deadline/stamp -> treated as on-time")
  ok("no completion stamp/deadline -> schedule 100")

  reset()
  const existingRec = kpiRec({ final_score: 1 })
  state.kpi = [existingRec]
  H.upsertKpi(taskRec({ status: "completed", completed_at: iso(Date.UTC(2026, 5, 30)), deadline: iso(Date.UTC(2026, 5, 30)), rating: 5 }))
  assert.strictEqual(state.kpi.length, 1, "no duplicate kpi rows")
  assert.strictEqual(state.saved.length, 1, "existing record updated in place")
  assert.strictEqual(state.saved[0], existingRec, "same record reused")
  assert.strictEqual(existingRec._data.final_score, 10, "existing record re-scored")
  ok("existing kpi row is updated in place (no duplicates)")

  reset()
  H.upsertKpi(null)
  assert.strictEqual(state.saved.length, 0, "null task -> no-op")
  ok("null task -> no-op")
}

// ========================================================= recomputeLeaveBalance
console.log("recomputeLeaveBalance:")
{
  reset()
  state.balance = new MockRecord("leave_balances", { id: "b1", user_id: "u1", year: 2026, total_days: 12, used_days: 0, remaining_days: 12 })
  state.approvedLeave = [
    new MockRecord("leave_requests", { total_days: 2 }),
    new MockRecord("leave_requests", { total_days: 3 }),
  ]
  H.recomputeLeaveBalance("u1", 2026)
  assert.strictEqual(state.balance._data.used_days, 5, "used days summed from approved requests")
  assert.strictEqual(state.balance._data.remaining_days, 7, "12 - 5 = 7")
  assert.strictEqual(state.saved.length, 1, "existing balance saved")
  ok("existing balance updated from approved requests")

  reset()
  state.approvedLeave = [new MockRecord("leave_requests", { total_days: 4 })]
  H.recomputeLeaveBalance("u1", 2026)
  const created = state.saved[0]
  assert.strictEqual(created._name, "leave_balances", "new balance record created")
  assert.strictEqual(created._data.total_days, 12, "default quota 12")
  assert.strictEqual(created._data.used_days, 4, "used days")
  assert.strictEqual(created._data.remaining_days, 8, "remaining")
  ok("missing balance -> new record created with 12-day quota")

  reset()
  H.recomputeLeaveBalance("", 2026)
  assert.strictEqual(state.saved.length, 0, "no user id -> no-op")
  ok("empty user id -> no-op")
}

// ============================================================ jsonArr (json field decode)
console.log("jsonArr (PB 0.39 json-type field bytes):")
{
  assert.deepStrictEqual(H.jsonArr(null), [], "null -> []")
  assert.deepStrictEqual(H.jsonArr(undefined), [], "undefined -> []")
  assert.deepStrictEqual(H.jsonArr([]), [], "empty parsed array kept")
  assert.deepStrictEqual(H.jsonArr(["192.168.1.0/24"]), ["192.168.1.0/24"], "parsed string array kept")
  assert.deepStrictEqual(H.jsonArr('["10.0.0.0/8"]'), ["10.0.0.0/8"], "raw JSON string parsed")
  // PB 0.39: record.get() on a json field returns the raw []byte of the JSON text
  const bytesOf = (s) => Array.from(s, (ch) => ch.charCodeAt(0))
  assert.deepStrictEqual(H.jsonArr(bytesOf("[]")), [], "empty json bytes -> []")
  assert.deepStrictEqual(H.jsonArr(bytesOf('["192.168.1.0/24"]')), ["192.168.1.0/24"], "json bytes decoded")
  assert.deepStrictEqual(H.jsonArr(bytesOf("null")), [], "'null' json bytes -> []")
  assert.deepStrictEqual(H.jsonArr("not-json"), [], "invalid json string -> []")
  assert.deepStrictEqual(H.jsonArr(5), [5], "scalar wrapped")
  ok("jsonArr decodes PB byte arrays, raw strings, and parsed arrays")
}

// ============================================================ network helpers
console.log("isPrivateIp / ipInList:")
{
  assert.strictEqual(H.isPrivateIp("10.0.0.1"), true, "10/8")
  assert.strictEqual(H.isPrivateIp("172.16.0.1"), true, "172.16/12 start")
  assert.strictEqual(H.isPrivateIp("172.31.255.255"), true, "172.16/12 end")
  assert.strictEqual(H.isPrivateIp("172.32.0.1"), false, "outside 172.16/12")
  assert.strictEqual(H.isPrivateIp("192.168.1.1"), true, "192.168/16")
  assert.strictEqual(H.isPrivateIp("127.0.0.1"), true, "loopback")
  assert.strictEqual(H.isPrivateIp("8.8.8.8"), false, "public")
  assert.strictEqual(H.isPrivateIp("::1"), true, "IPv6 loopback")
  assert.strictEqual(H.isPrivateIp(""), false, "empty")
  ok("isPrivateIp ranges")

  assert.strictEqual(H.ipInList("192.168.1.100", ["192.168.1.100"]), true, "exact match")
  assert.strictEqual(H.ipInList("192.168.1.101", ["192.168.1.100"]), false, "exact mismatch")
  assert.strictEqual(H.ipInList("10.0.0.5", ["*"]), true, "wildcard")
  assert.strictEqual(H.ipInList("192.168.1.100", ["192.168.1.0/24"]), true, "CIDR in range")
  assert.strictEqual(H.ipInList("192.168.2.1", ["192.168.1.0/24"]), false, "CIDR out of range")
  assert.strictEqual(H.ipInList("192.168.1.100", ["10.0.0.0/8", "192.168.1.0/24"]), true, "multiple entries")
  assert.strictEqual(H.ipInList("1.2.3.4", []), false, "empty list")
  assert.strictEqual(H.ipInList("bad-ip", ["*"]), true, "wildcard still matches any input")
  ok("ipInList exact / wildcard / CIDR")
}

console.log(`\nALL ${passed} TESTS PASSED`)
