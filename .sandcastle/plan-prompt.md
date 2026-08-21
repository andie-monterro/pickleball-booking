# TICKETS

Here are the open Linear tickets that are ready for an agent:

<tickets-json>

!`node scripts/linear.mjs list`

</tickets-json>

The list is already filtered for you: project "Pickleball Booking", label `ready-for-agent`, still open, and leaf tickets only. A ticket with sub-issues (like the `Court Booking v1 — build spec` parent) is a container for work, never work itself, so it never appears here.

# TASK

Analyze the tickets and build a dependency graph. For each ticket, decide whether it **blocks** or **is blocked by** another open ticket.

Ticket B is **blocked by** ticket A if:

- B needs code, schema, or migrations that A introduces
- B and A change overlapping files or modules, so building them at the same time would produce merge conflicts
- B's requirements depend on an API shape or a decision A establishes

A ticket is **unblocked** when it has zero blocking dependencies on other open tickets.

Each ticket's description states its own blockers under a `## Blocked by` heading. Trust that list first, then check it against the repo — a blocker that is already Done no longer blocks, and the list can miss an overlap the code makes obvious.

Read the repo before you decide: `AGENTS.md`, `CONTEXT.md`, `docs/adr/`, `migrations/`, and the parts of `src/` and `tests/` each ticket would touch. Two tickets that both add a migration, or both rewrite the same route, are not parallel work — pick one and leave the other for the next run.

Pick **at most {{MAX_TICKETS}}** tickets. If more are unblocked than that, keep the ones with the highest priority and the least file overlap.

For each ticket you pick, the branch name is exactly `sandcastle/<TICKET-ID>` — for example `sandcastle/AND-25`. No slug, no suffix. It must be deterministic, so re-planning the same ticket reuses the branch and keeps the work already on it.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "AND-25", "title": "Staff desk: staff role, book for any Player", "branch": "sandcastle/AND-25"}]}
</plan>

Include only unblocked tickets. If every ticket is blocked, include the single best candidate — the one with the fewest and weakest dependencies.

Always emit the `<plan>` tags, even when there is nothing to do. With no tickets to work on, output `<plan>{"issues": []}</plan>` so the run exits cleanly.
