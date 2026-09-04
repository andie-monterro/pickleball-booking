# A flat Slot Price enters the app only to split the Court Fee; the app keeps a ledger and moves no money

v1 kept every notion of money out of the app: no in-app payment, and no prices "not even display-only" (Scope the v1 cut, AND-6). Players pay the venue at the desk, by cash or bank-transfer QR, when they come to play. Open Bookings (ADR-0004) then put a Booker and several Takers who may not know each other on one court, with one person paying the whole court and collecting the rest by hand over Zalo. The PO asked for "thanh toán chung" — shared payment. We read that as splitting the court fee between co-players, and we reverse exactly one part of the v1 rule: Staff set **one flat Slot Price** in venue settings, so the app can compute a Booking's Court Fee and divide it equally into Shares over a Booker-stated Head Count. The price exists for that division only. The app remains a **ledger** between co-players — it records what each Taker owes the Booker and whether the Booker has marked it paid — and never moves money, stores payment details, or shows how to pay. The venue's desk is untouched: the Booker still pays the venue, as today.

## Considered Options

- **In-app payment through a provider** (PayOS, SePay, MoMo, ZaloPay, VNPay — see the survey on branch `research/vietnam-payment-routes`) — rejected, as in v1: it brings fees, reconciliation, refunds and a second counterpart for the desk, for a venue whose players already pay at the desk without friction.
- **No price in the app; the Booker types the amount to divide** — rejected: the venue's price is one flat number the venue owns, and a Booker-typed amount turns every split into a claim rather than a fact, inviting the very disputes the ledger is meant to end.
- **Price tiers** (peak hours, Member vs Casual) — rejected: they reopen the peak-pricing question v1 closed, and the split needs only one number.
- **Showing the price on the availability grid and in the booking flow** — rejected: the price is an input to the split, not a product feature; showing it makes the app look like a payment channel it is not.

## Consequences

- v1's "no prices in the app" becomes "no prices shown to Players except inside a Fee Split". The Slot Price is a venue setting like Opening Hours: Staff change it, the change is audit-logged, and it appears nowhere on the public grid or in booking.
- The app's Court Fee is computed, not observed. If the desk charges a Booker something else (a discount, a Member deal), the split does not know; the Booker and Takers settle the difference between themselves, as they do everything else about paying.
- Ledger-only is what makes the reversal safe: because the app moves no money and shows no account or QR, the Slot Price cannot be wrong in a way that costs anyone money — it can only make a Share wrong, which the Booker can see and the people can argue about.
- Staff, the Audit Log and the desk stay outside the split. Nothing about Shares or paid marks is Staff-visible or audit-logged; only the Slot Price change is.
- If in-app payment is ever wanted, it is a fresh effort that starts from the provider survey above, and this ADR is superseded rather than stretched.
