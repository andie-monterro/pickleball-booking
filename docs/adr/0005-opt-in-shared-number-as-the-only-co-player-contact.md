# Opt-in Shared Number as the only contact channel between co-players

Open Bookings put people who may not know each other on one court, and ADR-0004 keeps their phone numbers private: the Booker and the Takers see each other by display name only. That leaves nobody able to say "I am at court 3, where are you?" — the venue's Zalo group and the front desk cannot connect two people who have never exchanged numbers, which is exactly the situation Open Bookings creates. The Open Bookings effort had also ruled that the app does not become a communication channel. We narrow that rule by exactly one channel: a Player may show their own phone number, by their own choice and for one Booking at a time, to the others on that Booking — a Shared Number. Everything else in the rule stands: no text chat, no Player directory, no contact that outlives the Booking.

We chose showing the real number over building a call because the moment of need is when the other person is not looking at the app, and a web app cannot ring a closed phone (web push is at best an ordinary notification, and on iOS only after a Home Screen install); because most Players open the app from links inside Zalo, whose in-app browser does not run WebRTC; and because masked calling has no Vietnamese offer under the venue's ceiling of 300,000 ₫ a month. Sharing costs nothing, needs no new infrastructure, and reaches a person through the phone and Zalo they already use. The biggest comparable, Playtomic, shares real phone numbers between match co-players.

## Considered Options

- **Leave contact outside the app** (desk, Zalo group) — rejected: the desk holds every number but would have to relay every call by hand, and the group cannot introduce two strangers.
- **In-app text chat** — what every surveyed sports app does. Rejected: it makes the app a messaging product with moderation, notifications and an inbox, which the Open Bookings effort explicitly refused.
- **In-app voice or video call** (hosted WebRTC such as Daily or LiveKit, or self-hosted signalling) — essentially free at one-venue scale, but cannot ring a phone that is not showing the page and does not run inside Zalo's browser. Rejected.
- **Masked calling through a provider** (Stringee, Twilio, telco APIs) — hides the number, but Twilio has no Vietnamese numbers and Stringee publishes no price; far over the ceiling. Rejected.
- **Always show numbers to co-players** (Playtomic's model) — rejected: it breaks ADR-0001's promise that the app never shows a Player's number to other Players.

## Consequences

- ADR-0001's "a phone number is never shown to other Players" becomes "never shown by the app on its own". A number appears only when its owner chooses, on one Booking, and can be hidden again.
- Hiding is only as good as the app: a number already seen cannot be unseen. Withdrawing a Shared Number hides it at once for everyone, and the app says plainly, when a Player shares, that people who already saw it may still have it.
- The app keeps only the current choice per person per Booking — no sharing history, no copy of the number, nothing in the Audit Log. Staff neither set nor see Shared Numbers through the app; the desk keeps calling Players on the numbers it already holds. Protections beyond withdrawal (reporting to Staff, a per-Player block) are decided separately and may add stored state.
- If in-app calling is ever wanted, it is a fresh effort — the constraints above (no ring from a web app, no WebRTC inside Zalo) would have to change first.
