# Household Relocation Status Board

A git-backed Next.js status board served from Turso (edge SQLite), with a shared inbox for unstructured notes and a local triage script to file them.

## Architecture

- **Framework:** Next.js (SSR). Board data is fetched live from Turso on every request — no generated files.
- **Database:** Turso (edge-compatible SQLite via HTTP API). Works from Vercel serverless functions and the local triage script alike.
- **Auth:** Signed HTTP-only cookie set after passcode entry. Client-side only, not identity management.
- **Inbox:** Submissions write directly to Turso from `pages/api/inbox.js`. The `triage.py` script classifies them into the right table using Claude Haiku.
- **Triage:** Manual trigger only (`pnpm run triage`). No scheduled automation.

## Setup

1. **Node 24:** `package.json` pins it. Enable Corepack, then run `pnpm install --frozen-lockfile`.
2. **Turso database:** Create a free database at turso.tech. Copy `.env.example` to `.env.local` and fill in `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
   - For local dev without a Turso account: `TURSO_DATABASE_URL=file:local.db` (no token needed).
3. **Run migration:** `pnpm run migrate` — creates schema and seeds from `data/sample.json`. For production, run `scripts/migrate-from-sheets.js` first (requires Google Sheets credentials) to pull live data, then `pnpm run migrate` is not needed.
4. **Add remaining env vars:** `BOARD_PASSCODE`, `SESSION_SECRET` (32+ chars), `ANTHROPIC_API_KEY` (for triage).
5. **Vercel:** Connect this repository (Settings → Git → Connect). Set all env vars in the Vercel dashboard for Production. Deploy from `main`.
6. **Verify:** Check wisetribes.app resolves, passcode gate works, one test inbox submission lands in the `inbox` table.

## Commands

```bash
pnpm dev           # local dev server
pnpm build         # production build
pnpm test          # Node.js unit tests (db shaping) + Python tests via separate runner
pnpm run migrate   # one-time: seed Turso from data/sample.json
pnpm run triage    # classify unprocessed inbox rows (requires ANTHROPIC_API_KEY)
pnpm lint
```

Run Python tests separately:
```bash
python3 tests/test_triage.py
```

## Open decisions — these have not been defaulted

| Decision | Status |
|---|---|
| **Real move date** | Board shows "30 Sep 2026" as a placeholder. Update `meta.target_date` in Turso once confirmed. |
| **Old Street project list** | Placeholder section exists. Content from Mike's actual list needed before it shows anything real. |
| **Next.js** | Kept — was already in place and works. No action needed unless it becomes a problem. |
| **Vercel↔GitHub link** | Verify in Vercel dashboard: Settings → Git → Connected Git Repository. If not connected, git pushes won't trigger deploys. |

## Retiring Google Sheets

Once you've confirmed the migration is complete and the live board is pulling from Turso, the following files can be deleted:

- `lib/google.js`
- `scripts/fetch-sheet-data.js`
- `scripts/fetch-sheet-data.test.js`
- `scripts/setup-sheet.js`
- `scripts/sheet-schema.js`
- `docs/SHEET_SCHEMA.md`

Also remove `GOOGLE_SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` from Vercel env vars and `.env.example`.
