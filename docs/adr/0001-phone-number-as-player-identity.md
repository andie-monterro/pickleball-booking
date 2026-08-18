# Phone number as player identity

A Player is identified by exactly one phone number, verified by a one-time code at signup. The venue's front desk already knows players by phone (bookings today arrive by text and Zalo group), so phone is the one identifier that works both for self-signup and for staff creating a record at the desk — staff can key it in for a walk-in, and a later self-signup with the same number takes over that record instead of creating a duplicate. Verification is required because takeover would otherwise let anyone claim another person's record and history.

## Considered Options

- **Zalo login** — familiar to the player base, but ties the app to Zalo (which the app is meant to replace as a workflow) and gives the desk no identifier it can type in for a walk-in.
- **Email + password** — cheap to build, but players rarely use email here, and nothing stops duplicate accounts, which would undermine no-show tracking.
- **Google login** — same desk problem as Zalo, and not universal among the player base.

## Consequences

- One number = one account: a household sharing a phone shares a Player record and its history (accepted for v1).
- Signup needs an SMS/OTP delivery provider — a cost and vendor choice that lands with the tech-stack decision (AND-16).
