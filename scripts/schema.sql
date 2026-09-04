CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ladder (
  rung   INTEGER PRIMARY KEY,
  label  TEXT    NOT NULL,
  detail TEXT    NOT NULL DEFAULT '',
  status TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'done'))
);

CREATE TABLE IF NOT EXISTS current_priority (
  id                       INTEGER PRIMARY KEY DEFAULT 1,
  headline                 TEXT NOT NULL DEFAULT '',
  rationale                TEXT NOT NULL DEFAULT '',
  subtasks                 TEXT NOT NULL DEFAULT '',
  explicitly_deferred_items TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS urgent (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item             TEXT NOT NULL,
  required_action  TEXT NOT NULL DEFAULT '',
  responsible_role TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS backlog (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  date_raised          TEXT    NOT NULL DEFAULT '',
  item                 TEXT    NOT NULL,
  related_ladder_step  INTEGER REFERENCES ladder(rung),
  state                TEXT    NOT NULL DEFAULT 'current' CHECK (state IN ('current', 'next', 'queued', 'parked')),
  note                 TEXT    NOT NULL DEFAULT '',
  status               TEXT    NOT NULL DEFAULT 'open'    CHECK (status IN ('open', 'archived'))
);

CREATE TABLE IF NOT EXISTS workstreams (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workstream_name TEXT    NOT NULL,
  note            TEXT    NOT NULL DEFAULT '',
  item            TEXT    NOT NULL,
  done            INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS decisions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  decision      TEXT NOT NULL,
  options       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'not_started', 'decided')),
  decided_value TEXT
);

CREATE TABLE IF NOT EXISTS costs (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  item   TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  event_type TEXT NOT NULL CHECK (event_type IN ('done', 'cancelled', 'changed')),
  item       TEXT NOT NULL,
  source_tab TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS inbox (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  raw_text  TEXT NOT NULL,
  source    TEXT NOT NULL DEFAULT 'board',
  status    TEXT NOT NULL DEFAULT 'unprocessed' CHECK (status IN ('unprocessed', 'processed', 'flagged')),
  filed_to  TEXT
);
