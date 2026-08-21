# pickleball-booking

Court booking app for a single pickleball venue. Full-stack Next.js (TypeScript) on Vercel, Postgres on Neon. See `CONTEXT.md` for the domain glossary and `docs/adr/` for the binding decisions.

## Production setup

One-time provisioning (Neon database, Vercel import, first deploy) is guided by a wizard:

```sh
./scripts/setup-production.sh
```

## Development

Requires Node 22+ and Docker (tests provision a throwaway Postgres container).

```sh
npm install
npm test            # full suite (starts a Postgres testcontainer)
npm run typecheck
npm run dev         # needs DATABASE_URL in .env (see .env.example)
```

## Database migrations

Migrations live in `migrations/` (node-pg-migrate). They run against `DATABASE_URL`:

```sh
npm run migrate:up
npm run migrate:create -- <name>
```

On Vercel, `vercel-build` runs migrations before `next build`.

## The first Staff account

Staff use the same phone sign-in as Players; the staff role is a grant on the
Player record. The desk page is itself behind that role, so the first account is
granted from the command line:

```sh
DATABASE_URL=... npm run staff:grant -- +84901234567 "Desk One"
DATABASE_URL=... npm run staff:grant -- --revoke +84901234567
```

Then that person signs in at `/sign-in` and opens `/staff`.

From there on, Staff onboard and offboard each other in the app: the Staff
accounts panel on `/staff` grants the role to a phone number and takes it away
again, and both actions land in the Audit Log. The last remaining account cannot
be deactivated, so the desk always keeps a way in.

## Testing

Tests call route handlers over the HTTP seam (real `Request` in, real `Response` out — see `tests/harness/http.ts`) against a real test Postgres. Time-dependent code reads the injectable clock in `src/lib/clock.ts`; tests set it with `setClock(fixedClock(...))`.

## Health

`GET /api/health` reports app and database status.
