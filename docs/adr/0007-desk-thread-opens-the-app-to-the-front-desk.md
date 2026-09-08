# A Desk Thread to the front desk, the third narrowing of the no-communication rule

A Player standing on a wet court, or under a broken light on court 3, has no way to reach the venue from inside the app: the desk's number is not shown, and ADR-0005 deliberately kept the app from becoming a communication channel. We open one more channel — a **Desk Thread**, text Messages between one Player and the venue's front desk, inside the app — and keep the rest of the rule intact: no Player ↔ Player chat, no Player directory, no contact that outlives what it is for.

This is the third time the same rule has been narrowed, and each narrowing had its own reason. ADR-0005 let a Player show their own number to the others on one Booking, because Open Bookings put strangers on one court. Coach messaging opens a Coach ↔ Player channel, because a Coach is a known, Staff-approved person rather than a stranger. This one opens Player ↔ front desk for a reason unlike either: the other side is the venue itself. There is no stranger to introduce, no number to protect (a Player never sees a Staff member's, and Staff already hold the Player's), and nothing that connects one Player to another. That is why the rule survives being narrowed here — a Desk Thread adds no path between two Players.

The PO's raw idea was a video call between the Booker and the owner. We did not build one, for the reasons ADR-0005 already records: a web app cannot ring a phone that is not showing the page; WebRTC does not run inside Zalo's in-app browser, where most Players open the app; and masked calling has no Vietnamese offer under the venue's ceiling of 300,000 ₫ a month. The desk side of a call would have been fine — a desktop sitting in the app all day — but the Player side is where a call has to land, and that side is still blocked.

## Considered Options

- **Show the venue's phone number or Zalo in the app.** Costs nothing and needs no code. Rejected: it moves the conversation out of the app the moment it starts, leaves the desk with no record of what was said, and does nothing for a Player who is already inside the app with their Booking on screen.
- **In-app voice or video call**, hosted (Daily, LiveKit) or self-hosted signalling. Rejected for the reasons above, unchanged since ADR-0005.
- **A hosted chat vendor.** Rejected: the cheapest credible offer starts around $349 a month, far past this venue's budget. Built in-house on the existing Postgres stack instead.
- **A thread per Booking, or a thread per topic.** Rejected: at one venue with one desk, a Player has one relationship with the venue, and per-topic threads make Staff decide where a message belongs before they can answer it. The desk instead sees the Player's Bookings for today beside the thread, which answers "where are they standing" without attaching a Message to a Booking.
- **Assigning threads to individual Staff.** Rejected: the desk is one or two people on a shift, and the shared unread badge is exactly the handoff between shifts.
- **Announcements to every Player, and Staff-internal chat.** Not built; separate efforts if ever wanted.

## Consequences

- **One Desk Thread per Player, never closing**, existing from the moment the Player record exists. Because a Player is one verified phone number (ADR-0001), a shared phone means a shared Player record and therefore a shared Desk Thread — a household sees each other's messages to the desk. And a desk-created Player record later taken over by self-signup keeps its Desk Thread along with the rest of its history.
- **What a Message stores**: its text, its author, and the moment it was sent. What it does not: any edit, any deletion, any expiry. Messages are kept indefinitely. A Message from the desk additionally records the Staff account that wrote it, shown to Staff and never to the Player.
- **Nothing enters the Audit Log.** The thread, with per-Message Staff attribution, is the record. The Audit Log stays about actions that change Bookings and settings. Staff accounts are deactivated rather than deleted, so attribution on old Messages survives an offboarding.
- **A Booking Ban does not silence a Player.** The ban blocks booking, not talking. There is no rate limit and no anti-spam rule: at a single phone-verified venue, abuse is handled by Staff in person.
- **No push, no SMS, no browser notification, for either side.** A Player learns of a reply from an in-app unread badge; the desk learns from the shared unread badge, the tab title and an alert sound on a page that is already open. This keeps the promise of no new infrastructure and is the reason the desk's alerting is bounded by what an ordinary browser tab can do.
- **Staff read every Desk Thread.** A Player writing to the desk is writing to the venue, not to one person, and the app says so. This is the opposite of Coach messaging, where Staff stand outside the conversation — the two channels are deliberately different, because the desk *is* the party being addressed.
- **If Player ↔ Player chat is ever wanted, it is a fresh effort.** This ADR does not open it, and ADR-0005's rule against it still stands.
