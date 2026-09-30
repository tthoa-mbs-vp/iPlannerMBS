// Integration test — server-side audit logging (A11) against a real PocketBase
// instance running the real pb_hooks.
//
// What it proves (all against the live PB 0.39 exe + the real hooks):
//   1. Successful collection mutations (create/update/soft-delete/permanent-delete)
//      produce system_logs rows with the ACTOR from the server session and the
//      server-observed IP (never client-supplied).
//   2. Rule-rejected requests (never reach the request hooks) leave NO audit row.
//   3. Guard-rejected requests (guards.pb.js throws) leave NO audit row — because
//      the audit handler is registered after the guard handler and PB stops on the
//      first throw.
//   4. Clients can no longer forge system_logs rows (createRule locked to null).
//   5. Login attempts (successful and failed) are logged server-side.
//   6. Custom endpoints (recalc-kpi) write audit rows too.
//
// Run:  node backend/test/audit_integration.test.js   (expect "ALL N TESTS PASSED")
// Env:  PB_EXE=...  (optional, defaults to backend/pocketbase.exe)

"use strict"
const { spawn, execFileSync } = require("child_process")
const path = require("path")
const fs = require("fs")
const os = require("os")
const assert = require("assert")

const ROOT = path.join(__dirname, "..")
const EXE = process.env.PB_EXE || path.join(ROOT, "pocketbase.exe")
const HOOKS = path.join(ROOT, "pb_hooks")
const MIGRATIONS = path.join(ROOT, "pb_migrations")
const PUBLIC = path.join(ROOT, "pb_public")
const ADMIN_EMAIL = "it-audit-admin@example.com"
const ADMIN_PASS = "TestPass123!"

async function http(baseUrl, method, p, { token, body } = {}) {
  const headers = {}
  if (token) headers["Authorization"] = token
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  let res
  try {
    res = await fetch(baseUrl + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal })
  } finally { clearTimeout(timer) }
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

async function expectOk(baseUrl, method, p, opts) {
  const r = await http(baseUrl, method, p, opts)
  assert.ok(r.status === 200 || r.status === 204, `${method} ${p} -> HTTP ${r.status}: ${JSON.stringify(r.data)?.slice(0, 300)}`)
  return r.data
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitHealth(baseUrl, child) {
  const deadline = Date.now() + 40000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("server exited early:\n" + fs.readFileSync(child._logFile, "utf8").slice(-2000))
    try { if ((await http(baseUrl, "GET", "/api/health")).status === 200) return } catch { /* retry */ }
    await sleep(300)
  }
  throw new Error("server did not become healthy:\n" + fs.readFileSync(child._logFile, "utf8").slice(-2000))
}

async function main() {
  assert(fs.existsSync(EXE), `pocketbase executable not found: ${EXE}`)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pb-audit-"))
  const dataDir = path.join(tmp, "data")
  const hooksDir = path.join(tmp, "hooks")
  const logFile = path.join(tmp, "server.log")
  // FRESH data dir — the migration chain self-bootstraps the full schema
  fs.mkdirSync(dataDir, { recursive: true })
  fs.cpSync(HOOKS, hooksDir, { recursive: true })

  execFileSync(EXE, ["superuser", "upsert", ADMIN_EMAIL, ADMIN_PASS, `--dir=${dataDir}`], { stdio: "pipe" })

  const fd = fs.openSync(logFile, "w")
  const child = spawn(EXE, ["serve", "--http=127.0.0.1:18064", `--dir=${dataDir}`, `--hooksDir=${hooksDir}`,
    `--migrationsDir=${MIGRATIONS}`, `--publicDir=${PUBLIC}`, "--hooksWatch=false"],
    { stdio: ["ignore", fd, fd], windowsHide: true })
  child._fd = fd
  child._logFile = logFile

  let passed = 0
  const ok = (name) => { passed++; console.log("  ✓ " + name) }

  let childToKill = child
  try {
    const baseUrl = "http://127.0.0.1:18064"
    await waitHealth(baseUrl, child)

    const login = await expectOk(baseUrl, "POST", "/api/collections/_superusers/auth-with-password", { body: { identity: ADMIN_EMAIL, password: ADMIN_PASS } })
    const adminToken = login.token

    // ---- seed
    const c = (coll, body) => expectOk(baseUrl, "POST", `/api/collections/${coll}/records`, { token: adminToken, body })
    const dept = await c("departments", { code: "AU", name: "Audit Dept", is_counted: true })
    const roleEmp = await c("roles", { code: "AUDIT_EMP", name: "Audit Emp", level: "employee", view_scope: "personal", can_add_plans: true, can_add_tasks: true, can_edit_tasks: true })
    const roleAdmin = await c("roles", { code: "AUDIT_ADMIN", name: "Audit Admin", level: "leadership", view_scope: "all", can_manage: true, can_add_plans: true, can_add_tasks: true, can_edit_tasks: true, can_delete_tasks: true, can_delete_plans: true })
    const userA = await c("users", { email: "audit.a@test.local", password: ADMIN_PASS, passwordConfirm: ADMIN_PASS, name: "Audit A", verified: true, department_id: dept.id, role_id: roleEmp.id })
    await c("users", { email: "audit.admin@test.local", password: ADMIN_PASS, passwordConfirm: ADMIN_PASS, name: "Audit Admin User", verified: true, role_id: roleAdmin.id })

    // ---- helper: read system_logs as the can_manage user
    const logs = async () =>
      (await expectOk(baseUrl, "GET", "/api/collections/system_logs/records?perPage=500&sort=-created", { token: adminToken })).items

    // ================================================================ 1. CREATE + actor/IP
    console.log("\n1. collection create -> audit row (server actor + IP):")
    const ua = await expectOk(baseUrl, "POST", "/api/collections/users/auth-with-password", { body: { identity: "audit.a@test.local", password: ADMIN_PASS } })
    const userToken = ua.token
    const beforeCreate = (await logs()).length // baseline AFTER the login audit row

    const task = await expectOk(baseUrl, "POST", "/api/collections/tasks/records", {
      token: userToken,
      body: { name: "Audit Task Alpha", category: "normal", host_dept_id: dept.id, executor_id: userA.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "completed", rating: 5, is_recurring: false },
    })
    // H1 guard: client cannot create an already-completed task
    assert.strictEqual(task.status, "not_started", "guard must force not_started on create")
    assert.ok(!task.rating, "guard must strip rating on create (got " + task.rating + ")")
    ok("create passes guards (status forced, rating stripped)")

    const afterCreate = await logs()
    assert.strictEqual(afterCreate.length, beforeCreate + 1, "exactly one new audit row for the task create")
    const createRow = afterCreate[0]
    assert.strictEqual(createRow.action, "Tạo nhiệm vụ", "action label")
    assert.strictEqual(createRow.user_id, userA.id, "actor id comes from the server session")
    assert(String(createRow.target).indexOf("Audit Task Alpha") !== -1, "target = record name, got: " + createRow.target)
    assert.strictEqual(createRow.ip_address, "127.0.0.1", "server-observed IP recorded")
    ok("task create logged with session actor + real IP")

    // ================================================================ 2. UPDATE (status transition)
    console.log("\n2. status transition -> 'Cập nhật trạng thái nhiệm vụ':")
    const beforeStatus = (await logs()).length
    await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${task.id}`, { token: userToken, body: { status: "in_progress" } })
    const afterStatus = await logs()
    assert.strictEqual(afterStatus.length, beforeStatus + 1, "status update logged once")
    assert.strictEqual(afterStatus[0].action, "Cập nhật trạng thái nhiệm vụ", "status action label")
    assert(String(afterStatus[0].target).indexOf("→") !== -1, "target shows the transition: " + afterStatus[0].target)
    assert.strictEqual(afterStatus[0].user_id, userA.id, "actor id")
    ok("task status transition logged")

    // plain field edit -> generic label
    const beforeEdit = (await logs()).length
    await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${task.id}`, { token: userToken, body: { description: "edited description" } })
    const afterEdit = await logs()
    assert.strictEqual(afterEdit[0].action, "Sửa nhiệm vụ", "generic edit label")
    assert.strictEqual(afterEdit.length, beforeEdit + 1, "edit logged once")
    ok("plain task edit logged as 'Sửa nhiệm vụ'")

    // ================================================================ 3. soft + permanent delete
    console.log("\n3. soft-delete / restore / permanent delete:")
    const beforeSoft = (await logs()).length
    await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${task.id}`, { token: adminToken, body: { is_deleted: true } })
    let rows = await logs()
    assert.strictEqual(rows.length, beforeSoft + 1, "soft delete logged once")
    assert.strictEqual(rows[0].action, "Xóa nhiệm vụ (soft)", "soft delete label")
    ok("soft delete logged")

    await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${task.id}`, { token: adminToken, body: { is_deleted: false } })
    rows = await logs()
    assert.strictEqual(rows[0].action, "Khôi phục nhiệm vụ", "restore label")
    ok("restore logged")

    const beforeDel = (await logs()).length
    await expectOk(baseUrl, "DELETE", `/api/collections/tasks/records/${task.id}`, { token: adminToken })
    rows = await logs()
    assert.strictEqual(rows.length, beforeDel + 1, "permanent delete logged once")
    assert.strictEqual(rows[0].action, "Xóa nhiệm vụ", "permanent delete label")
    ok("permanent delete logged")

    // ================================================================ 4. rejected requests leave no trace
    console.log("\n4. rejected requests leave NO audit row:")
    const beforeReject = (await logs()).length

    // (a) rule-rejected: userA cannot create departments (manager-only)
    const r1 = await http(baseUrl, "POST", "/api/collections/departments/records", { token: userToken, body: { code: "X", name: "Nope", is_counted: true } })
    assert.strictEqual(r1.status, 400, "department create must be rejected")

    // (b) guard-rejected: userA tries to rate their own task (A10 self-rating ban)
    const task2 = await expectOk(baseUrl, "POST", "/api/collections/tasks/records", {
      token: userToken,
      body: { name: "Audit Task Beta", category: "normal", host_dept_id: dept.id, executor_id: userA.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", is_recurring: false },
    })
    const r2 = await http(baseUrl, "PATCH", `/api/collections/tasks/records/${task2.id}`, { token: userToken, body: { rating: 5, rated_by_id: userA.id, rated_at: new Date().toISOString() } })
    assert.strictEqual(r2.status, 403, "self-rating must be rejected by guards")

    const afterReject = await logs()
    const newRows = afterReject.slice(0, afterReject.length - beforeReject)
    assert.strictEqual(newRows.length, 1, "only the successful task2 create is logged")
    assert.strictEqual(newRows[0].action, "Tạo nhiệm vụ", "rejected attempts must not be logged")
    ok("rule-rejected and guard-rejected requests are NOT audited")

    // ================================================================ 5. client cannot forge logs
    console.log("\n5. system_logs.createRule locked (server-only writes):")
    const forge = await http(baseUrl, "POST", "/api/collections/system_logs/records", {
      token: userToken,
      body: { user_id: userA.id, action: "HACKED", target: "forged entry", ip_address: "1.2.3.4" },
    })
    assert(forge.status === 400 || forge.status === 403, "client create of system_logs must fail, got " + forge.status)
    const afterForge = await logs()
    assert(afterForge.every((l) => l.action !== "HACKED"), "no forged row present")
    ok("clients cannot create system_logs rows")

    // ================================================================ 6. login attempts logged
    console.log("\n6. login attempts (success + failure) logged:")
    const beforeLogin = (await logs()).length
    // failed attempt
    const bad = await http(baseUrl, "POST", "/api/collections/users/auth-with-password", { body: { identity: "audit.a@test.local", password: "WrongPass123!" } })
    assert(bad.status === 400 || bad.status === 401, "wrong password must fail")
    const afterFail = await logs()
    assert.strictEqual(afterFail.length, beforeLogin + 1, "failed login attempt logged once")
    assert.strictEqual(afterFail[0].action, "Đăng nhập", "login action label")
    assert.strictEqual(afterFail[0].target, "audit.a@test.local", "identity recorded")
    ok("failed login attempt logged")

    const beforeLogin2 = (await logs()).length
    await expectOk(baseUrl, "POST", "/api/collections/users/auth-with-password", { body: { identity: "audit.a@test.local", password: ADMIN_PASS } })
    const afterSuccess = await logs()
    assert.strictEqual(afterSuccess.length, beforeLogin2 + 1, "successful login logged once")
    assert.strictEqual(afterSuccess[0].action, "Đăng nhập", "login action label")
    ok("successful login logged")

    // ================================================================ 7. custom endpoint audit
    console.log("\n7. custom endpoint (recalc-kpi) audit:")
    const beforeKpi = (await logs()).length
    await expectOk(baseUrl, "POST", "/api/custom/recalc-kpi", { token: adminToken })
    const afterKpi = await logs()
    assert.strictEqual(afterKpi.length, beforeKpi + 1, "recalc-kpi logged once")
    assert.strictEqual(afterKpi[0].action, "Tính điểm KPI", "recalc action label")
    assert(String(afterKpi[0].target).indexOf("batch") !== -1, "recalc target")
    ok("recalc-kpi endpoint logged")
  } finally {
    try { if (childToKill.exitCode === null) childToKill.kill() } catch { /* ignore */ }
    await sleep(500)
    try { fs.closeSync(fd) } catch { /* ignore */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  console.log(`\nALL ${passed} TESTS PASSED`)
}

main().catch((err) => { console.error("\nFAILED:", err && err.message ? err.message : err); process.exit(1) })
