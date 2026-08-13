// Probe: is state shared between two pb_hooks FILES in PocketBase 0.39?
//
// Empirical findings that shaped this probe (all verified against the real exe):
//   - A top-level `var S = require(...)` whose value is referenced inside a handler
//     crashes the request (handler closures do not survive file load). Every handler
//     must require() the module itself.
//   - require() inside a handler works, and mutating the module's exports works.
//
// So the remaining question: when FILE A and FILE B each require() the SAME module
// inside their handlers, do they get the same module instance (shared state) or
// separate copies (isolated)?
//
// Setup: fresh hooks dir with ONLY probe files (no event shadowing). pb_data copied
// from the real app, superuser upserted, throwaway collection created via API.
//
// Run:  node backend/test/state_share_probe.js

"use strict"
const { spawn, execFileSync } = require("child_process")
const path = require("path")
const fs = require("fs")
const os = require("os")
const assert = require("assert")

const ROOT = path.join(__dirname, "..")
const EXE = process.env.PB_EXE || path.join(ROOT, "pocketbase.exe")
const ADMIN_EMAIL = "it-share-probe@example.com"
const ADMIN_PASS = "TestPass123!"

const STATE_SRC = `module.exports = { holder: { captured: "EMPTY" } }
`

const A_SRC = `onRecordCreateRequest(function(e) {
  var S = require(__hooks + "/state.js")
  if (e.collection && e.collection.name !== "probe_col") return e.next()
  S.holder.captured = "SET_BY_A"
  globalThis.__A_MARK = "A_SET"
  return e.next()
})
`

const B_SRC = `onRecordAfterCreateSuccess(function(e) {
  var S = require(__hooks + "/state.js")
  var coll = null
  try { coll = e.record && e.record.collection ? e.record.collection() : null } catch (ex) { coll = null }
  var cname = coll ? coll.name : String(coll)
  if (cname !== "probe_col") return
  var g = typeof globalThis.__A_MARK !== "undefined" ? String(globalThis.__A_MARK) : "UNDEF"
  console.log("ZZ_AFTER state=" + S.holder.captured + " glob=" + g)
})
routerAdd("GET", "/probe", function(c) {
  var S = require(__hooks + "/state.js")
  var g = typeof globalThis.__A_MARK !== "undefined" ? String(globalThis.__A_MARK) : "UNDEF"
  return c.json(200, { moduleState: S.holder.captured, globalMark: g })
})
`

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
  assert(fs.existsSync(path.join(ROOT, "pb_data", "data.db")), "pb_data/data.db missing")

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pb-share-"))
  const dataDir = path.join(tmp, "data")
  const hooksDir = path.join(tmp, "hooks")
  const logFile = path.join(tmp, "server.log")
  fs.cpSync(path.join(ROOT, "pb_data"), dataDir, { recursive: true })
  fs.mkdirSync(hooksDir, { recursive: true })
  fs.writeFileSync(path.join(hooksDir, "state.js"), STATE_SRC)
  fs.writeFileSync(path.join(hooksDir, "a.pb.js"), A_SRC)
  fs.writeFileSync(path.join(hooksDir, "b.pb.js"), B_SRC)

  execFileSync(EXE, ["superuser", "upsert", ADMIN_EMAIL, ADMIN_PASS, `--dir=${dataDir}`], { stdio: "pipe" })

  const fd = fs.openSync(logFile, "w")
  const child = spawn(EXE, ["serve", "--http=127.0.0.1:18076", `--dir=${dataDir}`, `--hooksDir=${hooksDir}`, "--hooksWatch=false"],
    { stdio: ["ignore", fd, fd], windowsHide: true })
  child._fd = fd
  child._logFile = logFile

  let childToKill = child
  try {
    const baseUrl = "http://127.0.0.1:18076"
    await waitHealth(baseUrl, child)

    const login = await http(baseUrl, "POST", "/api/collections/_superusers/auth-with-password", { body: { identity: ADMIN_EMAIL, password: ADMIN_PASS } })
    assert.strictEqual(login.status, 200, "superuser login failed: " + JSON.stringify(login.data)?.slice(0, 300))
    const token = login.data.token

    const mkColl = await http(baseUrl, "POST", "/api/collections", {
      token,
      body: { name: "probe_col", type: "base", listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null, fields: [{ name: "title", type: "text", required: false, max: 0, min: 0, pattern: "", autogeneratePattern: "", primaryKey: false, system: false }] },
    })
    assert.strictEqual(mkColl.status, 200, "collection create failed: " + JSON.stringify(mkColl.data)?.slice(0, 300))

    const rec = await http(baseUrl, "POST", "/api/collections/probe_col/records", { token, body: { title: "hello" } })
    if (rec.status !== 200) console.log(fs.readFileSync(logFile, "utf8").slice(-2000))
    assert.strictEqual(rec.status, 200, "record create failed: " + JSON.stringify(rec.data)?.slice(0, 300))
    await sleep(800)

    const after = await http(baseUrl, "GET", "/probe")
    const serverLog = fs.readFileSync(logFile, "utf8")
    const afterLine = serverLog.split("\n").filter((l) => l.indexOf("ZZ_AFTER state=") !== -1).pop() || "(no ZZ_AFTER line — after-success hook did not run)"

    console.log("GET /probe AFTER record create:", JSON.stringify(after.data))
    console.log("after hook saw (from server log):", afterLine)

    const sameVM = after.data && after.data.moduleState === "SET_BY_A" && after.data.globalMark === "A_SET"
    const moduleSharedOnly = after.data && after.data.moduleState === "SET_BY_A" && after.data.globalMark !== "A_SET"
    console.log("\n=> module state shared across files: " + (moduleSharedOnly || sameVM ? "YES" : "NO"))
    console.log("=> globalThis shared across files   : " + (sameVM ? "YES" : "NO"))
    console.log(sameVM
      ? "=> CONCLUSION: same VM (module + globalThis both shared)"
      : moduleSharedOnly
        ? "=> CONCLUSION: separate VMs but require() module cache IS shared across files"
        : "=> CONCLUSION: separate VMs; module state and globalThis are NOT shared across files")
  } finally {
    try { if (childToKill.exitCode === null) childToKill.kill() } catch { /* ignore */ }
    await sleep(500)
    try { fs.closeSync(fd) } catch { /* ignore */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

main().catch((err) => { console.error("\nFAILED:", err && err.message ? err.message : err); process.exit(1) })
