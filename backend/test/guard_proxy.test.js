// E2E test: attendance check-in IP verification when PocketBase runs behind a reverse proxy.
//
// Loads the REAL guards.pb.js + helpers.js with mocked PB globals, and simulates how
// e.realIP() (the event-level accessor — PB 0.39 moved IP accessors off requestInfo) resolves
// the client IP depending on the "User IP proxy headers" setting (settings.trustedProxy) and
// the incoming X-Forwarded-For header:
//
//   - trust proxy OFF          -> remoteIP() = the address PB actually sees (the proxy IP)
//   - trust proxy ON + XFF     -> remoteIP() = right-most XFF entry (the IP appended by the
//                                 last proxy); the real client, unless useLeftmostIP=true
//   - trust proxy ON, no XFF   -> remoteIP() = remote address (fallback)
//
// Run: node backend/test/guard_proxy.test.js   (expect "ALL N TESTS PASSED")
const path = require("path");
const assert = require("assert");

// ---------------------------------------------------------------- PB globals
// guards.pb.js now registers BOTH a guard handler and (A11) an audit handler for
// create/update — preserve registration order and run them in sequence, mirroring
// PB 0.39 (handlers run in registration order; a throw stops later ones).
let createHandlers = [];
let updateHandlers = [];
global.__hooks = path.join(__dirname, "..", "pb_hooks");
global.onRecordCreateRequest = (fn) => { createHandlers.push(fn); };
global.onRecordUpdateRequest = (fn) => { updateHandlers.push(fn); };
global.onRecordDeleteRequest = () => {};
function runHandlers(list, e) { for (const fn of list) fn(e); }
function createHandler(e) { runHandlers(createHandlers, e); }
function updateHandler(e) { runHandlers(updateHandlers, e); }
class ForbiddenError extends Error {}
class BadRequestError extends Error {}
global.ForbiddenError = ForbiddenError;
global.BadRequestError = BadRequestError;

function MockRecord(name, data) {
  this._name = name;
  this._data = data || {};
  this._super = false;
}
MockRecord.prototype.collection = function () { return { name: this._name }; };
MockRecord.prototype.get = function (k) { return this._data[k]; };
MockRecord.prototype.getString = function (k) { const v = this._data[k]; return v === null || v === undefined ? "" : String(v); };
MockRecord.prototype.getBool = function (k) { return !!this._data[k]; };
MockRecord.prototype.getFloat = function (k) { const v = this._data[k]; return typeof v === "number" ? v : (parseFloat(v) || 0); };
MockRecord.prototype.set = function (k, v) { this._data[k] = v; };
MockRecord.prototype.isSuperuser = function () { return this._super; };
Object.defineProperty(MockRecord.prototype, "id", {
  get: function () { return this._data.id; },
  set: function (v) { this._data.id = v; },
});

// ------------------------------------------------- simulated proxy chain
// What PocketBase would see at the network level:
//   remoteAddr  - the address of the last hop (the proxy, when one is present)
//   xff         - the X-Forwarded-For header the request carries
//   trustOn     - the settings.trustedProxy.headers setting is enabled
//   useLeftmost - settings.trustedProxy.useLeftmostIP (default false)
const proxy = {
  remoteAddr: "127.0.0.1", // PB sees the proxy (or direct client) at this address
  xff: "",                 // "" = no X-Forwarded-For header
  trustOn: false,
  useLeftmost: false,
};

// Mirrors PocketBase's remoteIP(): pick from the trusted header, else fall back
// to the remote address; right-most XFF entry by default (secure), left-most only
// when useLeftmostIP is set (insecure with X-Forwarded-For).
function simulatedRemoteIP() {
  if (proxy.trustOn && proxy.xff) {
    const entries = proxy.xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (entries.length > 0) {
      return proxy.useLeftmost ? entries[0] : entries[entries.length - 1];
    }
  }
  return proxy.remoteAddr;
}

const state = {
  cfg: null,          // active attendance config (null = none)
  dup: false,         // duplicate check-in present
};

global.$app = {
  findCollectionByNameOrId: (n) => ({ name: n }),
  findRecordById: (coll, id) => {
    if (coll === "roles") {
      const r = new MockRecord("roles", {});
      r.getBool = (k) => false;
      return r;
    }
    return null;
  },
  findRecordsByFilter: (coll, filter) => {
    if (String(filter).indexOf("is_active=true") !== -1) return state.cfg ? [state.cfg] : [];
    if (String(filter).indexOf("check_in >=") !== -1) return state.dup ? [new MockRecord("attendance_logs", { id: "existing" })] : [];
    return [];
  },
};

// -------------------------------------------------------- load real modules
require(path.join(__dirname, "..", "pb_hooks", "helpers.js"));
require(path.join(__dirname, "..", "pb_hooks", "guards.pb.js"));
assert(createHandler && updateHandler, "handlers registered");

// ------------------------------------------------------------------ helpers
function actor(overrides) {
  return new MockRecord("users", Object.assign({ id: "user1", role_id: "role1" }, overrides));
}
function evt(record) {
  return {
    collection: { name: "attendance_logs" },
    record,
    next: () => {},
    // PB 0.39: realIP()/remoteIP() live on the EVENT object, not on requestInfo().
    // guards.pb.js calls e.realIP() — the one that resolves trusted proxy headers and
    // falls back to the raw connection address when no proxy is configured.
    realIP: simulatedRemoteIP,
    remoteIP: () => proxy.remoteAddr,
    requestInfo: () => ({
      auth: actor(),
      hasSuperuserAuth: () => false,
    }),
  };
}
function attRecord(overrides) {
  return new MockRecord("attendance_logs", Object.assign({
    user_id: "user1",
    check_in: "2026-08-10T08:05:00",
    status: "on_time",
  }, overrides));
}
function cfgRecord(overrides) {
  return new MockRecord("attendance_configs", Object.assign({
    office_name: "VP Hà Nội",
    wifi_ssid: "MBS_Office",
    work_start_time: "08:00",
    late_tolerance_minutes: 15,
  }, overrides));
}
function reset() {
  state.cfg = null;
  state.dup = false;
  proxy.remoteAddr = "127.0.0.1";
  proxy.xff = "";
  proxy.trustOn = false;
  proxy.useLeftmost = false;
}
function checkIn() {
  const rec = attRecord();
  createHandler(evt(rec));
  return rec;
}
function expectForbidden(part) {
  let threw = null;
  try { createHandler(evt(attRecord())); } catch (e) { threw = e; }
  assert(threw instanceof ForbiddenError, "expected ForbiddenError, got " + (threw && threw.message));
  if (part) assert(String(threw.message).indexOf(part) !== -1, "message missing '" + part + "': " + threw.message);
}

let passed = 0;
function ok(name) { passed++; console.log("  ✓ " + name); }

// ---------------------------------------------------------------- scenarios
console.log("proxy chain -> remoteIP() -> attendance guard:");

global.$app.findRecordsByFilter = (coll, filter) => {
  if (String(filter).indexOf("is_active=true") !== -1) return state.cfg ? [state.cfg] : [];
  if (String(filter).indexOf("check_in >=") !== -1) return state.dup ? [new MockRecord("attendance_logs", { id: "existing" })] : [];
  return [];
};

// 1. No proxy, no XFF: remoteIP() = the address PB sees directly.
reset();
proxy.remoteAddr = "192.168.1.100";
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "192.168.1.100", "direct private client IP stored");
  ok("direct private client (no proxy) -> allowed, ip_address recorded");
}

// 2. Trust proxy OFF: PB only sees the proxy IP (XFF ignored).
reset();
proxy.remoteAddr = "172.17.0.1"; // nginx on the same host/docker network
proxy.xff = "192.168.1.100";     // client IP carried by header — ignored
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "172.17.0.1", "proxy IP recorded, not the XFF value");
  ok("trust proxy OFF -> remoteIP()=proxy IP, XFF ignored");
}

// 3. Trust proxy ON + XFF from nginx ($proxy_add_x_forwarded_for).
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.xff = "192.168.1.100";
proxy.trustOn = true;
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "192.168.1.100", "real client IP resolved from XFF");
  ok("trust proxy ON -> remoteIP()=client IP from XFF, private -> allowed");
}

// 4. Trust proxy ON, client is remote (public IP): rejected without allowlist.
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.xff = "8.8.8.8";
proxy.trustOn = true;
{
  expectForbidden("mạng nội bộ");
  ok("trust proxy ON + public client IP -> rejected (no allowlist)");
}

// 5. Trust proxy ON + allowlist: public client IP allowed only if listed.
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.xff = "8.8.8.8";
proxy.trustOn = true;
state.cfg = cfgRecord({ allowed_ips: ["8.8.8.8"] });
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "8.8.8.8");
  ok("trust proxy ON + allowlist matches public client IP -> allowed");
}

// 6. XFF spoofing attempt: client prepends a fake IP, nginx appends the real one.
//    Default (useLeftmostIP=false) uses the RIGHT-most entry -> real IP wins.
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.xff = "10.0.0.1, 192.168.1.100"; // fake leftmost, real rightmost
proxy.trustOn = true;
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "192.168.1.100", "right-most XFF entry used, fake ignored");
  ok("XFF spoof attempt (fake, real) -> right-most used -> real IP wins");
}

// 7. Same spoofing attempt with useLeftmostIP=true (insecure) -> fake IP wins.
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.xff = "10.0.0.1, 192.168.1.100";
proxy.trustOn = true;
proxy.useLeftmost = true;
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "10.0.0.1", "left-most XFF entry used (insecure mode)");
  ok("useLeftmostIP=true -> left-most (fake) used — demonstrates why default is false");
}

// 8. CIDR allowlist through the proxy chain.
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.xff = "192.168.1.55";
proxy.trustOn = true;
state.cfg = cfgRecord({ allowed_ips: ["192.168.1.0/24"] });
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "192.168.1.55");
  ok("trust proxy ON + CIDR allowlist matches -> allowed");
}

// 9. Trust proxy ON but header absent: falls back to the remote (proxy) address.
reset();
proxy.remoteAddr = "172.17.0.1";
proxy.trustOn = true;
{
  const rec = checkIn();
  assert.strictEqual(rec._data.ip_address, "172.17.0.1", "no XFF -> remote address used");
  ok("trust proxy ON without XFF -> falls back to proxy address");
}

// 10. Duplicate check-in still blocked regardless of the proxy chain.
reset();
proxy.remoteAddr = "192.168.1.100";
state.dup = true;
{
  let threw = null;
  try { createHandler(evt(attRecord())); } catch (e) { threw = e; }
  assert(threw instanceof BadRequestError, "expected BadRequestError, got " + (threw ? threw.constructor.name + ": " + threw.message : "no error"));
  ok("duplicate check-in rejected (guard order preserved)");
}

console.log("\nALL " + passed + " TESTS PASSED");
