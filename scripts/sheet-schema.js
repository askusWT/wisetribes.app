module.exports = {
  Meta: ["key", "value"],
  Ladder: ["order", "label", "detail", "status"],
  CurrentPriority: ["headline", "rationale", "subtasks", "explicitly_deferred_items"],
  Urgent: ["item", "required_action", "responsible_role"],
  Backlog: ["date_raised", "item", "related_ladder_step", "state", "note", "status"],
  Workstreams: ["workstream_name", "note", "item", "done", "sort_order"],
  Decisions: ["decision", "options", "status", "decided_value"],
  Costs: ["item", "status"],
  Log: ["timestamp", "event_type", "item", "source_tab", "note"],
  Inbox: ["timestamp", "raw_submitted_text", "source", "status", "filed_to"]
};
