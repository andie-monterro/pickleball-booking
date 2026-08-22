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
A Player whose Staff-set membership end date ("member until") has not passed. The date is the last venue day of membership: the Player is a Member for the whole of that day, and a casual player from the next venue day. The app only recognizes membership — selling and renewing it happens outside the app.
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
The record of Staff actions — who did what, and when — kept so disputes stay resolvable. Every Staff-made creation, cancellation, Block change, No-show mark or undo, and Strike waiver is attributed to an individual Staff account.
_Avoid_: History, activity feed

**Opening Hours**:
The venue's bookable window, defined per day of week and aligned to whole hours. Slots exist only inside Opening Hours; one-off closures are expressed as Blocks, not hours changes.
_Avoid_: Schedule, business hours

**Booking Horizon**:
How far ahead a Booking may be made, per player standing: 14 days for Members, 7 days for Casual players (venue settings; these are the defaults). The horizon is whole-day: a Booking may be made for any day inside the Booker's horizon — the next 14 (Member) or 7 (Casual player) whole venue days starting today — and a day is entirely open or entirely closed. A day enters the horizon at the start of the venue day it becomes bookable. Standing is judged when the Booking is created — a Booking stays valid if membership ends before play.
_Avoid_: Booking window, advance period

**Cancellation Cutoff**:
How close to a Booking's start the Booker may still cancel penalty-free: 6 hours before the first Slot. Independently of the cutoff, a Booking may be cancelled penalty-free within 15 minutes of its creation. Cancelling is possible only until the Booking starts; a cancelled Slot reopens for booking immediately.
_Avoid_: Deadline, cancellation window

**Late Cancel**:
A Booker's cancellation after the Cancellation Cutoff (and outside the 15-minute creation grace). Allowed, but earns the Booker one Strike.
_Avoid_: Late cancellation fee, no-cancel

**No-show**:
A Booking whose Booker never arrived, marked by Staff any time after the Booking starts. Earns the Booker one Strike. The mark is undoable and audit-logged; the app enforces no waiting period — Staff judge.
_Avoid_: Absence, missed booking

**Strike**:
A mark against a Player for a Late Cancel or a No-show. Counts toward a Booking Ban for 90 days from the date it was earned, then stops counting. Staff may waive any Strike (audit-logged). Players see their own Strike count in the app. The same rules apply to Members and Casual players.
_Avoid_: Penalty point, flag, demerit

**Booking Ban**:
14 days without self-service booking, started whenever a new Strike brings a Player to 3 or more Strikes within 90 days. Existing Bookings are kept, and Staff may still create Bookings for a banned Player at the desk. The Player sees the ban end date in the app.
_Avoid_: Suspension, lockout, block
