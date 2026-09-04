import { createClient } from "@libsql/client";

let _client;

export function getDb() {
  if (!_client) {
    if (!process.env.TURSO_DATABASE_URL) throw new Error("TURSO_DATABASE_URL is required");
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

const splitList = v =>
  String(v || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

export function shapeBoardData({ meta, ladder, cp, urgent, backlog, workstreams, decisions, costs }) {
  const metaObj = Object.fromEntries(meta.map(r => [r.key, r.value]));
  return {
    meta: {
      title: metaObj.title || "Household relocation",
      subtitle: metaObj.subtitle || "",
      targetDate: metaObj.target_date || "",
      updated: metaObj.last_updated || "",
      note: metaObj.note || "",
    },
    ladder: ladder.map(r => ({ order: r.rung, label: r.label, detail: r.detail, status: r.status })),
    currentPriority: {
      headline: cp.headline || "",
      rationale: cp.rationale || "",
      subtasks: splitList(cp.subtasks),
      deferred: splitList(cp.explicitly_deferred_items),
    },
    urgent: urgent.map(r => ({ item: r.item, required_action: r.required_action, responsible_role: r.responsible_role })),
    backlog: backlog.map(r => ({
      date_raised: r.date_raised,
      item: r.item,
      related_ladder_step: r.related_ladder_step,
      state: r.state,
      note: r.note,
      status: r.status,
    })),
    workstreams: workstreams.map(r => ({
      workstream_name: r.workstream_name,
      note: r.note,
      item: r.item,
      done: Boolean(r.done),
      sort_order: Number(r.sort_order) || 0,
    })),
    decisions: decisions.map(r => ({ decision: r.decision, options: r.options, status: r.status, decided_value: r.decided_value })),
    costs: costs.map(r => ({ item: r.item, status: r.status })),
  };
}

export async function fetchBoardData() {
  const db = getDb();
  const [metaResult, ladderResult, cpResult, urgentResult, backlogResult, workstreamsResult, decisionsResult, costsResult] =
    await Promise.all([
      db.execute("SELECT key, value FROM meta"),
      db.execute("SELECT rung, label, detail, status FROM ladder ORDER BY rung"),
      db.execute("SELECT headline, rationale, subtasks, explicitly_deferred_items FROM current_priority LIMIT 1"),
      db.execute("SELECT item, required_action, responsible_role FROM urgent"),
      db.execute("SELECT date_raised, item, related_ladder_step, state, note, status FROM backlog WHERE status = 'open'"),
      db.execute("SELECT workstream_name, note, item, done, sort_order FROM workstreams ORDER BY sort_order"),
      db.execute("SELECT decision, options, status, decided_value FROM decisions"),
      db.execute("SELECT item, status FROM costs"),
    ]);

  return shapeBoardData({
    meta: metaResult.rows,
    ladder: ladderResult.rows,
    cp: cpResult.rows[0] || {},
    urgent: urgentResult.rows,
    backlog: backlogResult.rows,
    workstreams: workstreamsResult.rows,
    decisions: decisionsResult.rows,
    costs: costsResult.rows,
  });
}

export async function insertInboxRow(rawText, source = "board") {
  const db = getDb();
  await db.execute({
    sql: "INSERT INTO inbox (raw_text, source) VALUES (?, ?)",
    args: [rawText, source],
  });
}
