"""Tests for triage.py — all pure unit tests, no network or DB calls."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from triage import triage, VALID_TABLES


def make_classify(word):
    reason = None if word in VALID_TABLES else f"stubbed: {word}"
    return lambda text: (word, reason)


def test_valid_table_marks_processed():
    rows = [{"id": 1, "raw_text": "Need to book a removals company"}]
    marked = []

    results = triage(
        rows,
        classify_fn=make_classify("backlog"),
        mark_fn=lambda rid, status, filed_to: marked.append((rid, status, filed_to)),
    )

    assert results[0]["status"] == "processed"
    assert results[0]["filed_to"] == "backlog"
    assert marked == [(1, "processed", "backlog")]


def test_unknown_response_marks_flagged():
    rows = [{"id": 2, "raw_text": "????"}]
    marked = []

    results = triage(
        rows,
        classify_fn=make_classify("nonsense"),
        mark_fn=lambda rid, status, filed_to: marked.append((rid, status, filed_to)),
    )

    assert results[0]["status"] == "flagged"
    assert results[0]["filed_to"] is None
    assert marked[0][1] == "flagged"


def test_missing_api_key_flags_without_dropping():
    rows = [{"id": 3, "raw_text": "We need to sort the deposit"}]
    marked = []

    results = triage(
        rows,
        classify_fn=lambda text: ("flagged", "ANTHROPIC_API_KEY not set"),
        mark_fn=lambda rid, status, filed_to: marked.append((rid, status, filed_to)),
    )

    assert results[0]["status"] == "flagged"
    assert len(marked) == 1, "row must still be marked even when flagged"


def test_dry_run_does_not_call_mark():
    rows = [{"id": 4, "raw_text": "Buy packing tape"}]
    marked = []

    triage(
        rows,
        classify_fn=make_classify("backlog"),
        mark_fn=lambda *a: marked.append(a),
        dry_run=True,
    )

    assert marked == [], "dry_run must not call mark_fn"


def test_all_valid_tables_accepted():
    for table in VALID_TABLES:
        rows = [{"id": 99, "raw_text": "test"}]
        results = triage(
            rows,
            classify_fn=make_classify(table),
            mark_fn=lambda *a: None,
        )
        assert results[0]["status"] == "processed", f"{table} should be accepted"
        assert results[0]["filed_to"] == table


def test_multiple_rows_processed_independently():
    rows = [
        {"id": 10, "raw_text": "Book storage unit"},
        {"id": 11, "raw_text": "???"},
        {"id": 12, "raw_text": "Confirm move date"},
    ]
    classify_map = {10: "backlog", 11: "nonsense", 12: "decisions"}

    def stub_classify(text):
        for row in rows:
            if row["raw_text"] == text:
                word = classify_map[row["id"]]
                return (word, None) if word in VALID_TABLES else (word, "bad")
        return "flagged", "unknown"

    results = triage(rows, classify_fn=stub_classify, mark_fn=lambda *a: None)

    assert results[0]["status"] == "processed"
    assert results[1]["status"] == "flagged"
    assert results[2]["status"] == "processed"
    assert results[2]["filed_to"] == "decisions"


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for fn in tests:
        try:
            fn()
            print(f"  OK  {fn.__name__}")
            passed += 1
        except Exception as e:
            print(f"FAIL  {fn.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed.")
    sys.exit(1 if failed else 0)
