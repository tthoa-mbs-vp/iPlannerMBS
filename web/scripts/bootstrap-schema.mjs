// bootstrap-schema.mjs
//
// Creates the full MBS Planner (iPlanner) schema on a PocketBase instance via
// the admin API. The schema definition itself lives in ./schema-defs.mjs — the
// single source of truth. This file only knows HOW to apply it.
//
// Why this exists: backend/pb_migrations/ is not self-bootstrapping (the base collections
// departments/roles/users/plans/tasks/proposals/comments/kpi_scores/notifications/system_logs
// have no `created_*` migration and several migrations reference the developer's local DB),
// so a fresh hosted instance cannot get its schema from migrations. This script is the
// source of truth for hosted deployments (e.g. PocketHost). It is idempotent: existing
// collections are skipped, missing relation fields are patched in afterwards.
//
// Usage:
//   PB_URL=http://localhost:8090 PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... \
//     node web/scripts/bootstrap-schema.mjs
//
// Dependencies: only the `pocketbase` JS SDK (already in web/package.json).

import PocketBase from "pocketbase";
import { PB_URL, getAdminCreds } from "./creds.mjs";
import {
  collections,
  postPatches,
  PREREQ_NAMES,
  text,
  file,
  relation,
  number,
  bool,
  AVATAR_MIME,
  authUser,
  canManage,
} from "./schema-defs.mjs";

const pb = new PocketBase(PB_URL);
const { email, password } = getAdminCreds();
await pb.collection("_superusers").authWithPassword(email, password);

const log = (msg) => console.log(msg);

async function collectionExists(name) {
  try {
    const res = await pb.collections.getList(1, 1, { filter: `name = "${name}"` });
    return res.items[0] || null;
  } catch (e) {
    return null;
  }
}

// Patch the auto-created users auth collection with the app's rules and fields.
async function syncUsers() {
  const coll = await collectionExists("users");
  if (!coll) {
    console.error("  FAILED  users: collection not found");
    process.exitCode = 1;
    return;
  }
  const names = coll.fields.map((f) => f.name);
  const missing = [
    text("text_pb_name", "name", { max: 255 }),
    file("file_pb_avatar", "avatar", { mimeTypes: AVATAR_MIME }),
    relation("rel_users_dept", "department_id", "pbc_departments"),
    relation("rel_users_role", "role_id", "pbc_roles"),
    number("num_users_reminder", "reminder_days"),
    bool("bool_users_disabled", "disabled"),
    relation("rel_users_groups", "group_ids", "pbc_professional_groups", { maxSelect: 50 }),
  ].filter((f) => !names.includes(f.name));

  try {
    await pb.collections.update(coll.id, {
      listRule: authUser(),
      viewRule: authUser(),
      createRule: canManage(),
      updateRule: `@request.auth.id = id || ${canManage()}`,
      deleteRule: "id = @request.auth.id",
      fields: [...coll.fields, ...missing],
    });
    log(`  patched users (${missing.length} fields added)`);
  } catch (err) {
    console.error(`  FAILED  users: ${JSON.stringify(err?.data?.data || err?.data || err?.message || err)}`);
    process.exitCode = 1;
  }
}

async function createIfMissing(def) {
  const existing = await collectionExists(def.name);
  if (existing) {
    log(`  exists  ${def.name}`);
    return false;
  }
  try {
    await pb.collections.create(def);
    log(`  created ${def.name}`);
    return true;
  } catch (err) {
    // a duplicate that raced in / name conflict with a different id
    const msg = err?.data?.message || err?.message || String(err);
    if (/already exists|duplicate/i.test(msg)) {
      log(`  exists  ${def.name} (${msg})`);
      return false;
    }
    console.error(`  FAILED  ${def.name}: ${JSON.stringify(err?.data?.data || err?.data || err?.message || err)}`);
    process.exitCode = 1;
    return false;
  }
}

async function main() {
  log(`Target: ${PB_URL}`);
  log(`Creating ${collections.length} collections...`);

  let created = 0;
  // 1. prerequisite collections referenced by users
  for (const def of collections.filter((c) => PREREQ_NAMES.includes(c.name))) {
    if (await createIfMissing(def)) created++;
  }
  // 2. patch the auto-created users auth collection
  await syncUsers();
  // 3. everything else (rules may reference users' department_id / role_id / group_ids)
  for (const def of collections.filter((c) => !PREREQ_NAMES.includes(c.name))) {
    if (await createIfMissing(def)) created++;
  }

  log(`Patching post-creation fields...`);
  for (const patch of postPatches) {
    const coll = await collectionExists(patch.collection);
    if (!coll) {
      console.error(`  patch target missing: ${patch.collection}`);
      process.exitCode = 1;
      return;
    }
    const names = coll.fields.map((f) => f.name);
    const toAdd = patch.fields.filter((f) => !names.includes(f.name));
    if (!toAdd.length) { log(`  patched ${patch.collection} (already has fields)`); continue; }
    try {
      await pb.collections.update(coll.id, { fields: [...coll.fields, ...toAdd] });
      log(`  patched ${patch.collection} +${toAdd.map((f) => f.name).join(", ")}`);
    } catch (err) {
      console.error(`  FAILED patch ${patch.collection}: ${err?.data?.message || err?.message || err}`);
      process.exitCode = 1;
      return;
    }
  }

  log(`\nDone. Created ${created} new collections on ${PB_URL}.`);
  log(`Next: run seed-data.mjs to populate departments, roles and users.`);
}

await main();