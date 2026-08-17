// Unit tests for the field-level guards in backend/pb_hooks/guards.pb.js:
//   - tasks   : H1 create strip, status transitions (executor/supervisor), M8
//               completed_at stamping, A10 self-rating ban, soft-delete permission
//   - users   : self-service edits to privilege-bearing fields are blocked
//   - leave   : no self-approval, approver may only approve/reject
//   - proposals: requester withdraw only, supervisor approve/reject only
//   - chat    : author may only edit content/files; channel write permission on create
//   - attendance: owner only check_out; create binds user + server status + IP
//   - announcements: author_id bound to the session actor
//   - H3      : disabled accounts lose create/update/delete access
//
// Pattern: load the REAL guards.pb.js + helpers.js with mocked PB globals and a
// registration-order shim (guard handler first, audit handler second — a throwing
// guard handler stops later ones, exactly like PB 0.39). No server needed.
//
// Run:  node backend/test/guards_logic.test.js   (expect "ALL N TESTS PASSED")

"use strict"
const path = require("path")
const assert = require("assert")

// ---------------------------------------------------------------- PB mocks
function MockRecord(name, data) {
  this._name = typeof name === "string" ? name : (name && name.name ? name.name : String(name))
  this._data = data || {}
  this._super = false
}
MockRecord.prototype.collection = function () { return { name: this._name }; }
MockRecord.prototype.get = function (k) { return this._data[k]; }
MockRecord.prototype.getString = function (k) { const v = this._data[k]; return v === null || v === undefined ? "" : String(v); }
MockRecord.prototype.getBool = function (k) { return !!this._data[k]; }
MockRecord.prototype.getFloat = function (k) { const v = this._data[k]; return typeof v === "number" ? v : (parseFloat(v) || 0); }
MockRecord.prototype.set = function (k, v) { this._data[k] = v; }
MockRecord.prototype.isSuperuser = function () { return this._super; }
Object.defineProperty(MockRecord.prototype, "id", {
  get: function () { return this._data.id; },
  set: function (v) { this._data.id = v; },
})

const state = {
  role: null,
  taskOriginal: null,
  taskForProposal: null,
  leaveOriginal: null,
  proposalOriginal: null,
  chatOriginal: null,
  userOriginal: null,
  attOriginal: null,
  cfg: null,
  dup: false,
  saved: [],
}

global.Record = MockRecord
global.$app = {
  findCollectionByNameOrId: (n) => ({ name: n }),
  findRecordById: (coll, id) => {
    const cname = typeof coll === "string" ? coll : (coll && coll.name)
    if (cname === "roles") return state.role
    if (cname === "tasks") return state.taskOriginal || state.taskForProposal
    if (cname === "leave_requests") return state.leaveOriginal
    if (cname === "proposals") return state.proposalOriginal
    if (cname === "chat_messages") return state.chatOriginal
    if (cname === "users") return state.userOriginal
    if (cname === "attendance_logs") return state.attOriginal
    return null
  },
  findRecordsByFilter: (coll, filter) => {
    const f = String(filter)
    if (f.indexOf("is_active=true") !== -1) return state.cfg ? [state.cfg] : []
    if (f.indexOf("check_in >=") !== -1) return state.dup ? [new MockRecord("attendance_logs", { id: "existing" })] : []
    return []
  },
  save: (rec) => state.saved.push(rec),
  delete: () => {},
}

class ForbiddenError extends Error {}
class BadRequestError extends Error {}
global.ForbiddenError = ForbiddenError
global.BadRequestError = BadRequestError

// Registration-order shim (guards.pb.js registers guard handler THEN audit handler).
let createHandlers = []
let updateHandlers = []
let deleteHandlers = []
global.__hooks = path.join(__dirname, "..", "pb_hooks")
global.onRecordCreateRequest = (fn) => { createHandlers.push(fn) }
global.onRecordUpdateRequest = (fn) => { updateHandlers.push(fn) }
global.onRecordDeleteRequest = (fn) => { deleteHandlers.push(fn) }
function runHandlers(list, e) { for (const fn of list) fn(e) }
const createHandler = (e) => runHandlers(createHandlers, e)
const updateHandler = (e) => runHandlers(updateHandlers, e)
const deleteHandler = (e) => runHandlers(deleteHandlers, e)

require(path.join(__dirname, "..", "pb_hooks", "helpers.js"))
require(path.join(__dirname, "..", "pb_hooks", "guards.pb.js"))

// ------------------------------------------------------------------ factories
function role(overrides) {
  return new MockRecord("roles", Object.assign({
    can_manage: false, can_edit_tasks: false, can_delete_tasks: false,
    can_approve_leave: false, can_view_salary: false, level: "employee", approval_scope: "",
  }, overrides))
}
function actor(overrides) {
  return new MockRecord("users", Object.assign({
    id: "user1", role_id: "role1", disabled: false, department_id: "deptA", group_ids: ["gA"],
  }, overrides))
}
function evt(rec, opts) {
  opts = opts || {}
  const actorRec = opts.actor || actor()
  return {
    collection: rec ? { name: rec._name } : { name: "" },
    record: rec,
    next: () => {},
    realIP: opts.realIP || (() => "192.168.1.100"),
    remoteIP: () => "127.0.0.1",
    requestInfo: () => ({ auth: actorRec, hasSuperuserAuth: () => !!opts.super }),
  }
}
function taskRec(overrides) {
  return new MockRecord("tasks", Object.assign({
    id: "task1", name: "Task Alpha", executor_id: "user1", supervisor_id: "user2",
    status: "not_started", is_deleted: false, completed_at: "", rating: 0, rated_by_id: "",
  }, overrides))
}
function cfgRec(overrides) {
  return new MockRecord("attendance_configs", Object.assign({
    office_name: "VP", work_start_time: "23:59", late_tolerance_minutes: 0,
  }, overrides))
}

function reset() {
  state.role = role()
  state.taskOriginal = null
  state.taskForProposal = null
  state.leaveOriginal = null
  state.proposalOriginal = null
  state.chatOriginal = null
  state.userOriginal = null
  state.attOriginal = null
  state.cfg = null
  state.dup = false
  state.saved = []
}

function expectForbidden(fn, part) {
  let threw = null
  try { fn() } catch (e) { threw = e }
  assert(threw instanceof ForbiddenError, "expected ForbiddenError, got " + (threw && threw.message))
  if (part) assert(String(threw.message).indexOf(part) !== -1, "message missing '" + part + "': " + threw.message)
}
function expectBadRequest(fn, part) {
  let threw = null
  try { fn() } catch (e) { threw = e }
  assert(threw instanceof BadRequestError, "expected BadRequestError, got " + (threw && threw.message))
  if (part) assert(String(threw.message).indexOf(part) !== -1, "message missing '" + part + "': " + threw.message)
}

let passed = 0
function ok(name) { passed++; console.log("  ✓ " + name) }

// ================================================================= tasks create (H1)
console.log("tasks create guard (H1):")
{
  reset()
  const rec = taskRec({ status: "completed", rating: 5, rated_by_id: "user9", rated_at: "2000-01-01", completed_at: "2000-01-01", is_deleted: true })
  createHandler(evt(rec)) // employee role (defaults)
  assert.strictEqual(rec._data.status, "not_started", "status forced to not_started")
  assert.strictEqual(rec._data.is_deleted, false, "is_deleted forced false")
  assert.strictEqual(rec._data.rating, null, "rating stripped")
  assert.strictEqual(rec._data.rated_by_id, "", "rated_by_id stripped")
  assert.strictEqual(rec._data.completed_at, null, "completed_at stripped")
  assert.strictEqual(rec._data.rated_at, null, "rated_at stripped")
  ok("non-manager cannot create completed/rated/deleted tasks")

  reset()
  const rec2 = taskRec({ status: "completed", rating: 5, is_deleted: true, completed_at: "2000-01-01T00:00:00.000Z" })
  state.role = role({ can_manage: true })
  createHandler(evt(rec2))
  assert.strictEqual(rec2._data.status, "completed", "can_manage keeps full control")
  assert.strictEqual(rec2._data.rating, 5, "can_manage keeps rating")
  assert.ok(rec2._data.completed_at, "M8: create with status=completed stamped by the server")
  assert.ok(rec2._data.completed_at !== "2000-01-01T00:00:00.000Z", "M8: can_manage cannot backdate completed_at via create")
  ok("can_manage bypasses the create strip but completed_at is still server-stamped (M8)")
}

// ============================================================ tasks update guard
console.log("tasks update guard:")
{
  // executor: only status transitions
  reset()
  state.taskOriginal = taskRec()
  const rec = taskRec({ name: "Renamed" })
  expectForbidden(() => updateHandler(evt(rec)), "Bạn chỉ được cập nhật trạng thái nhiệm vụ của mình")
  ok("executor cannot edit task fields (name)")

  reset()
  state.taskOriginal = taskRec()
  const recOk = taskRec({ status: "in_progress" })
  updateHandler(evt(recOk))
  assert.strictEqual(recOk._data.status, "in_progress", "executor may take the task")
  ok("executor status transition (in_progress) allowed")

  reset()
  state.taskOriginal = taskRec()
  const recDone = taskRec({ status: "completed" })
  // NOTE: M8 stamps completed_at on the transition BEFORE the field check runs, so the
  // executor's illegal jump to completed is rejected by the changed-fields check (the
  // server-added completed_at counts as a disallowed field change). Rejection is what
  // matters; the message is the generic executor one.
  expectForbidden(() => updateHandler(evt(recDone)), "Bạn chỉ được cập nhật trạng thái nhiệm vụ của mình")
  ok("executor cannot jump straight to completed")

  // supervisor: approve + M8 server stamp
  reset()
  state.taskOriginal = taskRec()
  const recSup = taskRec({ status: "completed" })
  updateHandler(evt(recSup, { actor: actor({ id: "user2" }) }))
  assert.ok(recSup._data.completed_at, "M8: completed_at stamped by the server")
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(recSup._data.completed_at), "completed_at is an ISO timestamp")
  ok("supervisor completing a task -> server stamps completed_at (M8)")

  reset()
  state.taskOriginal = taskRec({ status: "completed", completed_at: "2026-01-01T00:00:00.000Z" })
  const recRew = taskRec({ status: "completed", completed_at: "2000-01-01T00:00:00.000Z" })
  updateHandler(evt(recRew, { actor: actor({ id: "user2" }) }))
  assert.strictEqual(recRew._data.completed_at, "2026-01-01T00:00:00.000Z", "M8: completed_at of a completed task is immutable")
  ok("completed_at of a completed task cannot be rewritten (M8)")

  reset()
  state.taskOriginal = taskRec({ status: "completed", completed_at: "2026-01-01T00:00:00.000Z" })
  const recUn = taskRec({ status: "in_progress", completed_at: "2026-01-01T00:00:00.000Z" })
  updateHandler(evt(recUn, { actor: actor({ id: "user2" }) }))
  assert.strictEqual(recUn._data.completed_at, "", "M8: leaving completed clears the stamp")
  ok("un-completing a task clears completed_at (M8)")

  // M8 applies to can_manage too — the bypass must not become a backdating loophole
  reset()
  state.role = role({ can_manage: true })
  state.taskOriginal = taskRec({ status: "in_progress" })
  const recMgr2 = taskRec({ status: "completed", completed_at: "2000-01-01T00:00:00.000Z" })
  updateHandler(evt(recMgr2, { actor: actor({ id: "user9" }) }))
  assert.ok(recMgr2._data.completed_at, "M8: can_manage transition stamped by the server")
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(recMgr2._data.completed_at), "M8: backdated completed_at from can_manage overwritten")
  assert.ok(recMgr2._data.completed_at !== "2000-01-01T00:00:00.000Z", "M8: client-supplied backdate rejected")
  ok("can_manage completing a task -> server stamps completed_at (M8)")

  reset()
  state.role = role({ can_manage: true })
  state.taskOriginal = taskRec({ status: "completed", completed_at: "2026-01-01T00:00:00.000Z" })
  const recMgrRew2 = taskRec({ status: "completed", completed_at: "2000-01-01T00:00:00.000Z" })
  updateHandler(evt(recMgrRew2, { actor: actor({ id: "user9" }) }))
  assert.strictEqual(recMgrRew2._data.completed_at, "2026-01-01T00:00:00.000Z", "M8: completed_at immutable even for can_manage")
  ok("can_manage cannot rewrite the stamp of a completed task (M8)")

  reset()
  state.role = role({ can_manage: true })
  state.taskOriginal = taskRec({ status: "completed", completed_at: "2026-01-01T00:00:00.000Z" })
  const recMgrUn2 = taskRec({ status: "cancelled", completed_at: "2026-01-01T00:00:00.000Z" })
  updateHandler(evt(recMgrUn2, { actor: actor({ id: "user9" }) }))
  assert.strictEqual(recMgrUn2._data.completed_at, "", "M8: can_manage leaving completed clears the stamp")
  ok("can_manage un-completing a task clears completed_at (M8)")

  // A10: no self-rating — even with can_edit_tasks
  reset()
  state.taskOriginal = taskRec()
  const recRate = taskRec({ rating: 5, rated_by_id: "user1", rated_at: "2026-01-01T00:00:00.000Z" })
  state.role = role({ can_edit_tasks: true })
  expectForbidden(() => updateHandler(evt(recRate)), "Bạn không thể tự đánh giá nhiệm vụ của mình")
  ok("A10: executor cannot self-rate, even with can_edit_tasks")

  // soft-delete permission
  reset()
  state.taskOriginal = taskRec()
  state.role = role({ can_edit_tasks: true })
  const recDel = taskRec({ is_deleted: true })
  expectForbidden(() => updateHandler(evt(recDel)), "Bạn không có quyền xóa nhiệm vụ")
  ok("soft-delete still requires can_delete_tasks")

  reset()
  state.taskOriginal = taskRec()
  state.role = role({ can_edit_tasks: true, can_delete_tasks: true })
  const recDelOk = taskRec({ is_deleted: true })
  updateHandler(evt(recDelOk))
  assert.strictEqual(recDelOk._data.is_deleted, true, "soft delete allowed with permission")
  ok("soft-delete allowed with can_delete_tasks")

  // can_edit_tasks users may edit fields
  reset()
  state.taskOriginal = taskRec()
  state.role = role({ can_edit_tasks: true })
  const recEdit = taskRec({ name: "Renamed", deadline: "2027-01-01 00:00:00.000Z" })
  updateHandler(evt(recEdit))
  assert.strictEqual(recEdit._data.name, "Renamed", "can_edit_tasks user may edit fields")
  ok("can_edit_tasks user may edit fields freely")

  // can_manage edits other fields freely, but the M8 stamp is still server-authoritative
  reset()
  state.taskOriginal = taskRec({ status: "in_progress" })
  state.role = role({ can_manage: true })
  const recMgr = taskRec({ status: "completed", completed_at: "1999-01-01T00:00:00.000Z", name: "Renamed by mgr" })
  updateHandler(evt(recMgr))
  assert.strictEqual(recMgr._data.name, "Renamed by mgr", "can_manage edits other fields freely")
  assert.ok(recMgr._data.completed_at, "M8: can_manage transition still server-stamped")
  assert.ok(recMgr._data.completed_at !== "1999-01-01T00:00:00.000Z", "M8: backdated stamp rejected even for can_manage")
  ok("can_manage bypasses guards but completed_at is still server-stamped (M8)")
}

// ==================================================================== users guard
console.log("users update guard (self-service privilege edits):")
{
  reset()
  state.userOriginal = new MockRecord("users", { id: "user1", role_id: "role1", verified: false, disabled: false, group_ids: [], department_id: "deptA", email: "a@b.c", name: "A" })
  const rec = new MockRecord("users", { id: "user1", role_id: "role2", verified: false, disabled: false, group_ids: [], department_id: "deptA", email: "a@b.c", name: "A" })
  expectForbidden(() => updateHandler(evt(rec)), "Bạn không có quyền thay đổi thông tin phân quyền của mình")
  ok("user cannot change own role_id")

  reset()
  state.userOriginal = new MockRecord("users", { id: "user1", role_id: "role1", verified: false, disabled: false, group_ids: [], department_id: "deptA", email: "a@b.c", name: "A" })
  const rec2 = new MockRecord("users", { id: "user1", role_id: "role1", verified: false, disabled: false, group_ids: [], department_id: "deptA", email: "a@b.c", name: "B" })
  updateHandler(evt(rec2))
  assert.strictEqual(rec2._data.name, "B", "name edit allowed")
  ok("user may edit own harmless fields (name)")

  reset()
  state.userOriginal = new MockRecord("users", { id: "user1", role_id: "role1", verified: false, disabled: false, group_ids: [], department_id: "deptA", email: "a@b.c", name: "A" })
  state.role = role({ can_manage: true })
  const rec3 = new MockRecord("users", { id: "user1", role_id: "role2", verified: false, disabled: false, group_ids: [], department_id: "deptA", email: "a@b.c", name: "A" })
  updateHandler(evt(rec3))
  assert.strictEqual(rec3._data.role_id, "role2", "can_manage may change role_id")
  ok("can_manage may change own role_id")
}

// ================================================================ leave guard
console.log("leave_requests update guard:")
{
  const baseLeave = { id: "l1", user_id: "user1", approver_id: "", status: "pending", start_date: "2026-01-01 00:00:00.000Z", end_date: "2026-01-02 00:00:00.000Z", total_days: 1, reason: "x", leave_type: "annual", period: "full", rejection_reason: "" }

  reset()
  state.leaveOriginal = new MockRecord("leave_requests", baseLeave)
  const rec = new MockRecord("leave_requests", Object.assign({}, baseLeave, { status: "approved" }))
  expectForbidden(() => updateHandler(evt(rec)), "Không thể tự phê duyệt đơn nghỉ của mình")
  ok("owner cannot self-approve")

  reset()
  state.leaveOriginal = new MockRecord("leave_requests", baseLeave)
  const rec2 = new MockRecord("leave_requests", Object.assign({}, baseLeave, { user_id: "user2" }))
  expectForbidden(() => updateHandler(evt(rec2)), "Không thể thay đổi người nghỉ phép")
  ok("owner cannot change the leave user_id")

  reset()
  state.leaveOriginal = new MockRecord("leave_requests", baseLeave)
  const rec3 = new MockRecord("leave_requests", Object.assign({}, baseLeave, { approver_id: "user9" }))
  expectForbidden(() => updateHandler(evt(rec3)), "Không thể thay đổi người duyệt")
  ok("owner cannot set the approver")

  reset()
  state.leaveOriginal = new MockRecord("leave_requests", baseLeave)
  const rec4 = new MockRecord("leave_requests", Object.assign({}, baseLeave, { reason: "new reason" }))
  updateHandler(evt(rec4))
  assert.strictEqual(rec4._data.reason, "new reason", "owner may edit own request content")
  ok("owner may edit own request content (reason)")

  reset()
  state.leaveOriginal = new MockRecord("leave_requests", baseLeave)
  state.role = role({ can_approve_leave: true })
  const rec5 = new MockRecord("leave_requests", Object.assign({}, baseLeave, { status: "approved", approver_id: "user3" }))
  updateHandler(evt(rec5, { actor: actor({ id: "user3" }) }))
  assert.strictEqual(rec5._data.status, "approved", "approver may approve")
  ok("approver (non-owner) may approve/reject")

  reset()
  state.leaveOriginal = new MockRecord("leave_requests", baseLeave)
  state.role = role({ can_approve_leave: true })
  const rec6 = new MockRecord("leave_requests", Object.assign({}, baseLeave, { start_date: "2027-01-01 00:00:00.000Z" }))
  expectForbidden(() => updateHandler(evt(rec6, { actor: actor({ id: "user3" }) })), "Bạn chỉ được phê duyệt/từ chối đơn nghỉ")
  ok("approver cannot rewrite request content")
}

// =============================================================== proposals guard
console.log("proposals update guard:")
{
  const baseProp = { id: "p1", task_id: "task1", requester_id: "user1", status: "pending", reason: "x" }

  reset()
  state.proposalOriginal = new MockRecord("proposals", baseProp)
  state.taskForProposal = taskRec({ id: "task1", supervisor_id: "user2" })
  const rec = new MockRecord("proposals", Object.assign({}, baseProp, { status: "withdrawn" }))
  updateHandler(evt(rec))
  assert.strictEqual(rec._data.status, "withdrawn", "requester may withdraw")
  ok("requester may withdraw own pending proposal")

  reset()
  state.proposalOriginal = new MockRecord("proposals", baseProp)
  state.taskForProposal = taskRec({ id: "task1", supervisor_id: "user2" })
  const rec2 = new MockRecord("proposals", Object.assign({}, baseProp, { status: "approved" }))
  expectForbidden(() => updateHandler(evt(rec2)), "Chỉ người giám sát nhiệm vụ mới được duyệt/từ chối đề xuất")
  ok("requester cannot self-approve")

  reset()
  state.proposalOriginal = new MockRecord("proposals", baseProp)
  state.taskForProposal = taskRec({ id: "task1", supervisor_id: "user2" })
  const rec3 = new MockRecord("proposals", Object.assign({}, baseProp, { status: "approved" }))
  updateHandler(evt(rec3, { actor: actor({ id: "user2" }) }))
  assert.strictEqual(rec3._data.status, "approved", "task supervisor may approve")
  ok("task supervisor may approve")

  reset()
  state.proposalOriginal = new MockRecord("proposals", Object.assign({}, baseProp, { status: "approved" }))
  state.taskForProposal = taskRec({ id: "task1", supervisor_id: "user2" })
  const rec4 = new MockRecord("proposals", Object.assign({}, baseProp, { status: "withdrawn" }))
  expectForbidden(() => updateHandler(evt(rec4)), "Không thể rút lại đề xuất đã được xử lý")
  ok("withdrawing an already-approved proposal is blocked")

  reset()
  state.proposalOriginal = new MockRecord("proposals", baseProp)
  state.taskForProposal = taskRec({ id: "task1", supervisor_id: "user2" })
  const rec5 = new MockRecord("proposals", Object.assign({}, baseProp, { reason: "updated" }))
  updateHandler(evt(rec5))
  assert.strictEqual(rec5._data.reason, "updated", "content edit with unchanged status allowed")
  ok("requester may edit content while status is unchanged")
}

// ================================================================ chat guard
console.log("chat_messages guard:")
{
  reset()
  state.chatOriginal = new MockRecord("chat_messages", { id: "c1", user_id: "user1", channel_type: "org", content: "hi", files: [] })
  const rec = new MockRecord("chat_messages", { id: "c1", user_id: "user1", channel_type: "org", content: "edited", files: [] })
  updateHandler(evt(rec))
  assert.strictEqual(rec._data.content, "edited", "author may edit content")
  ok("author may edit message content")

  reset()
  state.chatOriginal = new MockRecord("chat_messages", { id: "c1", user_id: "user1", channel_type: "org", content: "hi", files: [] })
  const rec2 = new MockRecord("chat_messages", { id: "c1", user_id: "user1", channel_type: "department", channel_dept_id: "deptX", content: "hi", files: [] })
  expectForbidden(() => updateHandler(evt(rec2)), "Bạn chỉ được sửa nội dung và file đính kèm của tin nhắn")
  ok("author cannot move a message to another channel")

  reset()
  const recOrg = new MockRecord("chat_messages", { channel_type: "org", content: "hello" })
  createHandler(evt(recOrg))
  assert.strictEqual(recOrg._data.user_id, "user1", "sender bound to session actor")
  ok("chat create binds user_id to the session actor (org channel)")

  reset()
  const recDeptBad = new MockRecord("chat_messages", { channel_type: "department", channel_dept_id: "deptX", content: "hi" })
  expectForbidden(() => createHandler(evt(recDeptBad)), "Bạn không có quyền gửi tin nhắn vào kênh phòng ban này")
  ok("cannot post to another department's channel")

  reset()
  const recGroupBad = new MockRecord("chat_messages", { channel_type: "group", channel_group_id: "gX", content: "hi" })
  expectForbidden(() => createHandler(evt(recGroupBad)), "Bạn không có quyền gửi tin nhắn vào kênh tổ chuyên môn này")
  ok("cannot post to a group the sender does not belong to")

  reset()
  const recGroupOk = new MockRecord("chat_messages", { channel_type: "group", channel_group_id: "gA", content: "hi" })
  createHandler(evt(recGroupOk))
  assert.strictEqual(recGroupOk._data.user_id, "user1", "group member may post")
  ok("group member may post to own group")
}

// ============================================================= attendance guard
console.log("attendance_logs guard:")
{
  reset()
  state.attOriginal = new MockRecord("attendance_logs", { id: "a1", user_id: "user1", check_in: "2026-08-10T08:05:00", check_out: "", status: "on_time", method: "wifi", ip_address: "" })
  const rec = new MockRecord("attendance_logs", { id: "a1", user_id: "user1", check_in: "2026-08-10T08:05:00", check_out: "2026-08-10T17:00:00", status: "on_time", method: "wifi", ip_address: "" })
  updateHandler(evt(rec))
  assert.ok(rec._data.check_out, "check_out set")
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(rec._data.check_out), "check_out server-stamped (M1)")
  ok("owner may check out — server stamps the time (M1)")

  reset()
  state.attOriginal = new MockRecord("attendance_logs", { id: "a1", user_id: "user1", check_in: "2026-08-10T08:05:00", check_out: "", status: "on_time", method: "wifi", ip_address: "" })
  const rec2 = new MockRecord("attendance_logs", { id: "a1", user_id: "user1", check_in: "2026-08-10T07:00:00", check_out: "", status: "on_time", method: "wifi", ip_address: "" })
  expectForbidden(() => updateHandler(evt(rec2)), "Bạn chỉ được chấm công ra (check_out)")
  ok("owner cannot rewrite check_in")

  reset()
  state.attOriginal = new MockRecord("attendance_logs", { id: "a1", user_id: "user1", check_in: "2026-08-10T08:05:00", check_out: "2026-08-10T17:00:00", status: "on_time", method: "wifi", ip_address: "" })
  const rec3 = new MockRecord("attendance_logs", { id: "a1", user_id: "user1", check_in: "2026-08-10T08:05:00", check_out: "2026-08-10T16:00:00", status: "on_time", method: "wifi", ip_address: "" })
  expectForbidden(() => updateHandler(evt(rec3)), "Không thể sửa giờ chấm công ra đã lưu")
  ok("recorded check_out cannot be rewritten")

  // create: user binding + duplicate rejection
  reset()
  state.dup = true
  const recDup = new MockRecord("attendance_logs", { user_id: "someone-else", check_in: "2026-08-10T08:00:00", status: "late", method: "wifi" })
  expectBadRequest(() => createHandler(evt(recDup)), "Bạn đã chấm công hôm nay rồi")
  ok("duplicate check-in rejected")

  reset()
  state.cfg = cfgRec() // active config with work_start_time 23:59 -> now is always before the threshold -> on_time
  const recIn = new MockRecord("attendance_logs", { user_id: "someone-else", check_in: "2026-08-10T08:00:00", status: "late", method: "wifi" })
  createHandler(evt(recIn))
  assert.strictEqual(recIn._data.user_id, "user1", "user_id bound to actor")
  assert.strictEqual(recIn._data.status, "on_time", "status computed server-side (cfg 23:59 -> always on time)")
  assert.ok(recIn._data.check_in, "check_in server-stamped (M1)")
  assert.strictEqual(recIn._data.ip_address, "192.168.1.100", "private IP recorded")
  ok("check-in: user bound, server status + IP recorded")

  reset()
  const recPublic = new MockRecord("attendance_logs", { user_id: "user1", status: "on_time", method: "wifi" })
  expectForbidden(() => createHandler(evt(recPublic, { realIP: () => "8.8.8.8" })), "Chấm công chỉ được thực hiện trong mạng nội bộ công ty")
  ok("check-in from a public IP is rejected")

  // PB 0.39 returns a json field via get() as raw []byte — the guard must decode it.
  const bytesOf = (s) => Array.from(s, (ch) => ch.charCodeAt(0))

  reset()
  state.cfg = cfgRec({ allowed_ips: bytesOf('["192.168.1.0/24"]') })
  const recIpOk = new MockRecord("attendance_logs", { user_id: "user1", status: "on_time", method: "wifi" })
  createHandler(evt(recIpOk, { realIP: () => "192.168.1.100" }))
  assert.strictEqual(recIpOk._data.ip_address, "192.168.1.100", "allowed_ips byte-array CIDR matched")
  ok("allowed_ips (PB byte array) CIDR match allows check-in")

  reset()
  state.cfg = cfgRec({ allowed_ips: bytesOf('["10.0.0.0/8"]') })
  const recIpNo = new MockRecord("attendance_logs", { user_id: "user1", status: "on_time", method: "wifi" })
  expectForbidden(() => createHandler(evt(recIpNo, { realIP: () => "192.168.1.100" })), "Thiết bị không nằm trong mạng nội bộ được phép chấm công")
  ok("allowed_ips (PB byte array) non-match rejects check-in")

  // an EMPTY allowed_ips list must fall through to the private-range check, not block everyone
  reset()
  state.cfg = cfgRec({ allowed_ips: bytesOf("[]") })
  const recEmptyOk = new MockRecord("attendance_logs", { user_id: "user1", status: "on_time", method: "wifi" })
  createHandler(evt(recEmptyOk, { realIP: () => "192.168.1.100" }))
  assert.strictEqual(recEmptyOk._data.ip_address, "192.168.1.100", "empty allowed_ips falls through to private check")
  ok("empty allowed_ips (PB byte array) falls back to the private-range check")

  reset()
  state.cfg = cfgRec({ allowed_ips: bytesOf("[]") })
  const recEmptyPub = new MockRecord("attendance_logs", { user_id: "user1", status: "on_time", method: "wifi" })
  expectForbidden(() => createHandler(evt(recEmptyPub, { realIP: () => "8.8.8.8" })), "Chấm công chỉ được thực hiện trong mạng nội bộ công ty")
  ok("empty allowed_ips + public IP still rejected (private-range fallback)")
}

// ============================================================= announcements create
console.log("announcements create guard:")
{
  reset()
  const rec = new MockRecord("announcements", { title: "T", content: "C" })
  createHandler(evt(rec, { actor: actor({ id: "user9" }) }))
  assert.strictEqual(rec._data.author_id, "user9", "author_id bound to the session actor")
  ok("announcement author_id bound to session actor")
}

// ======================================================================= H3 disabled
console.log("disabled accounts (H3):")
{
  reset()
  const rec = new MockRecord("tasks", { status: "in_progress" })
  expectForbidden(() => createHandler(evt(rec, { actor: actor({ disabled: true }) })), "Tài khoản đã bị vô hiệu hóa")
  ok("disabled user cannot create")

  reset()
  state.taskOriginal = taskRec()
  expectForbidden(() => updateHandler(evt(taskRec({ status: "in_progress" }), { actor: actor({ disabled: true }) })), "Tài khoản đã bị vô hiệu hóa")
  ok("disabled user cannot update")

  reset()
  const rec3 = new MockRecord("tasks", { id: "task1" })
  expectForbidden(() => deleteHandler(evt(rec3, { actor: actor({ disabled: true }) })), "Tài khoản đã bị vô hiệu hóa")
  ok("disabled user cannot delete")
}

console.log(`\nALL ${passed} TESTS PASSED`)
