/// <reference path="../pb_data/types.d.ts" />
// Integration test — real PocketBase (0.39.10) + the real pb_hooks, on a FRESH data dir
// whose schema comes from the repo's own migration chain (same bootstrap as CI/deploy).
//
// WHAT THIS PINS DOWN — the `roles` collection is a permission lookup table, so exposing
// it to every logged-in account leaks the whole authorisation model: which role holds
// can_view_salary / can_manage / which view_scope. `roles` is therefore restricted to
// can_manage holders (plus the superuser escape hatch).
//
// THE TRAP THIS TEST EXISTS TO CATCH
//   Every permission flag in the web app is derived from ONE call:
//     pb.collection("users").getOne(ownId, { expand: "department_id,role_id,group_ids" })
//   and then `user.expand.role_id.can_view_salary` / `.can_manage`
//   (Sidebar.tsx, HRPage, HRDetailPage, LeavePage, AdminPage, DataPage, LogsPage,
//    TrashPage, DiscussionPage, DashboardPage, mobile/*).
//   This test was written BEFORE the rule was tightened, and it caught the bug in the
//   obvious design: PocketBase DOES apply the `roles` viewRule to expanded records, so
//   locking viewRule to can_manage-only emptied `expand.role_id` for every non-admin —
//   the UI would have lost all permissions while every frontend unit test stayed green.
//   Hence the split rule: listRule = can_manage only (closes the enumeration leak),
//   viewRule = own role OR can_manage (keeps the permission model alive).
//   R1/R2 pin the surviving expand path; R3–R7 pin the restriction; R8–R10 pin the
//   /api/custom/role-directory support endpoint that keeps HRPage's filter working.
//
// Run:  PB_EXE=... node backend/test/roles_rule.test.js   (expect "ALL N TESTS PASSED")

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
const SU_EMAIL = "it-roles@example.com"
const SU_PASS = "TestPass123!"

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

// ------------------------------------------------------------ bootstrap
async function bootstrap(tmp, port) {
  const dataDir = path.join(tmp, "data")
  const hooksDir = path.join(tmp, "hooks")
  fs.mkdirSync(dataDir, { recursive: true })
  fs.cpSync(HOOKS, hooksDir, { recursive: true })

  execFileSync(EXE, ["superuser", "upsert", SU_EMAIL, SU_PASS, `--dir=${dataDir}`], { stdio: "pipe" })

  const logFile = path.join(tmp, "server.log")
  const child = startServer(dataDir, hooksDir, port, logFile)
  const baseUrl = `http://127.0.0.1:${port}`
  await waitHealth(baseUrl, child)

  const su = await http(baseUrl, "POST", "/api/collections/_superusers/auth-with-password",
    { body: { identity: SU_EMAIL, password: SU_PASS } })
  assert.strictEqual(su.status, 200, `superuser login failed: ${JSON.stringify(su.data)?.slice(0, 300)}`)
  return { baseUrl, adminToken: su.data.token, child, logFile }
}

async function seed(baseUrl, adminToken) {
  const c = async (coll, body) => {
    const r = await http(baseUrl, "POST", `/api/collections/${coll}/records`, { token: adminToken, body })
    assert.strictEqual(r.status, 200, `seed ${coll} failed: HTTP ${r.status} ${JSON.stringify(r.data)?.slice(0, 300)}`)
    return r.data
  }
  const roleAdmin = await c("roles", {
    code: "ADMIN", name: "Admin", level: "leadership", view_scope: "all",
    can_manage: true, can_add_plans: true, can_add_tasks: true, can_edit_plans: true, can_edit_tasks: true,
  })
  const roleHr = await c("roles", {
    code: "HR", name: "HR Officer", level: "management", view_scope: "department",
    can_view_salary: true, can_approve_leave: true,
  })
  const roleEmp = await c("roles", {
    code: "EMP", name: "Employee", level: "employee", view_scope: "personal",
    can_add_plans: true, can_add_tasks: true, can_edit_plans: true, can_edit_tasks: true,
  })
  const mkUser = (email, name, roleId) =>
    c("users", { email, password: SU_PASS, passwordConfirm: SU_PASS, name, verified: true, role_id: roleId })

  const emp = await mkUser("emp-r@test.local", "Employee User", roleEmp.id)
  const hr = await mkUser("hr-r@test.local", "HR User", roleHr.id)
  const admin = await mkUser("admin-r@test.local", "Admin User", roleAdmin.id)
  return { roleAdmin, roleHr, roleEmp, emp, hr, admin }
}

async function loginUser(baseUrl, email) {
  const r = await http(baseUrl, "POST", "/api/collections/users/auth-with-password",
    { body: { identity: email, password: SU_PASS } })
  assert.strictEqual(r.status, 200, `login ${email} failed: ${JSON.stringify(r.data)?.slice(0, 300)}`)
  return r.data.token
}

// A denied list must not carry ANY role record. PocketBase can answer this either way:
// 403 when the rule short-circuits, or 200 with an empty page when the rule is applied as
// a relation filter — both are safe, only "records present" is a leak.
function assertNoRoleRecord(res, who, what) {
  const leak = res.data && (res.data.id || res.data.code || res.data.can_view_salary !== undefined)
  assert(!leak,
    `${who} read the ${what} record (HTTP ${res.status}): ` + JSON.stringify(res.data).slice(0, 300) +
    ` — the own-role allowance is too broad`)
}

function assertNoRoleLeak(res, who) {
  const items = res.data && res.data.items
  const count = Array.isArray(items) ? items.length : 0
  assert.strictEqual(count, 0,
    `${who} received ${count} role record(s) via list (HTTP ${res.status}) — permission bits leaked: ` +
    JSON.stringify(items).slice(0, 300))
  const total = res.data && res.data.totalItems
  assert(!(typeof total === "number" && total > 0),
    `${who} list response reports totalItems=${total} although no record is readable`)
}

// ------------------------------------------------------------------- main
let passed = 0
function ok(name) { passed++; console.log("  ✓ " + name) }

async function main() {
  assert(fs.existsSync(EXE), `pocketbase executable not found: ${EXE}`)

  const tmps = []
  let child = null
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pb-it-roles-"))
    tmps.push(tmp)
    const port = 18000 + Math.floor(Math.random() * 4000)
    const boot = await bootstrap(tmp, port)
    child = boot.child
    const ids = await seed(boot.baseUrl, boot.adminToken)

    const tEmp = await loginUser(boot.baseUrl, ids.emp.email)
    const tHr = await loginUser(boot.baseUrl, ids.hr.email)
    const tAdmin = await loginUser(boot.baseUrl, ids.admin.email)

    console.log("\nroles collection — read restriction:")

    // R1 — THE load-bearing assertion. An employee must still receive their OWN role
    // flags through expand, otherwise the entire client-side permission model dies
    // (Sidebar HR menu, HRPage, LeavePage approval gating, AdminPage tabs…).
    const ownEmp = await http(boot.baseUrl, "GET", `/api/collections/users/records/${ids.emp.id}?expand=role_id`, { token: tEmp })
    assert.strictEqual(ownEmp.status, 200, `employee could not read own user record: HTTP ${ownEmp.status}`)
    const empRole = ownEmp.data?.expand?.role_id
    assert(empRole, "expand.role_id missing on own users record — frontend permissions would break")
    assert.strictEqual(empRole.can_add_tasks, true, "expand.role_id.can_add_tasks not delivered")
    assert.strictEqual(empRole.can_manage, false, "expand.role_id.can_manage should be false for an employee")
    ok("R1 employee still reads own role flags via users.expand.role_id")

    // R2 — same for the HR officer, whose UI gating depends on can_view_salary being
    // readable through expand even though she may not list the roles collection.
    const ownHr = await http(boot.baseUrl, "GET", `/api/collections/users/records/${ids.hr.id}?expand=role_id`, { token: tHr })
    assert.strictEqual(ownHr.status, 200, `HR could not read own user record: HTTP ${ownHr.status}`)
    const hrRole = ownHr.data?.expand?.role_id
    assert(hrRole, "expand.role_id missing for HR user")
    assert.strictEqual(hrRole.can_view_salary, true, "expand.role_id.can_view_salary not delivered to HR user")
    ok("R2 HR officer still reads own can_view_salary via users.expand.role_id")

    // R3 — the leak itself: a regular employee must not be able to enumerate the
    // permission table.
    // NOTE ON THE ASSERTION: a listRule that resolves through a relation
    // (@request.auth.role_id.can_manage) does NOT make PocketBase answer 403 — it applies
    // the rule as a filter and answers 200 with an empty page. So the property worth
    // pinning is the security one, "no role record reaches the caller", not the status
    // code. Asserting the status alone would have passed on a leaking 200 and failed on a
    // correctly-locked 200-with-no-rows.
    const listEmp = await http(boot.baseUrl, "GET", "/api/collections/roles/records?perPage=200", { token: tEmp })
    assertNoRoleLeak(listEmp, "employee", tEmp)
    ok(`R3 employee blocked from roles list (HTTP ${listEmp.status}, ${Array.isArray(listEmp.data?.items) ? listEmp.data.items.length : 0} items)`)

    // R4 — HR officer holds can_view_salary but NOT can_manage: she must still be blocked,
    // otherwise tightening the rule buys nothing for the most likely probing account.
    const listHr = await http(boot.baseUrl, "GET", "/api/collections/roles/records?perPage=200", { token: tHr })
    assertNoRoleLeak(listHr, "HR officer", tHr)
    ok(`R4 HR officer blocked from roles list (HTTP ${listHr.status}, ${Array.isArray(listHr.data?.items) ? listHr.data.items.length : 0} items)`)

    // R5 — the rule must not lock admins out of their own RoleManager screen.
    const listAdmin = await http(boot.baseUrl, "GET", "/api/collections/roles/records?perPage=200", { token: tAdmin })
    assert.strictEqual(listAdmin.status, 200, `can_manage admin blocked from roles list: HTTP ${listAdmin.status} ${JSON.stringify(listAdmin.data)?.slice(0, 200)}`)
    const adminCodes = (listAdmin.data?.items || []).map((r) => r.code).sort()
    assert.deepStrictEqual(adminCodes, ["ADMIN", "EMP", "HR"], `admin must see all 3 roles, got ${JSON.stringify(adminCodes)}`)
    ok("R5 can_manage admin still reads the full roles table")

    // R6 — superuser escape hatch keeps admin scripts / sync-schema working.
    const listSu = await http(boot.baseUrl, "GET", "/api/collections/roles/records?perPage=200", { token: boot.adminToken })
    assert.strictEqual(listSu.status, 200, `superuser blocked from roles list: HTTP ${listSu.status}`)
    ok("R6 superuser still reads the roles table")

    // R7 — the `own role` allowance on viewRule must be narrow: an employee may read
    // exactly one role record (their own, which the UI needs) and nothing else. Without
    // this the allowance would become a second enumeration path via getOne.
    const ownRole = await http(boot.baseUrl, "GET", `/api/collections/roles/records/${ids.roleEmp.id}`, { token: tEmp })
    assert.strictEqual(ownRole.status, 200, `employee must be able to read their OWN role: HTTP ${ownRole.status}`)

    const otherRole = await http(boot.baseUrl, "GET", `/api/collections/roles/records/${ids.roleHr.id}`, { token: tEmp })
    assertNoRoleRecord(otherRole, "employee", "HR role")

    const otherRoleHr = await http(boot.baseUrl, "GET", `/api/collections/roles/records/${ids.roleAdmin.id}`, { token: tHr })
    assertNoRoleRecord(otherRoleHr, "HR officer", "admin role")
    ok("R7 own role readable, other roles not — employee and HR both blocked on getOne")

    // ---- /api/custom/role-directory: the S1 support endpoint ------------------
    // HRPage's "lọc theo chức vụ" dropdown needs the role list, but an HR officer can no
    // longer list `roles` after S1. The directory endpoint serves that slice WITHOUT the
    // permission bits — which is the whole point, so R8 pins the absent fields by name.

    // R8 — HR officer may read the directory (else her filter dropdown is dead) …
    const dirHr = await http(boot.baseUrl, "GET", "/api/custom/role-directory", { token: tHr })
    assert.strictEqual(dirHr.status, 200, `HR officer blocked from role-directory: HTTP ${dirHr.status}`)
    const dirItems = dirHr.data?.items
    assert(Array.isArray(dirItems) && dirItems.length === 3,
      `role-directory must list all 3 roles for an HR officer, got ${dirItems?.length}`)

    // … and NOT ONE permission bit may appear in the payload. This is the assertion that
    // keeps the support endpoint from quietly re-opening the leak S1 closed.
    const FORBIDDEN_KEYS = [
      "can_view_salary", "can_manage", "can_approve_leave",
      "can_add_plans", "can_edit_plans", "can_delete_plans",
      "can_add_tasks", "can_edit_tasks", "can_delete_tasks",
      "view_scope", "approval_scope", "rank", "description",
    ]
    for (const item of dirItems) {
      for (const k of FORBIDDEN_KEYS) {
        assert(!(k in item),
          `role-directory leaks "${k}" for role ${item.code} — the support endpoint must expose only id/code/name/level`)
      }
      assert.deepStrictEqual(Object.keys(item).sort(), ["code", "id", "level", "name"],
        `unexpected shape for role ${item.code}: ${Object.keys(item).sort().join(",")}`)
    }
    ok(`R8 role-directory readable by HR officer and exposes no permission bit (${dirItems.length} roles)`)

    // R9 — a plain employee has no business reading it either: they cannot open /hr.
    const dirEmp = await http(boot.baseUrl, "GET", "/api/custom/role-directory", { token: tEmp })
    assert.notStrictEqual(dirEmp.status, 200, `plain employee can read role-directory (HTTP ${dirEmp.status})`)
    assert(!dirEmp.data?.items, "denied role-directory response must not carry items")
    ok(`R9 plain employee blocked from role-directory (HTTP ${dirEmp.status})`)

    // R10 — admin/superuser path used by tooling stays open.
    const dirAdmin = await http(boot.baseUrl, "GET", "/api/custom/role-directory", { token: tAdmin })
    assert.strictEqual(dirAdmin.status, 200, `admin blocked from role-directory: HTTP ${dirAdmin.status}`)
    assert.strictEqual(dirAdmin.data?.items?.length, 3, "admin should get the same 3 roles")
    const dirSu = await http(boot.baseUrl, "GET", "/api/custom/role-directory", { token: boot.adminToken })
    assert.strictEqual(dirSu.status, 200, `superuser blocked from role-directory: HTTP ${dirSu.status}`)
    ok("R10 admin and superuser read role-directory")
  } finally {
    await stopServer(child)
    for (const t of tmps) { try { fs.rmSync(t, { recursive: true, force: true }) } catch { /* ignore */ } }
  }

  console.log(`\nALL ${passed} TESTS PASSED`)
}

main().catch((err) => {
  console.error("\nFAILED:", err && err.message ? err.message : err)
  process.exit(1)
})
