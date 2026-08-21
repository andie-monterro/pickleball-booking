# pickleball-booking

Court booking app for a pickleball venue — see availability, book/cancel slots, no double-bookings. Tech stack: full-stack Next.js (TypeScript) on Vercel, Postgres on Neon, phone OTP via Prelude (Verify API v2) — see `docs/adr/0002-nextjs-vercel-neon-stack.md`.

## Language for the human

The PO reads English at ~IELTS 6.5. In everything written FOR the human (grilling questions, recommendations, summaries): short full sentences, common words, no idioms, no telegram-style fragments. One idea per sentence. Do not sacrifice grammar for concision. Artifacts for machines/devs (tickets, CONTEXT.md, specs) stay in normal technical English.

## Grilling UX

When running in Claude Code, present each grilling round via the AskUserQuestion tool (chunk rounds of >4 questions into multiple calls; put the recommended answer as the first option). Fall back to the standard ❓/➡️ text format elsewhere.

## Commits

End every commit message with the Linear ticket ID in parentheses: `feat: add phone OTP authentication (AND-21)`. When the work has no ticket, ask which one it belongs to before committing.

## Agent skills

### Issue tracker

Linear — project "Pickleball Booking", team AND, via linear-monterro MCP. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five, names as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Parallel AFK loop

Sandcastle — several tickets at once, each in its own Docker sandbox, ending in one pull request per ticket. Run it with `npm run sandcastle`. It never merges and never closes a ticket. See `docs/agents/sandcastle.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
