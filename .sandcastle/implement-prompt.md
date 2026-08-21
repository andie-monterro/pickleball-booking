# TASK

Build ticket {{TASK_ID}}: {{ISSUE_TITLE}}

Pull the ticket in with `node scripts/linear.mjs view {{TASK_ID}}`. It prints the description, the acceptance criteria, every comment, and the parent ticket id. Read the parent spec too: `node scripts/linear.mjs view <PARENT-ID>`.

Work on branch {{BRANCH}}. Make commits and run tests.

Only work on this one ticket.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Read these before you write code:

- `AGENTS.md` — how this repo works.
- `CONTEXT.md` — the domain glossary. Use these terms in these exact senses, in code and in copy.
- `docs/adr/` — the decisions already made. If your change contradicts an ADR, say so in the ticket comment instead of quietly overriding it.
- `node_modules/next/dist/docs/` — this Next.js version differs from your training data. Read the relevant guide before writing route, server, or config code.
- The test files that touch the area you are changing. Pay extra attention to `tests/harness/` and `tests/fakes/`.

# EXECUTION

Use red-green-refactor:

1. RED: write one failing test.
2. GREEN: write the smallest implementation that passes it.
3. REPEAT until every acceptance criterion on the ticket has a test.
4. REFACTOR.

# FEEDBACK LOOPS

Before every commit, run `npm run typecheck` and `npm test`. Both must pass.

The test suite needs Postgres. It already has one: `TEST_PG_ADMIN_URL` is set in your environment and `tests/setup/global-setup.ts` creates a throwaway database on that server for each run. You need no Docker and no extra setup — just run `npm test`.

# COMMIT

Commit as you go. Each commit message must:

1. Start with a conventional prefix — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
2. End with the ticket id in parentheses: `feat: add staff booking desk ({{TASK_ID}})`.
3. Say what changed and why, and name any decision you had to make.

Keep it concise. Do not use a `RALPH:` prefix — this repo's convention is the conventional prefix plus the ticket id.

# THE TICKET

Do not close the ticket. A human closes it after acceptance testing.

If the work is **not** complete when you stop, leave a comment saying what you did, what is left, and what blocked you:

`node scripts/linear.mjs comment {{TASK_ID}} --body "..."`

If a human must do something you cannot (add a secret, provision a service, click a dashboard), say so in that comment and swap the label:

`node scripts/linear.mjs label {{TASK_ID}} --add ready-for-human --remove ready-for-agent`

Do not push the branch and do not open a pull request. A later phase does that.

Once the work is complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TICKET.
