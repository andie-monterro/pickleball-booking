# Pickleball Booking

Court booking for a single pickleball venue: players see availability and book courts themselves; the front desk manages the same schedule for walk-ins and phone calls.

## Language

**Court**:
A bookable playing surface at the venue, identified by name/number only. Courts are interchangeable in quality — no court carries attributes players choose between.
_Avoid_: Field, lane, resource

**Slot**:
One court for one fixed 60-minute window starting on the hour. The atomic unit of availability.
_Avoid_: Timeslot, session, hour

**Booking**:
A claim on 1–2 consecutive Slots on a single Court, held by exactly one Booker. Front-desk-created bookings (walk-ins, phone) are ordinary Bookings.
_Avoid_: Reservation, appointment

**Booker**:
The single Player responsible for a Booking — they cancel it and bear its policy consequences. Other people playing on the court are not tracked.
_Avoid_: Customer, organizer

**Player**:
A person known to the system, identified by exactly one verified phone number. The record holds only a display name and the phone number. Created by open self-signup, or by Staff at the desk for a Walk-in; a later self-signup with the same phone number takes over the desk-created record and its history. A shared phone means a shared Player record.
_Avoid_: User, customer, account

**Member**:
A Player whose Staff-set membership end date ("member until") lies in the future; when it passes, the Player is a casual player again. The app only recognizes membership — selling and renewing it happens outside the app.
_Avoid_: Subscriber, VIP

**Casual player**:
Any Player who is not currently a Member. The default standing — no record marks it.
_Avoid_: Guest, non-member

**Block**:
Staff-made unavailability of a Court for a range of Slots (maintenance, private events). Occupies Slots like a Booking but has no Booker and no policy or payment semantics. A Block can only be placed on free Slots — it never cancels Bookings; conflicting Bookings must be cancelled explicitly first.
_Avoid_: Closure, hold, maintenance booking

**Walk-in**:
A player booking in person or by phone at the front desk. Results in an ordinary Booking created by staff — not a separate concept. Its Booker is a Player; Staff create a light Player record (name + phone) at the desk if none exists.

**Staff**:
A venue-side user with an individual account and full powers: create or cancel any Booking (at any time, penalty-free), place Blocks, change venue settings, and manage Staff accounts. A single role — there is no separate admin. Staff Bookings follow the same Booking rules as player Bookings.
_Avoid_: Admin, manager, operator

**Audit Log**:
The record of Staff actions — who did what, and when — kept so disputes stay resolvable. Every Staff-made creation, cancellation, or Block change is attributed to an individual Staff account.
_Avoid_: History, activity feed

**Opening Hours**:
The venue's bookable window, defined per day of week and aligned to whole hours. Slots exist only inside Opening Hours; one-off closures are expressed as Blocks, not hours changes.
_Avoid_: Schedule, business hours

**Booking Horizon**:
How far ahead a Booking may be made: 7 days for the base case. A Slot is bookable from the moment it enters the horizon until its start time.
_Avoid_: Booking window, advance period
