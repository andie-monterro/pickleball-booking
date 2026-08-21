# Coding Standards

The real standards live in the repo — read them, they are the source of truth:

- `AGENTS.md` — how this repo works: commit convention (conventional prefix plus the Linear ticket id in parentheses), issue tracker, domain docs.
- `CONTEXT.md` — the domain glossary (Court, Slot, Booking, Booker, Player, Member, Casual player, Block, Walk-in, Staff, Strike, Booking Horizon…). Code, tests, and user-facing copy must use these terms in these exact senses.
- `docs/adr/` — the decisions already made. A change that contradicts an ADR is a finding unless the same branch updates the ADR.
- `node_modules/next/dist/docs/` — this Next.js version differs from model training data. Route, server, and config code must follow those guides.

## Review checklist on top of the above

- TypeScript strict. No `any` and no type assertion without a comment justifying it.
- Every acceptance criterion on the ticket has a direct test. A criterion with no test is a finding.
- Vocabulary drift is a finding: a new name for a concept that `CONTEXT.md` already names is wrong even when the code works.
- Database changes go through a `node-pg-migrate` migration in `migrations/`. No schema change applied by hand, and no edit to a migration that already ran.
- Tests use the real Postgres from `tests/setup/global-setup.ts` and the harness in `tests/harness/`. No new mock of the database layer.
- Secrets and one-time codes never reach a log or a response. OTP values are printed only behind the existing debug flags (`OTP_DEBUG`, `OTP_CONSOLE_SECRET`).
- Errors that reach the user say what to do next, in the plain language the rest of the app uses.
