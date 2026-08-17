#!/usr/bin/env node
// Watch backend/pb_hooks + backend/pb_migrations and auto-restart the PocketBase
// container when a hook/migration file changes.
//
// Why: PocketBase's --hooksWatch uses fsnotify (inotify), which does NOT receive events
// for edits made on the Windows host through the podman WSL 9p/virtiofs mount (verified).
// This script uses Node's fs.watch (ReadDirectoryChangesW on Windows — native) as a
// host-side watcher and restarts the container, which also re-applies pb_migrations.
//
// Usage:  node scripts/watch-pb.js           (Ctrl+C to stop)
// Env:    PB_CONTAINER=mbs-planner-pb        (override container name)
//         PB_DEBOUNCE_MS=800                 (ms of quiet before restarting)
"use strict"
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const CONTAINER = process.env.PB_CONTAINER || "mbs-planner-pb"
const DEBOUNCE_MS = parseInt(process.env.PB_DEBOUNCE_MS || "800", 10)
const DIRS = ["backend/pb_hooks", "backend/pb_migrations"].map((d) => path.resolve(process.cwd(), d))

const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a)
let timer = null

function restart() {
  log("↻ change detected — podman restart " + CONTAINER)
  const r = spawnSync("podman", ["restart", CONTAINER], { stdio: "inherit" })
  if (r.status === 0) log("✓ restarted")
  else log("✗ restart failed (podman machine running? container up?) — " + (r.error ? r.error.message : ""))
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; restart() }, DEBOUNCE_MS)
}

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) { log("skip (missing):", dir); continue }
  try {
    fs.watch(dir, { persistent: true }, (_evt, fname) => {
      const name = String(fname || "")
      if (!/\.(js|ts)$/i.test(name)) return
      log("  changed:", path.relative(process.cwd(), path.join(dir, name)))
      schedule()
    })
    log("watching", path.relative(process.cwd(), dir))
  } catch (e) {
    log("watch error on", dir, "-", e.message)
  }
}

console.log("Auto-restart " + CONTAINER + " on hook/migration change. Ctrl+C to stop.\n")
