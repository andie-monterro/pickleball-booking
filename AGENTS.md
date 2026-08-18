# pickleball-booking

Court booking app for a pickleball venue — see availability, book/cancel slots, no double-bookings. Tech stack: not decided yet — do not assume one.

## Grilling UX

When running in Claude Code, present each grilling round via the AskUserQuestion tool (chunk rounds of >4 questions into multiple calls; put the recommended answer as the first option). Fall back to the standard ❓/➡️ text format elsewhere.

## Agent skills

### Issue tracker

Linear — project "Pickleball Booking", team AND, via linear-monterro MCP. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five, names as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
