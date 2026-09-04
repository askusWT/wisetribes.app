const assert = require("node:assert/strict");
const test = require("node:test");

// shapeBoardData is a pure transformation — tested without a real Turso connection.
// Dynamic import because lib/db.js is an ES module.
async function shape() {
  const { shapeBoardData } = await import("../lib/db.js");
  return shapeBoardData;
}

test("shapes meta rows into board meta object", async () => {
  const shapeBoardData = await shape();
  const result = shapeBoardData({
    meta: [
      { key: "title", value: "Our move" },
      { key: "subtitle", value: "Steady progress" },
      { key: "target_date", value: "2026-09-30" },
      { key: "last_updated", value: "2026-09-04" },
      { key: "note", value: "All on track" },
    ],
    ladder: [],
    cp: {},
    urgent: [],
    backlog: [],
    workstreams: [],
    decisions: [],
    costs: [],
  });

  assert.equal(result.meta.title, "Our move");
  assert.equal(result.meta.subtitle, "Steady progress");
  assert.equal(result.meta.targetDate, "2026-09-30");
  assert.equal(result.meta.updated, "2026-09-04");
  assert.equal(result.meta.note, "All on track");
});

test("falls back to defaults when meta rows are missing", async () => {
  const shapeBoardData = await shape();
  const result = shapeBoardData({ meta: [], ladder: [], cp: {}, urgent: [], backlog: [], workstreams: [], decisions: [], costs: [] });
  assert.equal(result.meta.title, "Household relocation");
  assert.equal(result.meta.targetDate, "");
});

test("splits subtasks and deferred items on newlines", async () => {
  const shapeBoardData = await shape();
  const result = shapeBoardData({
    meta: [],
    ladder: [],
    cp: { headline: "h", rationale: "r", subtasks: "Task A\nTask B\n", explicitly_deferred_items: "Deferred 1" },
    urgent: [],
    backlog: [],
    workstreams: [],
    decisions: [],
    costs: [],
  });

  assert.deepEqual(result.currentPriority.subtasks, ["Task A", "Task B"]);
  assert.deepEqual(result.currentPriority.deferred, ["Deferred 1"]);
});

test("maps ladder rungs to order field", async () => {
  const shapeBoardData = await shape();
  const result = shapeBoardData({
    meta: [],
    ladder: [
      { rung: 1, label: "First", detail: "Detail", status: "active" },
      { rung: 2, label: "Second", detail: "", status: "blocked" },
    ],
    cp: {},
    urgent: [],
    backlog: [],
    workstreams: [],
    decisions: [],
    costs: [],
  });

  assert.equal(result.ladder[0].order, 1);
  assert.equal(result.ladder[1].order, 2);
  assert.equal(result.ladder[1].status, "blocked");
});

test("coerces workstream done to boolean and sort_order to number", async () => {
  const shapeBoardData = await shape();
  const result = shapeBoardData({
    meta: [],
    ladder: [],
    cp: {},
    urgent: [],
    backlog: [],
    workstreams: [
      { workstream_name: "Packing", note: "", item: "Books", done: 1, sort_order: "2" },
      { workstream_name: "Packing", note: "", item: "Clothes", done: 0, sort_order: "1" },
    ],
    decisions: [],
    costs: [],
  });

  assert.equal(result.workstreams[0].done, true);
  assert.equal(result.workstreams[1].done, false);
  assert.equal(result.workstreams[0].sort_order, 2);
});

test("only open backlog rows are expected from the query (shape does not re-filter)", async () => {
  const shapeBoardData = await shape();
  const result = shapeBoardData({
    meta: [],
    ladder: [],
    cp: {},
    urgent: [],
    backlog: [{ date_raised: "2026-08-01", item: "Box the kitchen", related_ladder_step: 2, state: "current", note: "", status: "open" }],
    workstreams: [],
    decisions: [],
    costs: [],
  });

  assert.equal(result.backlog.length, 1);
  assert.equal(result.backlog[0].item, "Box the kitchen");
});
