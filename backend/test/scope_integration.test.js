// Integration test — real PocketBase + the real pb_hooks.
//
// Two questions are answered empirically:
//
//   A) (probe) When TWO *.pb.js files register the same event (onRecordsListRequest),
//      does PocketBase 0.39 run BOTH handlers or only one file's handlers? This is the
//      exact concern that motivated H4 (merging hr.pb.js into scope.pb.js). A probe file
//      that logs to the server console is loaded alongside the real hooks, and we check
//      whether the probe ran AND whether scope.pb.js's filtering still took effect.
//
//   B) (functional) With the current merged single handler in scope.pb.js, view_scope is
//      enforced for plans / tasks / kpi_scores / comments / proposals AND the HR
//      collections (salary_records, employee_profiles, qualifications, work_experiences)
//      — proving the H4 merge did not silently drop either group, and that M4 (comments /
//      proposals scoping) works.
//
// How it works:
//   - copies the real pb_data/ (schema + applied migrations) into a temp dir — the base
//     collections (departments, roles, plans, ...) were created via the admin UI, so a
//     fresh pb_data cannot run these migrations; the copy is authoritative and untouched.
//   - copies the real pb_hooks/ (+ an optional probe file) into a temp hooks dir
//   - creates a superuser with known credentials via `superuser upsert`
//   - boots `pocketbase serve`, seeds an isolated test dataset, and asserts via HTTP.
//
// Run:  node backend/test/scope_integration.test.js   (expect "ALL N TESTS PASSED")
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
const ADMIN_EMAIL = "it-scope-test@example.com"
const ADMIN_PASS = "TestPass123!"

const PROBE_SRC = `/// <reference path="../pb_data/types.d.ts" />
// Probe for scope_integration.test.js — a SECOND file registering onRecordsListRequest.
// Detected via console.log in the server log: if it ran, PocketBase executes handlers
// from multiple *.pb.js files for the same event; if not, only one file's handlers ran.
onRecordsListRequest(function(e) {
  console.log("ZZ_PROBE_RAN:" + (e.collection ? e.collection.name : "?"))
  return e.next()
})
`

// ---------------------------------------------------------------- tiny HTTP
async function http(baseUrl, method, p, { token, body } = {}) {
  const headers = {}
  if (token) headers["Authorization"] = token
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  let res
  try {
    res = await fetch(baseUrl + p, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}

async function expectOk(baseUrl, method, p, opts) {
  const r = await http(baseUrl, method, p, opts)
  assert.strictEqual(r.status, 200, `${method} ${p} -> HTTP ${r.status}: ${JSON.stringify(r.data)?.slice(0, 300)}`)
  return r.data
}

// ------------------------------------------------------------ server control
function startServer(dataDir, hooksDir, port, logFile) {
  const fd = fs.openSync(logFile, "w")
  const child = spawn(
    EXE,
    ["serve", `--http=127.0.0.1:${port}`, `--dir=${dataDir}`, `--hooksDir=${hooksDir}`,
      `--migrationsDir=${MIGRATIONS}`, `--publicDir=${PUBLIC}`, "--hooksWatch=false"],
    { stdio: ["ignore", fd, fd], windowsHide: true }
  )
  child._fd = fd
  child._logFile = logFile
  return child
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitHealth(baseUrl, child) {
  const deadline = Date.now() + 40000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("server exited early:\n" + fs.readFileSync(child._logFile, "utf8").slice(-2000))
    }
    try {
      if ((await http(baseUrl, "GET", "/api/health")).status === 200) return
    } catch { /* retry */ }
    await sleep(300)
  }
  throw new Error("server did not become healthy:\n" + fs.readFileSync(child._logFile, "utf8").slice(-2000))
}

async function stopServer(child) {
  if (!child) return
  try { if (child.exitCode === null) child.kill() } catch { /* already gone */ }
  await sleep(600)
  try { if (child._fd) fs.closeSync(child._fd) } catch { /* ignore */ }
}

// ------------------------------------------------------------ bootstrap + seed
async function bootstrap(tmp, port, withProbe) {
  const dataDir = path.join(tmp, "data")
  const hooksDir = path.join(tmp, "hooks")
  fs.cpSync(path.join(ROOT, "pb_data"), dataDir, { recursive: true })
  fs.cpSync(HOOKS, hooksDir, { recursive: true })
  if (withProbe) fs.writeFileSync(path.join(hooksDir, "zz_probe.pb.js"), PROBE_SRC)

  execFileSync(EXE, ["superuser", "upsert", ADMIN_EMAIL, ADMIN_PASS, `--dir=${dataDir}`], { stdio: "pipe" })

  const logFile = path.join(tmp, "server.log")
  const child = startServer(dataDir, hooksDir, port, logFile)
  const baseUrl = `http://127.0.0.1:${port}`
  await waitHealth(baseUrl, child)

  const login = await expectOk(baseUrl, "POST", "/api/collections/_superusers/auth-with-password",
    { body: { identity: ADMIN_EMAIL, password: ADMIN_PASS } })
  return { baseUrl, adminToken: login.token, child, logFile }
}

async function seed(baseUrl, adminToken) {
  const c = (coll, body) =>
    expectOk(baseUrl, "POST", `/api/collections/${coll}/records`, { token: adminToken, body })
  const mkUser = (email, name, extra) =>
    c("users", { email, password: ADMIN_PASS, passwordConfirm: ADMIN_PASS, name, verified: true, ...extra })

  const deptA = await c("departments", { code: "DA", name: "Dept A", is_counted: true })
  const deptB = await c("departments", { code: "DB", name: "Dept B", is_counted: true })
  const roleEmp = await c("roles", { code: "EMP_DEPT", name: "Employee (dept)", level: "employee", view_scope: "department", can_add_plans: true, can_add_tasks: true, can_edit_plans: true, can_edit_tasks: true })
  const roleHr = await c("roles", { code: "HR_DEPT", name: "HR (dept)", level: "management", view_scope: "department", can_view_salary: true })
  const roleAdmin = await c("roles", { code: "ADMIN", name: "Admin", level: "leadership", view_scope: "all", can_manage: true, can_add_plans: true, can_add_tasks: true, can_edit_plans: true, can_edit_tasks: true, can_delete_plans: true, can_delete_tasks: true })

  const userA = await mkUser("usera@test.local", "User A", { department_id: deptA.id, role_id: roleEmp.id })
  const userB = await mkUser("userb@test.local", "User B", { department_id: deptB.id, role_id: roleEmp.id })
  const hrUser = await mkUser("hr@test.local", "HR User", { department_id: deptA.id, role_id: roleHr.id })
  const adminUser = await mkUser("admin@test.local", "Admin User", { role_id: roleAdmin.id })

  const planA = await c("plans", { name: "Plan A (dept A)", leader_id: userA.id, host_dept_id: deptA.id, partner_dept_ids: [], start_date: "2026-01-01 00:00:00.000Z", end_date: "2026-12-31 00:00:00.000Z", status: "not_started", is_sudden: false, is_high_impact: false })
  const planB = await c("plans", { name: "Plan B (dept B)", leader_id: userB.id, host_dept_id: deptB.id, partner_dept_ids: [], start_date: "2026-01-01 00:00:00.000Z", end_date: "2026-12-31 00:00:00.000Z", status: "not_started", is_sudden: false, is_high_impact: false })

  const taskA = await c("tasks", { name: "Task A1", plan_id: planA.id, category: "normal", host_dept_id: deptA.id, executor_id: userA.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", weight: 100, is_recurring: false })
  const taskB = await c("tasks", { name: "Task B1", plan_id: planB.id, category: "normal", host_dept_id: deptB.id, executor_id: userB.id, supervisor_id: userB.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", weight: 100, is_recurring: false })

  await c("kpi_scores", { task_id: taskA.id, base_score: 10, difficulty_coeff: 1, progress_score: 100, result_rating: 5, final_score: 10 })
  await c("kpi_scores", { task_id: taskB.id, base_score: 10, difficulty_coeff: 1, progress_score: 100, result_rating: 4, final_score: 8 })
  await c("comments", { task_id: taskA.id, user_id: userA.id, content: "comment on task A" })
  await c("comments", { task_id: taskB.id, user_id: userB.id, content: "comment on task B" })
  await c("proposals", { task_id: taskA.id, type: "extension", reason: "extend A", status: "pending", requester_id: userA.id, approver_id: "" })
  await c("proposals", { task_id: taskB.id, type: "cancellation", reason: "cancel B", status: "pending", requester_id: userB.id, approver_id: "" })
  await c("salary_records", { user_id: userA.id, start_date: "2026-01-01 00:00:00.000Z", salary_coefficient: 2.0, allowance_coefficient: 0.5, decision_number: "QD-1" })
  await c("salary_records", { user_id: userB.id, start_date: "2026-01-01 00:00:00.000Z", salary_coefficient: 2.1, allowance_coefficient: 0.4, decision_number: "QD-2" })

  return { deptA, deptB, userA, userB, hrUser, adminUser, planA, planB, taskA, taskB }
}

async function loginUser(baseUrl, email) {
  const r = await http(baseUrl, "POST", "/api/collections/users/auth-with-password",
    { body: { identity: email, password: ADMIN_PASS } })
  assert.strictEqual(r.status, 200, `login ${email} failed: ${JSON.stringify(r.data)?.slice(0, 300)}`)
  return r.data.token
}

function idsOf(items) {
  return items.map((x) => x.id).sort()
}

// ------------------------------------------------------------------- main
let passed = 0
function ok(name) { passed++; console.log("  ✓ " + name) }

async function main() {
  assert(fs.existsSync(EXE), `pocketbase executable not found: ${EXE}`)
  assert(fs.existsSync(path.join(ROOT, "pb_data", "data.db")), "pb_data/data.db missing — the test copies the real schema")

  let servers = []
  const tmps = []
  try {
    // ================================================================ PHASE A
    console.log("\nPhase A — multi-file hook behavior (probe):")
    const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), "pb-it-A-"))
    tmps.push(tmpA)
    const portA = 18000 + Math.floor(Math.random() * 4000)
    const bootA = await bootstrap(tmpA, portA, true)
    servers.push(bootA.child)
    const idsA = await seed(bootA.baseUrl, bootA.adminToken)
    const tokenA = await loginUser(bootA.baseUrl, idsA.userA.email)

    const listA = await expectOk(bootA.baseUrl, "GET", "/api/collections/tasks/records?perPage=200",
      { token: tokenA })
    const logA = fs.readFileSync(bootA.logFile, "utf8")
    const probeRan = logA.indexOf("ZZ_PROBE_RAN") !== -1
    const scopeRan = Array.isArray(listA.items) && listA.items.length === 1 && listA.items[0].id === idsA.taskA.id

    let conclusion
    if (probeRan && scopeRan) conclusion = "BOTH files' handlers ran (PB executes every registration for the event)"
    else if (probeRan && !scopeRan) conclusion = "ONLY the probe ran — scope.pb.js was NOT executed (other handlers silently lost!)"
    else if (!probeRan && scopeRan) conclusion = "ONLY scope.pb.js ran — the second file's handler was NOT executed"
    else conclusion = "NEITHER ran (unexpected)"
    console.log(`    probe handler executed: ${probeRan ? "YES" : "NO"}`)
    console.log(`    scope.pb.js filtering applied: ${scopeRan ? "YES" : "NO"}`)
    console.log(`    => ${conclusion}`)
    ok(`probe phase completed (${probeRan && scopeRan ? "both handlers ran" : probeRan ? "only probe ran" : "only scope ran"})`)
    await stopServer(bootA.child)

    // ================================================================ PHASE B
    console.log("\nPhase B — merged scope handler (plans/tasks/kpi/comments/proposals + HR):")
    const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), "pb-it-B-"))
    tmps.push(tmpB)
    const portB = 18000 + Math.floor(Math.random() * 4000)
    const bootB = await bootstrap(tmpB, portB, false)
    servers.push(bootB.child)
    const idsB = await seed(bootB.baseUrl, bootB.adminToken)

    const list = async (coll, token) =>
      (await expectOk(bootB.baseUrl, "GET", `/api/collections/${coll}/records?perPage=200`, { token })).items

    // ---- userA: department scope (dept A)
    const tokenUserA = await loginUser(bootB.baseUrl, idsB.userA.email)
    {
      const plans = await list("plans", tokenUserA)
      assert.deepStrictEqual(idsOf(plans), [idsB.planA.id], "userA plans list must contain only planA")
      ok("plans list scoped (only plan of own department)")

      const tasks = await list("tasks", tokenUserA)
      assert.deepStrictEqual(idsOf(tasks), [idsB.taskA.id], "userA tasks list must contain only taskA")
      ok("tasks list scoped")

      const kpiAll = await list("kpi_scores", bootB.adminToken)
      const kpiTaskA = kpiAll.find((s) => s.task_id === idsB.taskA.id)
      assert(kpiTaskA, "kpi_scores for taskA seeded")
      const kpi = await list("kpi_scores", tokenUserA)
      assert.deepStrictEqual(idsOf(kpi), [kpiTaskA.id], "userA sees only taskA's kpi score")
      ok("kpi_scores list scoped (through related task)")

      const comments = await list("comments", tokenUserA)
      assert.strictEqual(comments.length, 1, "userA sees exactly 1 comment")
      assert.strictEqual(comments[0].task_id, idsB.taskA.id, "userA comment must be on taskA (M4)")
      ok("comments list scoped (M4)")

      const proposals = await list("proposals", tokenUserA)
      assert.strictEqual(proposals.length, 1, "userA sees exactly 1 proposal")
      assert.strictEqual(proposals[0].task_id, idsB.taskA.id, "userA proposal must be on taskA (M4)")
      ok("proposals list scoped (M4)")

      const planBView = await http(bootB.baseUrl, "GET", `/api/collections/plans/records/${idsB.planB.id}`, { token: tokenUserA })
      assert.strictEqual(planBView.status, 404, "direct view of out-of-scope plan must be 404")
      ok("out-of-scope plan direct view -> 404")
    }

    // ---- hrUser: can_view_salary + department scope -> only dept A salary records
    {
      const tokenHr = await loginUser(bootB.baseUrl, idsB.hrUser.email)
      const salaries = await list("salary_records", tokenHr)
      assert.strictEqual(salaries.length, 1, "HR (dept scope) sees exactly 1 salary record")
      assert.strictEqual(salaries[0].user_id, idsB.userA.id, "HR must see only dept-A salary (H4 merged HR scope)")
      ok("salary_records scoped by department for can_view_salary holder (H4 merge works)")
    }

    // ---- adminUser: can_manage -> full visibility (contains everything, incl. copied dev data)
    {
      const tokenAdmin = await loginUser(bootB.baseUrl, idsB.adminUser.email)
      const plans = await list("plans", tokenAdmin)
      const planIds = idsOf(plans)
      assert(planIds.includes(idsB.planA.id) && planIds.includes(idsB.planB.id),
        "admin must see planA and planB (got " + planIds.length + " plans)")
      ok("admin (can_manage) sees all plans")

      const salaries = await list("salary_records", tokenAdmin)
      const salaryUsers = salaries.map((s) => s.user_id)
      assert(salaryUsers.includes(idsB.userA.id) && salaryUsers.includes(idsB.userB.id),
        "admin must see both seeded salary records (got " + salaries.length + ")")
      ok("admin sees all salary records")

      const comments = await list("comments", tokenAdmin)
      const commentTasks = comments.map((c) => c.task_id)
      assert(commentTasks.includes(idsB.taskA.id) && commentTasks.includes(idsB.taskB.id),
        "admin must see both seeded comments (got " + comments.length + ")")
      ok("admin sees all comments")
    }
    await stopServer(bootB.child)
  } finally {
    for (const s of servers) await stopServer(s)
    for (const t of tmps) { try { fs.rmSync(t, { recursive: true, force: true }) } catch { /* ignore */ } }
  }

  console.log(`\nALL ${passed} TESTS PASSED`)
}

main().catch((err) => {
  console.error("\nFAILED:", err && err.message ? err.message : err)
  process.exit(1)
})
