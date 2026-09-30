// Integration test — verifies the pre-deploy hardening hypotheses H1–H4 against a
// REAL PocketBase 0.39 instance running the REAL pb_hooks (no mocks, real HTTP):
//
//   H1 — tasks.createRule alone lets a can_add_tasks user create a task with
//        status="completed" / rating / backdated completed_at / is_deleted=true,
//        which would mint a fake KPI score via the after-create hook. The guard in
//        guards.pb.js must force status="not_started" and strip the rating stamps
//        (can_manage / superusers keep full control).
//   H2 — a user with NO loadable role (no role_id, or a deleted/cleared role) must
//        NOT get full visibility. helpers.js `_scopeContext` is fail-closed: any
//        user without a role whose view_scope is "all" is narrowed to "personal".
//   H3 — a disabled account (users.disabled=true) must be rejected server-side on
//        read AND write requests (ensureEnabled in scope.pb.js / guards.pb.js),
//        even though the collection rules themselves don't know about `disabled`.
//   H4 — the merged scope handler (hr.pb.js merged into scope.pb.js) still enforces
//        view_scope for the HR collections (salary_records, employee_profiles, ...)
//        for can_view_salary holders, without dropping the plans/tasks scoping.
//   M1 — attendance timestamps are server-authoritative: a forged check_in / status /
//        user_id / ip on create is overwritten (check_in = server now), check_out is
//        also server-stamped, and the owner cannot rewrite check_in afterwards.
//   M8 — completed_at is server-stamped (now) on the transition into completed for ALL
//        roles — including the can_manage bypass path and create-with-status=completed —
//        and cleared when leaving completed.
//
// How it works (same harness as scope_integration.test.js / audit_integration.test.js):
//   - boots PocketBase into a FRESH temp data dir; the schema is created by the
//     repo's own migration chain (created_* + updated_*), so this exercises the
//     exact same bootstrap a new deployment/CI instance goes through.
//   - copies the real pb_hooks/ into a temp hooks dir
//   - creates a superuser with known credentials via `superuser upsert`
//   - boots `pocketbase serve`, seeds an isolated dataset, asserts via HTTP.
//
// Run:  node backend/test/harden_integration.test.js   (expect "ALL N TESTS PASSED")
// Env:  PB_EXE=...        (optional, defaults to backend/pocketbase.exe — Windows exe)
//       PB_IMAGE=...      (optional — when set, the server runs inside a podman container
//                          built from backend/Dockerfile instead of the local exe, so the
//                          exact production image is verified. The harness mounts a FRESH
//                          temp data dir (schema built by the migration chain) + a copy of
//                          pb_hooks into a throwaway container on a random port, and
//                          removes it afterwards.
//                          Example: PB_IMAGE=localhost/iplanner_pocketbase:latest)

"use strict"
const { spawn, execFileSync } = require("child_process")
const path = require("path")
const fs = require("fs")
const os = require("os")
const assert = require("assert")

const ROOT = path.join(__dirname, "..")
const EXE = process.env.PB_EXE || path.join(ROOT, "pocketbase.exe")
const IMAGE = process.env.PB_IMAGE || ""
const CONTAINER_MODE = !!IMAGE
const HOOKS = path.join(ROOT, "pb_hooks")
const MIGRATIONS = path.join(ROOT, "pb_migrations")
const PUBLIC = path.join(ROOT, "pb_public")
const ADMIN_EMAIL = "it-harden-admin@example.com"
const ADMIN_PASS = "TestPass123!"

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

async function waitHealth(baseUrl, child, containerName) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error("server exited early:\n" + (child._logFile ? fs.readFileSync(child._logFile, "utf8").slice(-2000) : ""))
    try { if ((await http(baseUrl, "GET", "/api/health")).status === 200) return } catch { /* retry */ }
    await sleep(300)
  }
  let tail = ""
  try {
    tail = containerName
      ? execFileSync("podman", ["logs", containerName], { stdio: "pipe" }).toString().slice(-3000)
      : (child && child._logFile ? fs.readFileSync(child._logFile, "utf8").slice(-2000) : "")
  } catch { /* ignore */ }
  throw new Error("server did not become healthy:\n" + tail)
}

async function loginUser(baseUrl, email) {
  const r = await http(baseUrl, "POST", "/api/collections/users/auth-with-password",
    { body: { identity: email, password: ADMIN_PASS } })
  assert.strictEqual(r.status, 200, `login ${email} failed: ${JSON.stringify(r.data)?.slice(0, 300)}`)
  return r.data.token
}

const idsOf = (items) => items.map((x) => x.id).sort()

// ------------------------------------------------------------------- main
let passed = 0
function ok(name) { passed++; console.log("  ✓ " + name) }

async function main() {
  if (CONTAINER_MODE) {
    try { execFileSync("podman", ["image", "exists", IMAGE], { stdio: "ignore" }) }
    catch { throw new Error(`container image not found: ${IMAGE} — build it first (e.g. 'python -m podman_compose build pocketbase')`) }
  } else {
    assert(fs.existsSync(EXE), `pocketbase executable not found: ${EXE}`)
  }

  // container mode mounts the temp dir into the container, so keep it inside the repo
  // (the podman machine reliably shares the project dir; os.tmpdir() may not)
  const tmp = fs.mkdtempSync(CONTAINER_MODE ? path.join(ROOT, ".tmp-harden-") : path.join(os.tmpdir(), "pb-harden-"))
  const dataDir = path.join(tmp, "data")
  const hooksDir = path.join(tmp, "hooks")
  const logFile = path.join(tmp, "server.log")
  // FRESH data dir — the migration chain (backend/pb_migrations) self-bootstraps
  // the full schema, exactly like a new deployment or the CI job
  fs.mkdirSync(dataDir, { recursive: true })
  fs.cpSync(HOOKS, hooksDir, { recursive: true })

  if (CONTAINER_MODE) {
    execFileSync("podman", ["run", "--rm", "--entrypoint", "pocketbase",
      "-v", `${dataDir}:/pb/pb_data`, IMAGE,
      "superuser", "upsert", ADMIN_EMAIL, ADMIN_PASS, "--dir=/pb/pb_data"], { stdio: "pipe" })
  } else {
    execFileSync(EXE, ["superuser", "upsert", ADMIN_EMAIL, ADMIN_PASS, `--dir=${dataDir}`], { stdio: "pipe" })
  }

  const port = 18000 + Math.floor(Math.random() * 4000)
  const baseUrl = `http://127.0.0.1:${port}`

  let child = null
  let childToKill = null
  let fd = null
  let containerName = ""
  if (CONTAINER_MODE) {
    containerName = `pb-harden-${process.pid}-${Math.floor(Math.random() * 100000)}`
    execFileSync("podman", [
      "run", "-d", "--name", containerName, "-p", `127.0.0.1:${port}:${port}`,
      "-v", `${dataDir}:/pb/pb_data`,
      "-v", `${hooksDir}:/pb/pb_hooks`,
      "-v", `${MIGRATIONS}:/pb/pb_migrations:ro`,
      "-v", `${PUBLIC}:/pb/pb_public:ro`,
      "--entrypoint", "pocketbase", IMAGE,
      "serve", `--http=0.0.0.0:${port}`, "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks",
      `--migrationsDir=/pb/pb_migrations`, `--publicDir=/pb/pb_public`, "--hooksWatch=false",
    ], { stdio: "pipe" })
  } else {
    fd = fs.openSync(logFile, "w")
    child = spawn(EXE, ["serve", `--http=127.0.0.1:${port}`, `--dir=${dataDir}`, `--hooksDir=${hooksDir}`,
      `--migrationsDir=${MIGRATIONS}`, `--publicDir=${PUBLIC}`, "--hooksWatch=false"],
      { stdio: ["ignore", fd, fd], windowsHide: true })
    child._fd = fd
    child._logFile = logFile
    childToKill = child
  }
  try {
    await waitHealth(baseUrl, child, containerName)

    const login = await expectOk(baseUrl, "POST", "/api/collections/_superusers/auth-with-password",
      { body: { identity: ADMIN_EMAIL, password: ADMIN_PASS } })
    const adminToken = login.token

    // ---------------------------------------------------------------- seed
    const c = (coll, body) => expectOk(baseUrl, "POST", `/api/collections/${coll}/records`, { token: adminToken, body })
    const mkUser = (email, name, extra) =>
      c("users", { email, password: ADMIN_PASS, passwordConfirm: ADMIN_PASS, name, verified: true, ...extra })
    const list = async (coll, token) =>
      (await expectOk(baseUrl, "GET", `/api/collections/${coll}/records?perPage=200`, { token })).items

    const deptA = await c("departments", { code: "H1DEPA", name: "H1 Dept A", is_counted: true })
    const deptB = await c("departments", { code: "H1DEPB", name: "H1 Dept B", is_counted: true })

    const roleEmp = await c("roles", { code: "H1EMP", name: "H1 Employee", level: "employee", view_scope: "department", can_add_tasks: true })
    const roleHr = await c("roles", { code: "H1HRD", name: "H1 HR dept", level: "management", view_scope: "department", can_view_salary: true })
    const roleHrAll = await c("roles", { code: "H1HRA", name: "H1 HR all", level: "leadership", view_scope: "all", can_view_salary: true })
    const roleTempAll = await c("roles", { code: "H1TMP", name: "H1 Temp all", level: "leadership", view_scope: "all" })
    const roleAdmin = await c("roles", { code: "H1ADM", name: "H1 Admin", level: "leadership", view_scope: "all", can_manage: true, can_add_tasks: true, can_edit_tasks: true, can_delete_tasks: true })

    const userA = await mkUser("h1.a@test.local", "H1 User A", { department_id: deptA.id, role_id: roleEmp.id })
    const userB = await mkUser("h1.b@test.local", "H1 User B", { department_id: deptB.id, role_id: roleEmp.id })
    const hrA = await mkUser("h1.hra@test.local", "H1 HR A", { department_id: deptA.id, role_id: roleHr.id })
    const hrAll = await mkUser("h1.hrall@test.local", "H1 HR All", { role_id: roleHrAll.id })
    const noRole = await mkUser("h1.norole@test.local", "H1 No Role", { department_id: deptA.id })
    const disabledUser = await mkUser("h1.disabled@test.local", "H1 Disabled", { department_id: deptA.id, role_id: roleEmp.id, disabled: true })
    const tempUser = await mkUser("h1.temp@test.local", "H1 Temp", { role_id: roleTempAll.id })
    const adminUser = await mkUser("h1.admin@test.local", "H1 Admin User", { role_id: roleAdmin.id })

    const planA = await c("plans", { name: "H1 Plan A", leader_id: userA.id, host_dept_id: deptA.id, partner_dept_ids: [], start_date: "2026-01-01 00:00:00.000Z", end_date: "2026-12-31 00:00:00.000Z", status: "not_started", is_sudden: false, is_high_impact: false })
    const planB = await c("plans", { name: "H1 Plan B", leader_id: userB.id, host_dept_id: deptB.id, partner_dept_ids: [], start_date: "2026-01-01 00:00:00.000Z", end_date: "2026-12-31 00:00:00.000Z", status: "not_started", is_sudden: false, is_high_impact: false })
    const planC = await c("plans", { name: "H1 Plan C", leader_id: userA.id, host_dept_id: deptA.id, partner_dept_ids: [], start_date: "2026-01-01 00:00:00.000Z", end_date: "2026-12-31 00:00:00.000Z", status: "not_started", is_sudden: false, is_high_impact: false })

    const taskA = await c("tasks", { name: "H1 Task A", plan_id: planA.id, category: "normal", host_dept_id: deptA.id, executor_id: userA.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", is_recurring: false })
    const taskB = await c("tasks", { name: "H1 Task B", plan_id: planB.id, category: "normal", host_dept_id: deptB.id, executor_id: userB.id, supervisor_id: userB.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", is_recurring: false })
    const taskC = await c("tasks", { name: "H1 Task C (disabled executor)", plan_id: planC.id, category: "normal", host_dept_id: deptA.id, executor_id: disabledUser.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", is_recurring: false })

    // M4: comments / proposals attached to seeded tasks — scoping runs through the related task
    const commentA = await c("comments", { task_id: taskA.id, user_id: userB.id, content: "H1 comment on taskA" })
    const commentB = await c("comments", { task_id: taskB.id, user_id: userB.id, content: "H1 comment on taskB" })
    const commentC = await c("comments", { task_id: taskC.id, user_id: userA.id, content: "H1 comment on taskC" })
    const propA = await c("proposals", { task_id: taskA.id, requester_id: userB.id, type: "extension", reason: "H1 prop A", new_deadline: "2026-07-15 00:00:00.000Z", status: "pending" })
    const propB = await c("proposals", { task_id: taskB.id, requester_id: userB.id, type: "cancellation", reason: "H1 prop B", status: "pending" })
    const propC = await c("proposals", { task_id: taskC.id, requester_id: userA.id, type: "extension", reason: "H1 prop C", new_deadline: "2026-07-20 00:00:00.000Z", status: "pending" })

    const salaryA = await c("salary_records", { user_id: userA.id, start_date: "2026-01-01 00:00:00.000Z", salary_coefficient: 2.0, allowance_coefficient: 0.5, decision_number: "H1-QD-A" })
    const salaryB = await c("salary_records", { user_id: userB.id, start_date: "2026-01-01 00:00:00.000Z", salary_coefficient: 2.1, allowance_coefficient: 0.4, decision_number: "H1-QD-B" })
    const profileA = await c("employee_profiles", { user_id: userA.id, phone: "0900000001" })
    const profileB = await c("employee_profiles", { user_id: userB.id, phone: "0900000002" })

    // ================================================================ H1
    console.log("\nH1 — tasks.createRule bypass: forged completed/rated/deleted create is stripped:")
    const tokenA = await loginUser(baseUrl, userA.email)

    const forged = await expectOk(baseUrl, "POST", "/api/collections/tasks/records", {
      token: tokenA,
      body: { name: "H1 forged completed", plan_id: planC.id, category: "normal", host_dept_id: deptA.id, executor_id: userA.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "completed", rating: 5, rated_by_id: userB.id, rated_at: "2026-01-02 00:00:00.000Z", completed_at: "2000-01-01 00:00:00.000Z", is_deleted: true, is_recurring: false },
    })
    assert.strictEqual(forged.status, "not_started", "create guard must force status=not_started (got " + forged.status + ")")
    assert.strictEqual(forged.is_deleted, false, "create guard must force is_deleted=false")
    assert.ok(!forged.rating, "create guard must strip rating (got " + forged.rating + ")")
    assert.ok(!forged.rated_by_id, "create guard must strip rated_by_id (got " + forged.rated_by_id + ")")
    assert.ok(!forged.completed_at, "create guard must strip backdated completed_at (got " + forged.completed_at + ")")
    ok("non-manager cannot create a completed/rated/deleted task (status forced, stamps stripped)")

    // the after-create KPI hook must NOT mint a score for the forced not_started task
    const kpisAll = await list("kpi_scores", adminToken)
    assert.strictEqual(kpisAll.filter((k) => k.task_id === forged.id).length, 0,
      "no KPI score may be minted for a task forced to not_started (H1)")
    ok("forced not_started task gets NO KPI score (no fake KPI minted)")

    const tokenAdmin = await loginUser(baseUrl, adminUser.email)
    const adminTask = await expectOk(baseUrl, "POST", "/api/collections/tasks/records", {
      token: tokenAdmin,
      body: { name: "H1 admin completed", plan_id: planC.id, category: "normal", host_dept_id: deptA.id, executor_id: userA.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "completed", rating: 5, is_recurring: false },
    })
    assert.strictEqual(adminTask.status, "completed", "can_manage keeps full control on create")
    assert.strictEqual(adminTask.rating, 5, "can_manage keeps rating on create")
    assert.ok(adminTask.completed_at, "M8: create with status=completed is server-stamped (got " + adminTask.completed_at + ")")
    const adminKpi = (await list("kpi_scores", adminToken)).filter((k) => k.task_id === adminTask.id)
    assert.strictEqual(adminKpi.length, 1, "can_manage-created completed task DOES get a KPI score (contrast to H1)")
    const kpiAdmin = adminKpi[0] // KPI of the planC task — used by the M4 scope assertions below
    // KPI formula parity: the score must come from the SHARED _kpi-formula.cjs
    // module (require(__hooks + "/_kpi-formula.cjs")) — normal task, rating 5,
    // completed_at stamped NOW vs the 2026-06-30 deadline -> >5 days late ->
    // schedule 0% -> final = 10 * 0.7 * (5/5) = 7.0
    assert.strictEqual(kpiAdmin.base_score, 10, "shared formula: base 10 for normal task")
    assert.strictEqual(kpiAdmin.difficulty_coeff, 1.0, "shared formula: difficulty 1.0 (no partner dept)")
    assert.strictEqual(kpiAdmin.progress_score, 0, "shared formula: >5 days late -> schedule 0%")
    assert.strictEqual(kpiAdmin.result_rating, 5, "shared formula: rating preserved")
    assert.strictEqual(kpiAdmin.final_score, 7.0, "shared formula: 10*0.7*1.0 = 7.0")
    ok("KPI score computed by the shared _kpi-formula.cjs module (backend path parity)")

    // ================================================================ H2
    console.log("\nH2 — fail-closed scope: user without a loadable role is narrowed to personal:")
    const tokenNoRole = await loginUser(baseUrl, noRole.email)

    const plans0 = await list("plans", tokenNoRole)
    assert.strictEqual(plans0.length, 0, `no-role user must see 0 plans (personal, fail-closed) — got ${plans0.length}`)
    const tasks0 = await list("tasks", tokenNoRole)
    assert.strictEqual(tasks0.length, 0, `no-role user must see 0 tasks — got ${tasks0.length}`)
    const viewPlanA0 = await http(baseUrl, "GET", `/api/collections/plans/records/${planA.id}`, { token: tokenNoRole })
    assert.strictEqual(viewPlanA0.status, 404, "no-role user direct-view of a plan they don't lead must be 404")
    ok("user with no role_id sees nothing (personal scope, NOT 'all')")

    // M4: comments / proposals / kpi_scores scope through their related task — with no
    // task in scope the user must see none of them (and direct views must 404)
    const comments0 = await list("comments", tokenNoRole)
    assert.strictEqual(comments0.length, 0, `no-role user must see 0 comments (M4) — got ${comments0.length}`)
    const props0 = await list("proposals", tokenNoRole)
    assert.strictEqual(props0.length, 0, `no-role user must see 0 proposals (M4) — got ${props0.length}`)
    const kpis0 = await list("kpi_scores", tokenNoRole)
    assert.strictEqual(kpis0.length, 0, `no-role user must see 0 kpi_scores (M4) — got ${kpis0.length}`)
    const viewCommentA0 = await http(baseUrl, "GET", `/api/collections/comments/records/${commentA.id}`, { token: tokenNoRole })
    assert.strictEqual(viewCommentA0.status, 404, "no-role direct view of a comment on an out-of-scope task must be 404 (M4)")
    const viewPropA0 = await http(baseUrl, "GET", `/api/collections/proposals/records/${propA.id}`, { token: tokenNoRole })
    assert.strictEqual(viewPropA0.status, 404, "no-role direct view of a proposal on an out-of-scope task must be 404 (M4)")
    const viewKpiA0 = await http(baseUrl, "GET", `/api/collections/kpi_scores/records/${kpiAdmin.id}`, { token: tokenNoRole })
    assert.strictEqual(viewKpiA0.status, 404, "no-role direct view of a KPI of an out-of-scope task must be 404 (M4)")
    ok("M4: no-role user sees no comments / proposals / kpi_scores (scoped via task)")

    // control: once they lead a plan, they see exactly that plan — and STILL not planA
    // (planA is in the SAME department, so this proves scope is personal, not department)
    await expectOk(baseUrl, "PATCH", `/api/collections/plans/records/${planC.id}`, { token: tokenAdmin, body: { leader_id: noRole.id } })
    const plans1 = await list("plans", tokenNoRole)
    assert.deepStrictEqual(idsOf(plans1), [planC.id], `plan leader must see exactly their own plan — got ${JSON.stringify(idsOf(plans1))}`)
    const tasks1 = await list("tasks", tokenNoRole)
    // plan leader sees every task of their own plan (taskC + the two H1-created planC tasks)
    assert.deepStrictEqual(idsOf(tasks1), [taskC.id, forged.id, adminTask.id].sort(),
      "plan leader sees the tasks of their own plan only")
    const viewPlanA1 = await http(baseUrl, "GET", `/api/collections/plans/records/${planA.id}`, { token: tokenNoRole })
    assert.strictEqual(viewPlanA1.status, 404, "same-dept plan led by someone else must stay invisible (personal, not department)")
    ok("after becoming plan leader: sees only own plan + its tasks; same-dept plan stays 404 (personal scope)")

    // M4: the plan leader now sees exactly the comments / proposals / kpi_scores of
    // their own plan's tasks — and a comment on the same-dept out-of-scope plan stays 404
    const comments1 = await list("comments", tokenNoRole)
    assert.deepStrictEqual(idsOf(comments1), [commentC.id], `plan leader sees only own-plan comments (M4) — got ${JSON.stringify(idsOf(comments1))}`)
    const props1 = await list("proposals", tokenNoRole)
    assert.deepStrictEqual(idsOf(props1), [propC.id], `plan leader sees only own-plan proposals (M4) — got ${JSON.stringify(idsOf(props1))}`)
    const kpis1 = await list("kpi_scores", tokenNoRole)
    assert.deepStrictEqual(idsOf(kpis1), [kpiAdmin.id], `plan leader sees only own-plan KPI scores (M4) — got ${JSON.stringify(idsOf(kpis1))}`)
    const viewCommentA1 = await http(baseUrl, "GET", `/api/collections/comments/records/${commentA.id}`, { token: tokenNoRole })
    assert.strictEqual(viewCommentA1.status, 404, "comment on same-dept out-of-scope task stays 404 (M4 — personal, not department)")
    ok("M4: plan leader sees comments / proposals / kpi_scores of own plan's tasks only")

    // role LOST: role was view_scope="all" -> after losing it, user must NOT see everything
    const tokenTemp = await loginUser(baseUrl, tempUser.email)
    const plansTempBefore = await list("plans", tokenTemp)
    assert.ok(plansTempBefore.length >= 3, `temp role (view_scope=all) must see all seeded plans before loss — got ${plansTempBefore.length}`)
    ok("control: while role loads with view_scope=all, user sees everything")

    const delRole = await http(baseUrl, "DELETE", `/api/collections/roles/records/${roleTempAll.id}`, { token: tokenAdmin })
    let roleLostHow
    if (delRole.status === 204) {
      roleLostHow = "role record deleted -> dangling role_id"
    } else {
      // PB refuses to delete a record referenced by a relation (role_id has no cascade):
      // simulate the same end state the fix targets by clearing the assignment.
      await expectOk(baseUrl, "PATCH", `/api/collections/users/records/${tempUser.id}`, { token: tokenAdmin, body: { role_id: "" } })
      roleLostHow = "PB blocked referenced-role delete -> role_id cleared instead"
    }
    console.log("    role-lost mechanism: " + roleLostHow)

    const plansTempAfter = await list("plans", tokenTemp)
    assert.strictEqual(plansTempAfter.length, 0, `after role loss the user must NOT see all plans — got ${plansTempAfter.length}`)
    const viewPlanTemp = await http(baseUrl, "GET", `/api/collections/plans/records/${planA.id}`, { token: tokenTemp })
    assert.strictEqual(viewPlanTemp.status, 404, "direct view after role loss must be 404 (fail-closed personal)")
    ok("after losing a view_scope=all role, user is narrowed to personal (H2 fail-closed)")

    // ================================================================ H3
    console.log("\nH3 — disabled accounts are blocked server-side on every request:")
    const tokenDisabled = await loginUser(baseUrl, disabledUser.email) // login itself is not blocked; the check is per-request
    assert.ok(tokenDisabled, "login for a disabled account still issues a token (block happens per request)")

    for (const coll of ["tasks", "plans", "departments"]) {
      const r = await http(baseUrl, "GET", `/api/collections/${coll}/records`, { token: tokenDisabled })
      assert.strictEqual(r.status, 403, `disabled ${coll} list must be 403 (got ${r.status})`)
    }
    ok("disabled account blocked on list (scoped + unscoped collections)")

    const viewDisabled = await http(baseUrl, "GET", `/api/collections/tasks/records/${taskC.id}`, { token: tokenDisabled })
    assert.strictEqual(viewDisabled.status, 403, "disabled direct view must be 403 (got " + viewDisabled.status + ")")
    ok("disabled account blocked on direct view")

    const createDisabled = await http(baseUrl, "POST", "/api/collections/tasks/records", {
      token: tokenDisabled,
      body: { name: "H1 disabled create", plan_id: planC.id, category: "normal", host_dept_id: deptA.id, executor_id: disabledUser.id, supervisor_id: userA.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "not_started", is_recurring: false },
    })
    assert.strictEqual(createDisabled.status, 403, "disabled create must be 403 (rule passes, guard throws) — got " + createDisabled.status)
    ok("disabled account blocked on create (rule passes, ensureEnabled throws)")

    const updateDisabled = await http(baseUrl, "PATCH", `/api/collections/tasks/records/${taskC.id}`, { token: tokenDisabled, body: { status: "in_progress" } })
    assert.strictEqual(updateDisabled.status, 403, "disabled update must be 403 (executor rule passes, guard throws) — got " + updateDisabled.status)
    ok("disabled account blocked on update (executor rule passes, ensureEnabled throws)")

    const controlList = await http(baseUrl, "GET", "/api/collections/tasks/records", { token: tokenA })
    assert.strictEqual(controlList.status, 200, "enabled user still lists tasks fine (control)")
    ok("enabled account unaffected (control)")

    // custom endpoints must also reject disabled accounts — even endpoints the account
    // would otherwise be ALLOWED to call (owner upsert, user heartbeat), proving the
    // block comes from ensureEnabled and not from a coincidental role/manager gate
    const expectCustom403 = async (method, p, body) => {
      const r = await http(baseUrl, method, p, { token: tokenDisabled, body })
      assert.strictEqual(r.status, 403, `disabled ${method} ${p} must be 403 (ensureEnabled) — got ${r.status} ${JSON.stringify(r.data)?.slice(0, 120)}`)
    }
    // owner path: as the profile owner this call would succeed if the account were enabled
    await expectCustom403("POST", "/api/custom/upsert-employee-profile", { userId: disabledUser.id })
    // user-level presence endpoint: any authenticated user may send a heartbeat
    await expectCustom403("POST", "/api/custom/presence/heartbeat", { device_info: "h3-disabled" })
    // manager-gated endpoints (ensureEnabled runs BEFORE the isManager gate)
    await expectCustom403("POST", "/api/custom/recalc-kpi", undefined)
    await expectCustom403("GET", "/api/custom/presence/present", undefined)
    await expectCustom403("GET", "/api/custom/presence/campaigns", undefined)
    ok("disabled account blocked on custom endpoints (recalc-kpi / upsert-employee-profile / presence)")

    // controls — the SAME endpoints respond normally for enabled users, so the 403
    // above is the disabled gate, not a broken handler
    const hb = await http(baseUrl, "POST", "/api/custom/presence/heartbeat", { token: tokenA, body: { device_info: "h3-control" } })
    assert.strictEqual(hb.status, 200, "enabled user heartbeat must be 200 (got " + hb.status + ")")
    const upOk = await http(baseUrl, "POST", "/api/custom/upsert-employee-profile", { token: tokenA, body: { userId: userA.id, phone: "0900000099" } })
    assert.strictEqual(upOk.status, 200, "enabled owner upsert-employee-profile must be 200 (got " + upOk.status + ")")
    const presentOk = await http(baseUrl, "GET", "/api/custom/presence/present", { token: tokenAdmin })
    assert.strictEqual(presentOk.status, 200, "enabled manager present must be 200 (got " + presentOk.status + ")")
    const recalcOk = await http(baseUrl, "POST", "/api/custom/recalc-kpi", { token: tokenAdmin })
    assert.strictEqual(recalcOk.status, 200, "enabled manager recalc-kpi must be 200 (got " + recalcOk.status + ")")
    ok("custom endpoints work for enabled accounts (controls)")

    // ================================================================ H4
    console.log("\nH4 — merged scope handler still enforces view_scope on HR collections:")
    const tokenHrA = await loginUser(baseUrl, hrA.email)
    const salA = await list("salary_records", tokenHrA)
    assert.deepStrictEqual(idsOf(salA), [salaryA.id], `dept-scoped HR must see only own-dept salary — got ${JSON.stringify(idsOf(salA))}`)
    const viewSalaryB = await http(baseUrl, "GET", `/api/collections/salary_records/records/${salaryB.id}`, { token: tokenHrA })
    assert.strictEqual(viewSalaryB.status, 404, "dept-scoped HR direct view of out-of-dept salary must be 404")
    ok("salary_records scoped by department for can_view_salary holder (H4 merge)")

    const profA = await list("employee_profiles", tokenHrA)
    const profIdsA = idsOf(profA)
    assert(profIdsA.includes(profileA.id) && !profIdsA.includes(profileB.id),
      `dept-scoped HR must see own-dept profile only — got ${JSON.stringify(profIdsA)}`)
    const viewProfileB = await http(baseUrl, "GET", `/api/collections/employee_profiles/records/${profileB.id}`, { token: tokenHrA })
    assert.strictEqual(viewProfileB.status, 404, "dept-scoped HR direct view of out-of-dept profile must be 404")
    ok("employee_profiles scoped by department (second HR collection in the merged handler)")

    const tokenHrAll = await loginUser(baseUrl, hrAll.email)
    const salAll = await list("salary_records", tokenHrAll)
    const salAllIds = idsOf(salAll)
    assert(salAllIds.includes(salaryA.id) && salAllIds.includes(salaryB.id),
      `view_scope=all HR must see both seeded salaries — got ${JSON.stringify(salAllIds)}`)
    ok("view_scope=all HR sees all salary records")

    // the merge must NOT have dropped the original plans/tasks scoping (still one handler)
    const plansA = await list("plans", tokenA)
    const planIdsA = idsOf(plansA)
    assert(planIdsA.includes(planA.id) && planIdsA.includes(planC.id) && !planIdsA.includes(planB.id),
      `dept-scoped employee plans list must keep working after H4 merge — got ${JSON.stringify(planIdsA)}`)
    ok("plans/tasks scoping still enforced after the H4 merge (handler not dropped)")

    // M4: the same task-scoped filtering still holds for comments / proposals / kpi_scores
    // after the H4 merge (dept-scoped user sees own-dept plans' tasks only)
    const commentsA = await list("comments", tokenA)
    assert.deepStrictEqual(idsOf(commentsA), [commentA.id, commentC.id].sort(),
      `dept-scoped user sees comments of own-dept plans' tasks only (M4) — got ${JSON.stringify(idsOf(commentsA))}`)
    const propsA = await list("proposals", tokenA)
    assert.deepStrictEqual(idsOf(propsA), [propA.id, propC.id].sort(),
      `dept-scoped user sees proposals of own-dept plans' tasks only (M4) — got ${JSON.stringify(idsOf(propsA))}`)
    const kpisA = await list("kpi_scores", tokenA)
    assert.deepStrictEqual(idsOf(kpisA), [kpiAdmin.id],
      `dept-scoped user sees KPI of own-dept plans' tasks only (M4) — got ${JSON.stringify(idsOf(kpisA))}`)
    const viewCommentB = await http(baseUrl, "GET", `/api/collections/comments/records/${commentB.id}`, { token: tokenA })
    assert.strictEqual(viewCommentB.status, 404, "comment on out-of-dept task stays 404 (M4)")
    ok("M4: dept-scoped user sees comments / proposals / kpi_scores through own plans' tasks only")

    // rules still gate HR reads for non-HR users (rule layer intact)
    // PB 0.39 denies a failed listRule silently: HTTP 200 with an empty result.
    const noSal = await http(baseUrl, "GET", "/api/collections/salary_records/records", { token: tokenA })
    assert.strictEqual(noSal.status, 200, "non-HR salary list expected 200 (silent deny)")
    assert.strictEqual(noSal.data.totalItems, 0, "non-HR user must receive an EMPTY salary list (rule layer intact)")
    ok("non-HR user gets an empty salary_records list (listRule silent deny)")

    // ================================================================ M1
    console.log("\nM1 — check_in/check_out are server-stamped, never client-supplied:")
    // deterministic status: a config with start 00:00 + 0 tolerance makes ANY real clock-in "late"
    await c("attendance_configs", { office_name: "H1 Office", wifi_ssid: "h1-wifi", work_start_time: "00:00", work_end_time: "23:59", late_tolerance_minutes: 0, allowed_ips: [], is_active: true })
    // the createRule (evaluated BEFORE hooks) rejects creating a log bound to someone else —
    // user_id must be the actor's own id for the rule to pass; the guard then re-binds it
    const forgeOther = await http(baseUrl, "POST", "/api/collections/attendance_logs/records", {
      token: tokenA,
      body: { user_id: userB.id, check_in: "2000-01-01 00:00:00.000Z", status: "on_time", method: "wifi" },
    })
    assert.strictEqual(forgeOther.status, 400, "cannot create a check-in log for another user (rule layer) — got " + forgeOther.status)
    ok("cannot create a check-in bound to another user (C8 owner-binding rule)")

    const forgedIn = await expectOk(baseUrl, "POST", "/api/collections/attendance_logs/records", {
      token: tokenA,
      body: { user_id: userA.id, check_in: "2000-01-01 00:00:00.000Z", status: "on_time", method: "wifi", ip_address: "8.8.8.8" },
    })
    assert.strictEqual(forgedIn.user_id, userA.id, "M1: user_id stays bound to the actor (got " + forgedIn.user_id + ")")
    assert.ok(forgedIn.check_in, "M1: check_in must be present (got " + forgedIn.check_in + ")")
    assert.notStrictEqual(forgedIn.check_in, "2000-01-01 00:00:00.000Z", "M1: backdated check_in must be overwritten by the server stamp")
    assert.ok(Math.abs(new Date(forgedIn.check_in).getTime() - Date.now()) < 60000, "M1: check_in ≈ server now (got " + forgedIn.check_in + ")")
    assert.strictEqual(forgedIn.status, "late", "M1: status computed from the server check_in, client's 'on_time' ignored (got " + forgedIn.status + ")")
    assert.notStrictEqual(forgedIn.ip_address, "8.8.8.8", "M1: forged public ip_address not trusted")
    ok("check-in: forged check_in / status / ip all overridden by the server (M1)")

    // owner may only set check_out — and it too is server-stamped
    const forgedOut = await expectOk(baseUrl, "PATCH", `/api/collections/attendance_logs/records/${forgedIn.id}`, {
      token: tokenA,
      body: { check_out: "2000-01-01 00:00:00.000Z" },
    })
    assert.ok(forgedOut.check_out, "M1: check_out must be present (got " + forgedOut.check_out + ")")
    assert.notStrictEqual(forgedOut.check_out, "2000-01-01 00:00:00.000Z", "M1: backdated check_out must be overwritten")
    assert.ok(Math.abs(new Date(forgedOut.check_out).getTime() - Date.now()) < 60000, "M1: check_out ≈ server now (got " + forgedOut.check_out + ")")
    ok("check-out: backdated check_out ignored, server stamp used (M1)")

    const rewriteIn = await http(baseUrl, "PATCH", `/api/collections/attendance_logs/records/${forgedIn.id}`, { token: tokenA, body: { check_in: "2026-01-01 00:00:00.000Z" } })
    assert.strictEqual(rewriteIn.status, 403, "M1: owner cannot rewrite check_in (got " + rewriteIn.status + ")")
    ok("owner cannot rewrite check_in after the fact (M1)")

    // ================================================================ M8
    console.log("\nM8 — completed_at is server-stamped on the transition into completed:")
    // supervisor approves with a forged backdated stamp -> overwritten with server now
    const supDone = await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${taskA.id}`, {
      token: tokenA, // userA is supervisor_id of taskA
      body: { status: "completed", completed_at: "2000-01-01 00:00:00.000Z", rating: 5, rated_by_id: userB.id, rated_at: "2026-01-02 00:00:00.000Z" },
    })
    assert.ok(supDone.completed_at, "M8: completed_at must be present after completing (got " + supDone.completed_at + ")")
    assert.notStrictEqual(supDone.completed_at, "2000-01-01 00:00:00.000Z", "M8: backdated completed_at must be overwritten")
    assert.ok(Math.abs(new Date(supDone.completed_at).getTime() - Date.now()) < 60000, "M8: completed_at ≈ server now (got " + supDone.completed_at + ")")
    ok("supervisor completing a task: backdated completed_at ignored, server stamp used (M8)")

    // can_manage PATCH: the bypass must not become a backdating loophole
    const taskB2 = await c("tasks", { name: "H1 Task B2", plan_id: planB.id, category: "normal", host_dept_id: deptB.id, executor_id: userB.id, supervisor_id: userB.id, collaborator_ids: [], start_date: "2026-01-01 00:00:00.000Z", deadline: "2026-06-30 00:00:00.000Z", status: "in_progress", is_recurring: false })
    const mgrDone = await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${taskB2.id}`, {
      token: tokenAdmin,
      body: { status: "completed", completed_at: "2000-01-01 00:00:00.000Z" },
    })
    assert.ok(mgrDone.completed_at, "M8: can_manage transition must be stamped (got " + mgrDone.completed_at + ")")
    assert.notStrictEqual(mgrDone.completed_at, "2000-01-01 00:00:00.000Z", "M8: can_manage backdated stamp must be overwritten")
    assert.ok(Math.abs(new Date(mgrDone.completed_at).getTime() - Date.now()) < 60000, "M8: can_manage stamp ≈ server now (got " + mgrDone.completed_at + ")")
    ok("can_manage completing a task: server stamps completed_at too (M8 bypass closed)")

    // leaving completed clears the stamp
    const mgrUn = await expectOk(baseUrl, "PATCH", `/api/collections/tasks/records/${taskB2.id}`, { token: tokenAdmin, body: { status: "cancelled" } })
    assert.ok(!mgrUn.completed_at, "M8: leaving completed clears the stamp (got " + mgrUn.completed_at + ")")
    ok("leaving completed clears completed_at (M8)")
  } finally {
    if (CONTAINER_MODE) {
      try { execFileSync("podman", ["rm", "-f", containerName], { stdio: "pipe" }) } catch { /* ignore */ }
    } else {
      try { if (childToKill.exitCode === null) childToKill.kill() } catch { /* ignore */ }
      await sleep(500)
      try { fs.closeSync(fd) } catch { /* ignore */ }
    }
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  console.log(`\nALL ${passed} TESTS PASSED`)
}

main().catch((err) => { console.error("\nFAILED:", err && err.message ? err.message : err); process.exit(1) })
