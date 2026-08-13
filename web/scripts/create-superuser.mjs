import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getAdminCreds } from "./creds.mjs";

const { email, password } = getAdminCreds();

const dbPath = path.resolve(
  "D:/Projects/OC/iPlanner/backend/pb_data/data.db"
);

if (!fs.existsSync(dbPath)) {
  console.error("Database not found at:", dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

// Check schema
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log("Tables:", tables.map((t) => t.name));

// Check _superusers columns
const cols = db.prepare("PRAGMA table_info('_superusers')").all();
console.log("Superusers columns:", cols.map((c) => c.name));

// Check existing superusers
const existing = db.prepare("SELECT id, email FROM _superusers").all();
console.log("Existing:", existing);

if (existing.length === 0) {
  // PB 0.26 uses UUIDv7 for IDs
  const id = crypto.randomUUID();

  const now = new Date().toISOString().replace("T", " ").split(".")[0];

  // NOTE: this inserts a placeholder bcrypt hash only.
  // The actual password must be set through the admin API after PB starts
  // (POST /api/admins or the admin UI). This record is a bootstrap stub.
  db.prepare(
    `INSERT INTO _superusers (id, email, passwordHash, created, updated) VALUES (?, ?, ?, ?, ?)`
  ).run(id, email, "$2a$10$placeholder", now, now);

  console.log("Superuser inserted with id:", id, "email:", email);
  console.log("WARNING: placeholder hash only — set password via admin API.");
} else {
  console.log("Superuser already exists");
}

db.close();
