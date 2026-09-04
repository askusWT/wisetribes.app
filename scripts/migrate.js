#!/usr/bin/env node
/**
 * One-time migration: populate Turso from data/sample.json (dev seed).
 *
 * For production: run scripts/migrate-from-sheets.js first to pull live data
 * from Google Sheets into Turso, then retire the Sheets setup entirely.
 *
 * Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate.js
 *   or:  TURSO_DATABASE_URL=file:local.db node scripts/migrate.js  (local dev, no token needed)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is required (use file:local.db for local dev)");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

function loadSchema() {
  return readFileSync(join(__dirname, "schema.sql"), "utf8");
}

function loadSeed() {
  return JSON.parse(readFileSync(join(root, "data", "sample.json"), "utf8"));
}

async function applySchema(db) {
  for (const statement of loadSchema().split(";").map(s => s.trim()).filter(Boolean)) {
    await db.execute(statement);
  }
  console.log("Schema applied.");
}

async function seed(db, data) {
  const stmts = [];

  const metaEntries = [
    ["title", data.meta?.title ?? "Household relocation"],
    ["subtitle", data.meta?.subtitle ?? ""],
    ["target_date", data.meta?.targetDate ?? ""],
    ["last_updated", data.meta?.updated ?? ""],
    ["note", data.meta?.note ?? ""],
  ];
  for (const [key, value] of metaEntries) {
    stmts.push({ sql: "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", args: [key, value] });
  }

  for (const row of data.ladder ?? []) {
    stmts.push({
      sql: "INSERT OR REPLACE INTO ladder (rung, label, detail, status) VALUES (?, ?, ?, ?)",
      args: [row.order, row.label, row.detail ?? "", row.status ?? "active"],
    });
  }

  const cp = data.currentPriority ?? {};
  stmts.push({
    sql: "INSERT OR REPLACE INTO current_priority (id, headline, rationale, subtasks, explicitly_deferred_items) VALUES (1, ?, ?, ?, ?)",
    args: [cp.headline ?? "", cp.rationale ?? "", (cp.subtasks ?? []).join("\n"), (cp.deferred ?? []).join("\n")],
  });

  for (const row of data.urgent ?? []) {
    stmts.push({
      sql: "INSERT INTO urgent (item, required_action, responsible_role) VALUES (?, ?, ?)",
      args: [row.item, row.required_action ?? "", row.responsible_role ?? ""],
    });
  }

  for (const row of data.backlog ?? []) {
    stmts.push({
      sql: "INSERT INTO backlog (date_raised, item, related_ladder_step, state, note, status) VALUES (?, ?, ?, ?, ?, ?)",
      args: [row.date_raised ?? "", row.item, row.related_ladder_step ?? null, row.state ?? "current", row.note ?? "", row.status ?? "open"],
    });
  }

  for (const row of data.workstreams ?? []) {
    stmts.push({
      sql: "INSERT INTO workstreams (workstream_name, note, item, done, sort_order) VALUES (?, ?, ?, ?, ?)",
      args: [row.workstream_name, row.note ?? "", row.item, row.done ? 1 : 0, row.sort_order ?? 0],
    });
  }

  for (const row of data.decisions ?? []) {
    stmts.push({
      sql: "INSERT INTO decisions (decision, options, status, decided_value) VALUES (?, ?, ?, ?)",
      args: [row.decision, row.options ?? "", row.status ?? "open", row.decided_value ?? null],
    });
  }

  for (const row of data.costs ?? []) {
    stmts.push({
      sql: "INSERT INTO costs (item, status) VALUES (?, ?)",
      args: [row.item, row.status ?? ""],
    });
  }

  await db.batch(stmts, "write");
  console.log(`Seeded: ${stmts.length} statements across all tables.`);
}

async function main() {
  const db = getClient();
  await applySchema(db);
  const data = loadSeed();
  await seed(db, data);
  console.log("Migration complete.");
}

main().catch(err => { console.error(err.message); process.exit(1); });
