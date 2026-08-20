# wisetribes-app

Currently a single static board (`public/board.html`) served at `/` via a Next.js rewrite,
because the Vercel project was pre-scaffolded as Next.js. See `CODEX_BRIEF_EXTERNAL.md`
(if included) or the project's saved brief for the full rebuild spec — this is a snapshot
of what's live, not the target architecture.

Known gotcha: pin Node 24.x (`engines.node` in package.json) — the Vercel project's
default Node 18 is deprecated and fails builds.
