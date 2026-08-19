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

## Testing

Tests call route handlers over the HTTP seam (real `Request` in, real `Response` out — see `tests/harness/http.ts`) against a real test Postgres. Time-dependent code reads the injectable clock in `src/lib/clock.ts`; tests set it with `setClock(fixedClock(...))`.

## Availability

`GET /api/availability?date=YYYY-MM-DD` is the public read model — no session, occupancy only (`free`, `taken`, `blocked`, `outside_horizon`), never booker identity. `date` defaults to today in venue time. The same read model renders the grid on `/`.

Venue settings are data, not code: Courts (`courts`), per-weekday Opening Hours (`opening_hours`) and the Booking Horizon (`venue_settings`) are seeded by migrations, and changing the rows changes the grid. Slots are derived from Courts and Opening Hours at read time and never stored; only claims on them are (`slot_claims`).

## Health

`GET /api/health` reports app and database status.
