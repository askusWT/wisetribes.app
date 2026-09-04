#!/usr/bin/env python3
"""
Triage unprocessed inbox rows into the correct board tables.

Run: pnpm run triage   (or: python3 triage.py)
Requires env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, ANTHROPIC_API_KEY
"""

import json
import os
import sys
import urllib.request
import urllib.error

TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "").rstrip("/")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

VALID_TABLES = {"backlog", "urgent", "workstreams", "decisions", "costs"}

SYSTEM_PROMPT = """\
You are a triage assistant for a shared household relocation board.
The board has these sections: backlog (general tasks), urgent (needs prompt action),
workstreams (grouped work items with done/not-done status), decisions (open choices),
costs (money / sign-off items).

Given a free-text note, respond with exactly one word: the section it belongs in.
Choose from: backlog, urgent, workstreams, decisions, costs, flagged.
Use 'flagged' only if the note is genuinely ambiguous or needs human judgement.
Never say anything other than one of those six words."""


# ---------------------------------------------------------------------------
# Turso HTTP API
# ---------------------------------------------------------------------------

def turso_request(sql, args=None):
    payload = json.dumps({
        "requests": [{"type": "execute", "stmt": {"sql": sql, "args": args or []}}]
    }).encode()
    req = urllib.request.Request(
        f"{TURSO_URL}/v2/pipeline",
        data=payload,
        headers={
            "Authorization": f"Bearer {TURSO_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())
    result = body["results"][0]
    if result.get("type") == "error":
        raise RuntimeError(f"Turso error: {result['error']}")
    return result["response"]["result"]


def fetch_unprocessed():
    result = turso_request(
        "SELECT id, raw_text FROM inbox WHERE status = 'unprocessed' ORDER BY timestamp"
    )
    cols = [c["name"] for c in result["cols"]]
    return [dict(zip(cols, [v["value"] for v in row])) for row in result["rows"]]


def mark_row(row_id, status, filed_to=None):
    turso_request(
        "UPDATE inbox SET status = ?, filed_to = ? WHERE id = ?",
        [
            {"type": "text", "value": status},
            {"type": "text", "value": filed_to} if filed_to else {"type": "null"},
            {"type": "integer", "value": str(row_id)},
        ],
    )


# ---------------------------------------------------------------------------
# Classification via Claude
# ---------------------------------------------------------------------------

def classify(text):
    """Return (table_name, flag_reason). table_name is one of VALID_TABLES or 'flagged'."""
    if not ANTHROPIC_KEY:
        return "flagged", "ANTHROPIC_API_KEY not set"

    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 10,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": text}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
        word = body["content"][0]["text"].strip().lower()
    except urllib.error.HTTPError as e:
        return "flagged", f"API error {e.code}"
    except Exception as e:
        return "flagged", str(e)

    if word in VALID_TABLES:
        return word, None
    return "flagged", f"Unexpected model response: {word!r}"


# ---------------------------------------------------------------------------
# Core triage loop (separated for testability)
# ---------------------------------------------------------------------------

def triage(rows, classify_fn=classify, mark_fn=mark_row, *, dry_run=False):
    """Process inbox rows. Returns list of result dicts. Never raises — flags on error."""
    results = []
    for row in rows:
        row_id = row["id"]
        text = row["raw_text"]
        table, reason = classify_fn(text)
        status = "processed" if table in VALID_TABLES else "flagged"
        filed_to = table if status == "processed" else None
        if not dry_run:
            mark_fn(row_id, status, filed_to)
        results.append({"id": row_id, "status": status, "filed_to": filed_to, "reason": reason})
        label = f"→ {filed_to}" if filed_to else f"FLAGGED ({reason})"
        print(f"  [{row_id}] {label}  |  {text[:60]!r}")
    return results


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    if not TURSO_URL:
        print("Error: TURSO_DATABASE_URL is not set.", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching unprocessed inbox rows…")
    rows = fetch_unprocessed()

    if not rows:
        print("Nothing to triage.")
        return

    print(f"Triaging {len(rows)} row(s):\n")
    results = triage(rows)

    processed = sum(1 for r in results if r["status"] == "processed")
    flagged = sum(1 for r in results if r["status"] == "flagged")
    print(f"\nDone. {processed} filed, {flagged} flagged for review.")

    if flagged:
        print("\nFlagged items need manual review — check the inbox table.")
        sys.exit(1)


if __name__ == "__main__":
    main()
