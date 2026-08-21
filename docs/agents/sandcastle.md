# Sandcastle: the parallel AFK loop

`/dynamic-implement` runs one ticket at a time, in this session, with you watching. Sandcastle runs several tickets at once, each in its own Docker sandbox, and hands you pull requests to review afterwards. Same tickets, same repo conventions — the difference is parallelism and that nobody is watching.

Everything lives in `.sandcastle/`. The orchestration is plain TypeScript in `.sandcastle/main.ts`; the agents' instructions are the four prompt files next to it.

## Run it

```bash
npm run sandcastle
```

One invocation does four phases:

| Phase | What runs | Model |
| ----- | --------- | ----- |
| 0. Test database | No agent. Ensures the `sandcastle-pickleball` Docker network and the `sandcastle-pickleball-postgres` container exist. | — |
| 1. Plan | Reads open Linear tickets, builds a dependency graph, picks the tickets that can be built at the same time, emits a `<plan>`. | Opus |
| 2. Implement + Review | One sandbox per ticket, all at once. Implementer commits on `sandcastle/<TICKET-ID>`; if it committed, a reviewer runs in the same sandbox on the same branch. | Opus, then Sonnet |
| 3. Pull requests | One agent per branch with commits, again in parallel: pushes the branch, opens a PR against `main`, comments the PR link on the ticket. | Sonnet |

Progress is written to `.sandcastle/logs/`. Read them while it runs.

**The loop never merges and never closes a ticket.** Every branch ends as an open PR waiting for human review. That is the point: the review agent is a second pair of eyes, not the last one.

## What it picks up

A ticket enters the queue when all of this holds:

- it is in the Linear project "Pickleball Booking",
- it carries the `ready-for-agent` label,
- it is still open (Backlog, Todo, or In Progress),
- it has no sub-issues — a parent like `AND-17 Court Booking v1 — build spec` is a container for work, never work itself.

The planner then drops anything blocked by another open ticket, and keeps at most `MAX_TICKETS` (3) of what is left. Raising that constant raises the cost of a run in a straight line: one more ticket is one more Opus implementer.

## The tracker surface

Sandboxes have no MCP servers and no browser, so the agents cannot use the `linear-monterro` MCP tools that the interactive skills use. They use `scripts/linear.mjs` instead — the same operations over the Linear GraphQL API, needing only `LINEAR_API_KEY`:

```bash
node scripts/linear.mjs list                                  # the queue above, as JSON
node scripts/linear.mjs view AND-25                           # description, criteria, comments, parent
node scripts/linear.mjs comment AND-25 --body "text"
node scripts/linear.mjs label AND-25 --add ready-for-human --remove ready-for-agent
node scripts/linear.mjs state AND-25 "In Progress"
```

The script works on the host too, which is the fastest way to check what a run will pick up.

## The test database

The suite needs a real Postgres. On a developer machine `tests/setup/global-setup.ts` starts a throwaway container with testcontainers, which needs a Docker daemon — and a sandbox has none of its own.

So when `TEST_PG_ADMIN_URL` is set, the same setup file creates a throwaway *database* on that server instead, migrates it, and drops it at teardown. Sandcastle starts one long-lived Postgres container, joins every sandbox to its network, and passes that variable in. Parallel runs never share a database because each one gets its own name.

The container publishes port 5433, so you can use the same path from the host — it is also much faster than starting a container per run:

```bash
TEST_PG_ADMIN_URL=postgres://postgres:postgres@localhost:5433/postgres npm test
```

The container survives between runs. `docker rm -f sandcastle-pickleball-postgres` if you want a clean one; phase 0 recreates it.

## Credentials

`.sandcastle/.env` (gitignored) holds three values — see `.sandcastle/.env.example`:

- `CLAUDE_CODE_OAUTH_TOKEN` — from `claude setup-token` on the host. Lets the agents use the Claude subscription instead of an API key. `ANTHROPIC_API_KEY` works instead.
- `GH_TOKEN` — pushes branches and opens PRs. Use a fine-grained token scoped to this repository only: Contents (RW), Pull requests (RW), Metadata (R). Do not reuse the broad `gh` CLI token; these agents are unattended.
- `LINEAR_API_KEY` — reads and comments on tickets.

## Changing how it behaves

- `.sandcastle/main.ts` — the dials at the top: `MAX_TICKETS`, `MAX_IMPLEMENT_ITERATIONS`, the four model constants, and the container and network names.
- `.sandcastle/plan-prompt.md` — what counts as parallel work, and the branch naming.
- `.sandcastle/implement-prompt.md` — how a ticket gets built: which docs to read, red-green-refactor, the commit convention, the "do not close the ticket" rule.
- `.sandcastle/review-prompt.md` — what the reviewer looks for.
- `.sandcastle/CODING_STANDARDS.md` — the review checklist. It points at `AGENTS.md`, `CONTEXT.md`, and `docs/adr/` rather than repeating them.
- `.sandcastle/pr-prompt.md` — the PR and hand-off rules.
- `.sandcastle/Dockerfile` — the sandbox image. Rebuild with `npx sandcastle docker build-image` after editing it.

## When something goes wrong

- **The plan phase fails with `StructuredOutputError`** — the planner did not emit a valid `<plan>` block. Read `.sandcastle/logs/planner*.log`.
- **A ticket produced no commits** — the implementer hit its iteration ceiling, timed out, or gave up. It leaves a comment on the ticket saying why; the branch stays on disk with whatever it did.
- **A branch has commits but no PR** — typecheck or tests failed in phase 3. The failure is in the ticket comment; the branch is pushed only when the checks pass.
- **Your `node_modules` looks wrong after a run** — phases 2 and 3 work in their own git worktrees with their own copy, so this should not happen. The planner is the one phase that runs in your checkout, which is why it has no `npm install` hook. If you add one, it will overwrite your macOS binaries with the container's Linux ones; `npm install` on the host repairs it.
- **`docker: permission denied` or a stale container** — phase 0 only creates what is missing. `docker rm -f sandcastle-pickleball-postgres && docker network rm sandcastle-pickleball` resets it.
