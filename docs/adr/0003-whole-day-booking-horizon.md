# Whole-day Booking Horizon

The Booking Horizon is evaluated by venue date, so each date is either fully open or fully closed. We rejected a rolling-instant horizon because a day-level member-only label cannot describe an instant-level rule. Production exposed this mismatch when a member-only date still showed 52 of 64 Slots as bookable.
