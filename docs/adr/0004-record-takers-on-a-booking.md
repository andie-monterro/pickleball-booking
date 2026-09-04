# Record Takers on a Booking

v1 deliberately knew only the Booker: "other people playing on the court are not tracked". Open Bookings drop that rule — a Booker may say how many more Players they need, and the Players who take those Spots are recorded on the Booking. We chose this because the alternative is what the venue does today: people find partners in the Zalo group, at the front desk, or by ringing their own friends, and the app can see none of it, so it can neither show a Player what they have joined nor let the desk answer "who is on court 3".

## Considered Options

- **Leave matching outside the app** — cheapest, and the Zalo group already works after a fashion. Rejected: the venue asked for this precisely because the group scales badly and the desk carries the rest by memory.
- **Record co-players without naming them** — store only a headcount, so the app knows a court is full without knowing who. Rejected: a Player must be able to see what they joined, which needs a name against a Spot.

## Consequences

- The app now holds a record of who played with whom. Phone numbers stay private (ADR-0001 makes the phone number the identity): Takers and Bookers see each other by display name only.
- Removing this later means deleting data Players have relied on, not just hiding a screen.
- Responsibility does not spread with the record: the Booker alone carries Late Cancel, No-show and Strike. Recording a Taker is not making them accountable.
