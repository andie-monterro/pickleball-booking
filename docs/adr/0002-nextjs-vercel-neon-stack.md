# Next.js on Vercel with Neon Postgres, OTP via Prelude

The app is built and maintained by one person driving AI coding agents, on a running budget under ~$25/month, with zero appetite for server maintenance. We chose a full-stack **Next.js (TypeScript)** app hosted on **Vercel** with **Postgres on Neon** (Singapore region, close to the players in Vietnam). TypeScript/Next.js is the ecosystem both the maintainer and AI agents handle best; Vercel is fully managed and Next.js-native; Postgres gives transactional guarantees (unique constraints) that make no-double-booking a database invariant rather than application logic.

Phone verification codes (required by [ADR-0001](0001-phone-number-as-player-identity.md)) are sent via **Prelude's Verify API v2** (`api.prelude.dev`). SpeedSMS was the original choice but turned out unusable in practice (AND-19); the maintainer already has a working Prelude account and API key from another project. All OTP sending goes through a small provider adapter so switching providers (e.g. to Twilio) is an hour's work, not a rewrite.

## Considered Options

- **Hosting**: Railway, Fly.io, Cloudflare Workers — all workable; Vercel won on zero-ops, Next.js fit, and an existing account.
- **Database**: Supabase (its bundled phone auth only supports expensive global SMS providers, so the bundle added nothing), Turso/SQLite, PlanetScale — Neon won on plain managed Postgres with a free tier and a Singapore region.
- **OTP delivery**: SpeedSMS.vn was the original primary choice (~250–500 VND/message, no business paperwork per their docs), but the PO could not get a usable account (AND-19). Zalo ZNS is cheaper-per-message and the most trusted channel in Vietnam, but requires business registration papers and Zalo Official Account approval — worth revisiting post-v1 if the venue provides its papers. Twilio-only was rejected as the primary channel at 15–30× the local per-message price.

## Consequences

- Expected running cost: ~$21–24/month once live (Vercel Pro $20 — the free Hobby tier disallows commercial use — plus a few dollars of SMS; Neon free tier). Free while still in development.
- The Prelude API key lives in the app's `.env` (gitignored) as `PRELUDE_API_KEY`.
- Auth is hand-rolled OTP + sessions against the adapter (or a library with a custom SMS sender); turnkey phone-auth services (Firebase, Supabase Auth) were ruled out because none supports a cheap Vietnamese SMS route.
