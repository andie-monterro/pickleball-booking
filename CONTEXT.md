# Pickleball Booking

Court booking for a single pickleball venue: players see availability and book courts themselves; the front desk manages the same schedule for walk-ins and phone calls.

## Language

**Court**:
A bookable playing surface at the venue, identified by name/number only. Courts are interchangeable in quality — no court carries attributes players choose between. Staff add and rename Courts, and take one out of booking when the venue stops using it; a Court is never deleted, because Bookings and Audit Log entries name it. A Court holding Bookings still to be played cannot be taken out of booking until those Bookings are cancelled.
_Avoid_: Field, lane, resource

**Slot**:
One court for one fixed 60-minute window starting on the hour. The atomic unit of availability.
_Avoid_: Timeslot, session, hour

**Booking**:
A claim on 1–2 consecutive Slots on a single Court, held by exactly one Booker. Front-desk-created bookings (walk-ins, phone) are ordinary Bookings. A Booker may open their Booking to other Players — see Open Booking — and may divide its Court Fee among the people on it — see Fee Split.
_Avoid_: Reservation, appointment

**Booker**:
The single Player responsible for a Booking — they cancel it and bear its policy consequences. Takers on the Booking are recorded too, but bear none of those consequences.
_Avoid_: Customer, organizer

**Open Booking**:
A Booking whose Booker has said they still need more Players, stated as a number of Spots. The state lives on the Booking itself — it is not a separate thing with its own life, and it can neither precede nor outlive its Booking. The Booker may add a short free-text note saying what they are looking for. A Booking is an Open Booking exactly while its Spot count is above zero. It stops being one when the last Spot is taken — an ordinary Booking that happens to have Takers — and becomes one again by itself if a Taker gives a Spot up. The state ends for good when the Booking starts, and when the Booking is cancelled.
_Avoid_: Invite, open match, public booking

**Spot**:
One player position a Booker still needs on their Booking. Spots are counted, never individually identified: the Booker states how many they need, and the count falls as Players take them. Nothing tells one Spot from another. Only positions offered through the app are Spots — friends the Booker brings along themselves are not Spots, and the app never knows about them.
_Avoid_: Slot (a Slot is one court-hour; a Spot is a person's place on a Booking), seat, place

**Taker**:
A Player who has taken a Spot on someone else's Booking, recorded on that Booking. First come, first served — there is no request and no approval from the Booker. A Taker bears none of the Booking's policy consequences: no Late Cancel, no No-show, no Strike. A Taker may give the Spot up at any time until the Booking starts, with no consequence, and it reopens immediately for someone else. Nothing else takes a Spot away: the Booker cannot remove a Taker, and the Cancellation Cutoff does not apply to a Taker. Cancelling the Booking voids every Spot on it at once. When the Booking has a Fee Split, the Taker holds one Share of its Court Fee.
_Avoid_: Guest (see Casual player), joiner, co-player, participant

**Shared Number**:
A Player's phone number, shown by that Player's own choice to everyone else on one Booking — its Booker and its Takers, including Takers who join later. The choice belongs to the person's place on that Booking (the Booker's, or a Taker's Spot), never to the Player record: each Booking needs its own choice, default off, and only the owner turns it on or off, in the app. It is not reciprocal — seeing a Shared Number does not require having one — and there is no way to ask someone to share. A Shared Number exists only on a Booking that has been opened to other Players, from the moment the Booking is opened (for the Booker) or the Spot is taken (for a Taker), and it disappears at once when the owner withdraws it, gives their Spot up, or the Booking is cancelled or its last Slot ends; afterwards nothing shows that it was ever shared. The app knows only the current choice — never a history of sharing, never a copy of the number. Staff stand outside: they neither set nor see Shared Numbers through the app, and nothing about them enters the Audit Log. A Booking Ban leaves them untouched.
_Avoid_: Contact, Call, phone sharing, number sharing, co-player contact

**Slot Price**:
The venue's one flat price for one Slot, in whole VND, set by Staff in venue settings (audit-logged like every venue settings change). The same for Members and Casual players and at every hour. It exists only as the input to a Fee Split: the app shows it nowhere else — not on the availability grid, not in the booking flow — and it is not a record of what the desk charges; the desk keeps charging the Booker exactly as before.
_Avoid_: Rate, tariff, hourly price, court price, fee

**Court Fee**:
A Booking's computed cost: its number of Slots × the Slot Price. A figure the app works out in order to divide it, never a record of what the Booker actually paid at the desk. Until the Booking starts it follows the current Slot Price; from the start it is fixed with the Slot Price then in force.
_Avoid_: Booking price, total, bill, cost

**Fee Split**:
A Booking's state of having its Court Fee divided equally over a Head Count, turned on by the Booker for that one Booking. The state lives on the Booking, like Open Booking. It needs a Booking that has been opened to other Players — Takers need not exist yet — is offered when the Booking is opened, and can be turned on or off at any time until the Booking starts; default off. While on, everyone on the Booking sees the Shares. Turning it off removes every Share and every paid mark, and nothing remembers it was on: before the start the app keeps only the current state. At the start the Fee Split locks — Head Count, Slot Price and Shares stay fixed forever in the Booking's history, and only paid marks can still change. Cancelling the Booking voids every Share. Staff stand outside: they set the Slot Price and nothing else, they see no Fee Split, and nothing about one enters the Audit Log. The app records who owes and who has paid; it never moves money and never shows how to pay.
_Avoid_: Shared payment, split bill, bill split, payment, settlement, "thanh toán chung"

**Head Count**:
The number of people the Booker says will play on the Booking and share its Court Fee: the Booker, every Spot whether taken or not, and any guests the Booker brings along outside the app. The Booker states it when turning on the Fee Split, and only the Booker changes it, until the Booking starts. Taking or giving up a Spot does not change it, so a Taker knows their Share before they take.
_Avoid_: Party size, player count, number of players, group size

**Share**:
One equal part of a Booking's Court Fee: Court Fee ÷ Head Count. Everyone on the Booking holds one; the Booker's own Share exists for the arithmetic and is never marked. A Taker's Share is unpaid until the Booker marks it paid; only the Booker marks and unmarks, at any time, also after the Booking starts. The Taker sees their own Share and its mark and cannot mark it themselves. A Share belongs to its holder's place on the Booking — the Booker's, or a Taker's Spot — never to the Player record, so one Player may hold Shares on several Bookings at once. Guests outside the app are counted in the Head Count but hold no Share the app knows of.
_Avoid_: Portion, debt, contribution, amount owed, payment

**Player**:
A person known to the system, identified by exactly one verified phone number. The record holds only a display name and the phone number. Created by open self-signup, or by Staff at the desk for a Walk-in; a later self-signup with the same phone number takes over the desk-created record and its history. A shared phone means a shared Player record.
_Avoid_: User, customer, account

**Member**:
A Player whose Staff-set membership end date ("member until") has not passed. Staff set and clear that date at the desk. The date is the last venue day of membership: the Player is a Member for the whole of that day, and a casual player from the next venue day. The app only recognizes membership — selling and renewing it happens outside the app.
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
The record of Staff actions — who did what, and when — kept so disputes stay resolvable. Every Staff-made creation, cancellation, Block change, No-show mark or undo, Strike waiver, venue settings change and membership date change is attributed to an individual Staff account.
_Avoid_: History, activity feed

**Opening Hours**:
The venue's bookable window, defined per day of week and aligned to whole hours. Slots exist only inside Opening Hours; one-off closures are expressed as Blocks, not hours changes. Staff set one opening and closing hour per weekday, or close the weekday entirely. Hours that would no longer cover a Booking still to be played are refused until that Booking is cancelled.
_Avoid_: Schedule, business hours

**Booking Horizon**:
How far ahead a Booking may be made, per player standing: 14 days for Members, 7 days for Casual players (venue settings; these are the defaults). The horizon is whole-day: a Booking may be made for any day inside the Booker's horizon — the next 14 (Member) or 7 (Casual player) whole venue days starting today — and a day is entirely open or entirely closed. A day enters the horizon at the start of the venue day it becomes bookable. Standing is judged when the Booking is created — a Booking stays valid if membership ends before play. Taking a Spot on someone else's Booking obeys the same horizon, judged once, when the Spot is taken.
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
14 days without self-service booking, started whenever a new Strike brings a Player to 3 or more Strikes within 90 days. Existing Bookings are kept, and Staff may still create Bookings for a banned Player at the desk. A banned Player also cannot take a Spot; Spots taken before the ban are kept, and a banned Player may still give a Spot up. The Player sees the ban end date in the app.
_Avoid_: Suspension, lockout, block
