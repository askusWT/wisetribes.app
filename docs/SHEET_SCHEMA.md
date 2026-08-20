# Google Sheet schema

Each tab is a plain table: one header row, one record per later row, no merged cells. Use Sheets conditional-formatting rules rather than hardcoded fills. Exact header names matter.

| Tab | Headers | Notes |
| --- | --- | --- |
| `Meta` | `key`, `value` | Keys: `title`, `subtitle`, `target_date`, `last_updated`, `note`. |
| `Ladder` | `order`, `label`, `detail`, `status` | `order` is an integer; status is `active` or `blocked`. |
| `CurrentPriority` | `headline`, `rationale`, `subtasks`, `explicitly_deferred_items` | One record. Put multiple items on separate lines within the relevant cell. |
| `Urgent` | `item`, `required_action`, `responsible_role` | Roles only; never personal names. |
| `Backlog` | `date_raised`, `item`, `related_ladder_step`, `state`, `note`, `status` | State: `current`, `next`, `queued`, `parked`; status: `open`, `archived`. |
| `Workstreams` | `workstream_name`, `note`, `item`, `done`, `sort_order` | One row per item; use boolean `TRUE`/`FALSE`. |
| `Decisions` | `decision`, `options`, `status`, `decided_value` | Status: `open`, `not started`, `decided`. |
| `Costs` | `item`, `status` | Suggested statuses: `to-gather`, `to-price`, `resolved`. |
| `Log` | `timestamp`, `event_type`, `item`, `source_tab`, `note` | Event: `done`, `cancelled`, `changed`. Append resolved items; do not delete history. |
| `Inbox` | `timestamp`, `raw_submitted_text`, `source`, `status`, `filed_to` | Status: `unprocessed`, `processed`, `flagged`. `filed_to` may be blank. |

## Suggested validation and formatting

- Apply dropdown validation to all enumerated status/state/event columns.
- Apply checkboxes to `Workstreams.done`.
- Freeze row 1 and enable filters on every table.
- Use conditional formatting for statuses (for example, muted grey for archived or blocked and a calm accent for active/current).
- Protect headers from casual edits, while leaving record ranges editable.
- Keep timestamps in ISO 8601 where possible and dates in `YYYY-MM-DD`.

The guarded `pnpm sheet:setup` helper creates missing tabs and writes exact headers. It deliberately does not move or delete existing sheet data, create project-specific records, or fabricate pending content.
