# The Move Board — Brief for Claude Code

Full context, no stripping — this is for local Claude Code, not Codex. You already have the repo locally, so this assumes Task-1-style repo setup is either done or nearly done; verify rather than redo.

## What this is, and why it's shaped this way

A status board for a house move (Cornwall Gardens → Old Street) plus rental prep on the property being left. Two users: Mark (manages it), Mike (Mark's partner — views it, needs a frictionless way to add updates).

Mike has ADHD and engages in a way where priorities get reslated daily via free-text "biggest stress" messages — not a flaw, just how he works, but it was causing real friction ("why are you working on the wrong thing?") because each message read as a new, contradictory priority. The board exists to defuse that: priority is derived from a shared dependency structure, not from whoever spoke last.

**Two hard framing rules, non-negotiable in any code/copy you touch:**
- Never attribute priority shifts or stress to Mike by name. Sections are "Backlog" and "Current Priority" — neutral, process language. Never anything like "Mike's stress log."
- Backlog holds everything raised, whenever raised, unattributed. Current Priority surfaces the one thing that unblocks the most, with a stated reason. Nothing is ever framed as a rebuke.

This isn't a preference — it's the actual product requirement. If a rebuild or copy change so much as sounds like it's tracking whose fault a delay is, it's wrong.

## Current live state (verify against reality before trusting this)

- **Live board:** https://wisetribes.app — passcode-gated, passcode is `oldstreet`. Client-side soft gate only (`btoa(value) === 'b2xkc3RyZWV0'` in the page JS) — real Vercel Password Protection needs a paid add-on not enabled on this account. Not real security; acceptable given low sensitivity. Leave as-is.
- **Hosting:** Vercel project `wisetribes-app` (team `mark-newtons-projects`), custom domain `wisetribes.app`. Was deployed via ad-hoc inline file uploads (no git) — this may now be fixed since Mark has a local repo, but **confirm the Vercel project is actually connected to the git repo for git-triggered deploys** (Settings → Git → Connect a Git Repository if not). This was an open gap as of the last check.
- **Stack:** Next.js — inherited from a pre-scaffolded empty Vercel project, not a deliberate choice. The actual content is a static file at `public/board.html`, served at `/` via a `next.config.js` rewrite using the `beforeFiles` phase specifically (the default `afterFiles` phase doesn't fire because `pages/index.js` intercepts `/` first — this bit works, don't "simplify" it without re-testing). `package.json` needs `"engines": {"node": "24.x"}` — Vercel's default Node 18 is deprecated and fails builds.
- **Data:** currently hand-pasted as a JS literal (`const DATA = {...}`) inside `board.html`. There is also a Google Sheet ("The Move Board — editable source") that was an earlier attempt at an editable source but is being **replaced, not extended** — see decision below.
- **No backend.** Static HTML/CSS/JS only. No API routes doing anything real yet.

## Decision since the last round: simplify to single-project scope

This was originally scoped as a reusable multi-project system (candidates considered: Linear, Plane, NocoDB, Baserow, Google Sheets). All of that is now dropped for this project. Reasoning, so you don't re-litigate it:

- **Single project only.** No `project_id` columns, no portfolio rollup, no templating for future projects. If this needs to generalize later, that's a distinct future task.
- **Data layer: a SQLite file committed in the repo**, not Sheets/NocoDB/Baserow/Plane. Decision criterion was ease of integration with Claude Code and long-term maintenance, not hosting friction (Vercel makes hosting a non-issue regardless). A file needs no API, no auth, no service to run, and git gives free history on top of the explicit Log table. Linear was ruled out separately for its creeping paid-feature surface.
- **Triage automation: manual trigger, not scheduled.** No scheduled Routine for now — you (Claude Code) run the triage script when asked, or Mark asks for it. Simpler to build and debug, and matches actual usage — nobody wants unattended writes to a shared document before manual runs have proven reliable. Scheduling can be added later once the manual step is a proven chore.
- **Auth: leave the passcode gate exactly as-is.** Nothing here justifies real auth work.

## Target data schema (SQLite, one file, e.g. `data.db` in repo root)

Direct port of the board's existing shape — pull exact current field values from the live `DATA` block in `public/board.html` (fetch it or read it locally) rather than trusting field names reconstructed here from memory; the table *shapes* below are what matters:

- `meta` — key/value: title, subtitle, move_date, updated_at, note.
- `ladder` — rung (int), label, detail, status (`active`/`blocked`).
- `current_priority` — headline, why, subtasks (own table or delimited text), explicitly_deferred.
- `urgent` — item, action, owner.
- `backlog` — raised_date, item, rung (FK → ladder.rung), state (`current`/`next`/`queued`/`parked`), park_note (nullable), status (`open`/`archived`).
- `workstreams` — workstream_name, note, item, done (bool), sort_order.
- `decisions` — decision, options, status (`open`/`not_started`/`decided`), decided_value (nullable).
- `money` — item, status.
- `log` — timestamp, event_type (`done`/`cancelled`/`changed`), item_text, source_table, note. Anything leaving backlog/decisions/workstreams as resolved/cancelled/materially-changed gets a row here instead of being deleted.
- `inbox` — timestamp, raw_text (verbatim), source (`board` for web submissions), status (`unprocessed`/`processed`/`flagged`), filed_to (nullable — table/row reference for traceability).

## Build steps

1. **Verify/fix the Vercel↔GitHub link.** Confirm the Vercel project deploys from this repo's pushes. If not connected, that's a manual dashboard step (Vercel has no API for linking an existing project to an existing repo) — do it or clearly tell Mark to.
2. **Create `data.db`** with the schema above. One-time migration: parse the current `const DATA = {...}` block out of the live `board.html` (or the local copy in `public/board.html`) and populate the tables from it. Don't hand-retype the data — script the extraction so nothing gets silently dropped or mistyped.
3. **Board-generation script**: reads `data.db`, renders `public/board.html` from a template, preserving the current visual design (warm neutral palette, lock-screen gate, Current Priority hero, ladder, backlog list, workstreams/decisions/money panels — see current file for exact layout/CSS). This replaces the hand-pasted `DATA` literal. Wire it as a prebuild step (`package.json` `build` script) so every deploy regenerates the board from `data.db` — never hand-edit the generated HTML directly again.
4. **`triage.py` (or `.js`, your call)**: reads `inbox` rows with `status = 'unprocessed'`, classifies each against the schema above (cheap model call), files clean ones into the right table, updates `status` and `filed_to`, leaves genuinely ambiguous ones as `status = 'flagged'` for Mark to resolve by hand. Run manually — no scheduling infrastructure needed. Wire it as a script Mark (or you) invokes on demand, e.g. `npm run triage`.
5. **Inbox UI**: a slide-out panel on desktop (scrollable), a peek-tab on mobile (subtle hint animation, tap to open). Copy: something like *"Add anything — we'll sort it out."* No login, no required categorization, single textarea + submit — this exists specifically so Mike never has to justify or frame an update. Wire the submit to append a row to `inbox` in `data.db` (a small Vercel serverless function, since `data.db` needs a server-side write — a static page can't write to a file in its own deployed bundle). Verbatim text only at submit time; no classification happens synchronously.
6. **Commit `data.db` to git** alongside code. Every triage run and every Inbox submission is a commit — that's your audit trail on top of the explicit `log` table.

## Open decisions Mark still needs to make (flag, don't default)

1. **Real move date** — board currently shows a placeholder (30 Sep 2026).
2. **Old Street project list** — a placeholder section exists waiting for Mike's actual list for the new home; content not yet supplied.
3. Confirm keeping Next.js (it works, just wasn't a deliberate choice originally) — no need to revisit unless it's actively in your way.

## Acceptance checklist

- [ ] Vercel deploys from git pushes; wisetribes.app still resolves and looks identical to the current live board.
- [ ] `data.db` exists, populated from the current live board's data with nothing lost in migration.
- [ ] Board regenerates from `data.db` on every build — no hand-pasted DATA block remains.
- [ ] `triage.py`/equivalent runs on demand, correctly files clean Inbox items and flags ambiguous ones, never silently drops anything.
- [ ] Inbox panel live (desktop slide-out + mobile peek-tab), submissions land in `inbox` table correctly.
- [ ] Passcode gate unchanged and still works.
- [ ] `log` table populated whenever something is resolved/cancelled/changed — no silent deletions anywhere in the new pipeline.
- [ ] Copy/framing checked against the non-attribution rule above before calling this done.
- [ ] Open decisions above are visible in the repo README, not silently defaulted.
