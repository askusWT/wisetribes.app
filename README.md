# Household Relocation Status Board

A git-backed Next.js status board that builds from flat Google Sheet tables and accepts unstructured notes into a shared inbox.

## Architecture decision

**Recommendation: retain Next.js for this handback.** The existing Vercel project already uses it, and the submission endpoint plus server-verified access gate fit naturally in its serverless functions. Replacing it with a static site would still require a separate function runtime, while adding migration and routing risk. The former static-file rewrite has been removed: `/` is now an ordinary Next.js page, so there is no `beforeFiles` routing ambiguity.

The board data is read once during `prebuild` and emitted to an ignored generated file. It is not hand-maintained in HTML or JavaScript. The page and Inbox endpoint are available only after a signed, HTTP-only access cookie is validated. This is still lightweight access control—not identity management—but it is materially less exposed than a client-side passcode comparison and adds no paid service.

## Setup

1. Use Node 22 LTS (`package.json` pins it for Vercel), enable Corepack, then run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and add the sheet ID, service-account JSON, a newly rotated passcode, and a separate 32+ character session secret.
3. Share the Google Sheet with the service-account email. It needs read/write access because builds read the board and `/api/inbox` appends submissions.
4. Review `docs/SHEET_SCHEMA.md`. Back up the current sheet, then run `CONFIRM_SHEET_SETUP=yes pnpm sheet:setup` to add missing tabs and set header rows. It retains existing data rows; reshape visual/merged content manually into those tables before deploying.
5. Run `ALLOW_SAMPLE_DATA=true pnpm build` for local verification, or `pnpm build` with real credentials for a real data build.
6. In Vercel, connect this repository, set the four secrets for Production, use `main` as the production branch, and deploy. Add the same secrets to Preview when previews should use the real board; otherwise preview builds use the committed sample data. Verify the production URL, access gate, and one test Inbox submission in the sheet.

Never set `ALLOW_SAMPLE_DATA=true` in Vercel Production: missing production credentials should stop the build instead of silently publishing placeholders. Vercel Preview deployments automatically fall back to sample data when Google credentials are unavailable, so pull requests remain deployable without exposing production credentials.

## Open decisions and external steps

- **Target completion date:** awaiting a real value. Set `Meta.target_date` after it is supplied; the UI intentionally says “date pending” meanwhile.
- **Pending board section content:** awaiting the stakeholder’s list. No entries have been invented; the sample build marks this explicitly as pending.
- **Spreadsheet access:** required to inspect drift, migrate real rows, verify conditional formatting, and execute an end-to-end build/submission check.
- **Hosting connection:** repository/Vercel organization details are required to connect git deployment and verify the live URL. This cannot be completed from source code alone.
- **Passcode handback:** generate and send `BOARD_PASSCODE` through the agreed out-of-band channel. It must not appear in git, a PR, or build logs.
- **Framework:** Next.js is recommended above; internal owners should confirm this before handback.

The future scheduled classification/triage process is explicitly out of scope. `Inbox.status` and `Backlog.status` support idempotent processing, while `Log` preserves resolved history.

## Commands

```bash
pnpm dev          # local UI with intentionally sparse sample data
pnpm build        # real Sheets-backed production build
pnpm lint
pnpm sheet:setup  # guarded spreadsheet schema helper
```
