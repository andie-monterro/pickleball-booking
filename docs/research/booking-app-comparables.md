# Booking App Comparables: Cancellation, No-Show, Member Priority, Recurring, and Peak Pricing Policies

This research feeds product-policy decisions for a single-venue pickleball booking app being planned in Vietnam. It surveys how established court/venue booking products document five policy areas in their own primary sources (help centers, docs, pricing/membership pages, terms of service).

**Note on method:** Every claim below is cited to a specific URL that was fetched and read directly. Where a product's own docs are silent on a topic, that gap is stated explicitly rather than inferred or guessed. Several help-center domains (Zendesk-hosted Playtomic/Skedda, Intercom-hosted CourtReserve/PlayByPoint/CityPickle) block generic fetchers; those pages were retrieved through a text-extraction proxy but the content quoted is the rendered page text, not a search snippet.

---

## 1. Cancellation windows

### Playtomic
Cancellation windows for **court reservations are set by each club**, not by Playtomic globally: "The deadline to cancel a reservation, i.e., the reservation cancellation policy, is set by the clubs themselves; some clubs allow cancellation all the time, some with one day's notice, and some do not allow cancellation at all." Once a reservation falls outside a club's allowed window, "Playtomic cannot cancel them since we cannot bypass the club's rules." (Source: https://playerhelp.playtomic.com/hc/en-gb/articles/19831519179281-FAQ-Players-Playtomic)

For **Open Matches** specifically, Playtomic does set a platform-wide rule: if the match is not yet full, a player can cancel anytime with no restriction; once the match is full, a player can cancel "up to 24 hours before the start time," and cancellation is not possible in-app within that 24-hour window. (Source: https://playerhelp.playtomic.com/hc/en-gb/articles/19831672824465-Cancellation-Policy-for-Open-Matches-Padel-Tennis)

Playtomic also charges a small **cancellation fee** on player-made bookings (app/website), varying by country/currency (e.g., €0.50 in Spain, €0.95 in Germany/Ireland/Finland, AED 4.12 in the UAE). This fee does not apply to open matches, leagues, tournaments, or classes, and there is a 1-hour grace period after booking during which changes are free. (Source: https://playerhelp.playtomic.com/hc/en-gb/articles/19831791848721-Cancellation-fee)

### CourtReserve
Cancellation is fully venue-configurable through admin settings: "Allow Members to Cancel Reservation" (on/off), "Hours before Reservation can be Canceled Without Penalty" (a grace-period cutoff), and "Prevent Member from Cancelling a Reservation within X Hours" (a hard lockout window). Clubs can also require a cancellation reason and show custom messaging once a member is outside the allowed window. (Source: https://help.courtreserve.com/en/articles/4799536-booking-settings-general)

### Skedda
Skedda offers venues four named, configurable "Lock-in" cancellation models: **Open** (cancel up to N hours *after* the booking ends), **Flexible** (cancel any time before it begins), **Moderate** (cancel only before it starts, no post-start changes), and **Strict** (a fixed lock-in margin before start, e.g., a 5-hour lock-in on a 6pm booking becomes locked at 1pm that day). Once locked in, a regular user cannot self-serve cancel; only admins can. Bookings paid "Upfront" are always locked-in and cannot be self-cancelled at all. (Source: https://support.skedda.com/en/articles/105751-lock-in-cancellation-end-early-policy)

### PlayByPoint
Two distinct, club-configurable rules govern cancellation: "**Hours Prior Permitted to Cancel**" (when the cancel button itself becomes disabled — e.g., "Members may cancel all the way up to 4 hours in advance; non-members 24") and "**Hours prior to cancel without penalty**" (the penalty-free window, independently configurable — e.g., "Non-members can cancel up to 12 hours in advance without penalty, members 4 hours"). Separately, admin-only "Refund Policy" rules define what happens on a timely vs. late cancellation (e.g., refund as credit if cancelled within 24 hours; a fee or partial refund if cancelled late). (Source: https://help.playbypoint.com/en/articles/11395832-all-reservation-rules-explained)

A real venue built on PlayByPoint, **GO Pickle** (Australia), publishes concrete numbers: full refund to original payment method if cancelled 24+ hours ahead; free reschedule (to an alternate slot or club credit) if done 8+ hours ahead; after that, the booking cannot be cancelled in full without a fee; pending payments are auto-charged after 1 hour of play. Guest-pass bookings are non-refundable once used. (Source: https://gopickle.playbypoint.com/f/GOpickle/pages/cancelation-polcy)

### CityPickle (US pickleball venue chain, own booking system)
"If you cancel your reservation at least 24 hours prior to your scheduled start time you will not be charged." Cancellations within 24 hours incur the full charge; in practice, no card is even charged until the booking enters that 24-hour window. Special events/tournaments may carry stricter, separately-communicated windows. (Source: https://help.city-pickle.com/en/articles/224705)

### Pickle Planner
No universal cancellation window is documented on Pickle Planner's own marketing/FAQ pages — policy is left to each club to configure and communicate. One example cited in a third-party search snippet (a specific club's own page, not Pickle Planner's own docs) mentioned a "5-day/120-hour" window, illustrating that individual organizations set their own numbers on the platform. (Source: https://pickleplanner.com/faqs — confirms the platform is subscription/config-based, not that a specific window is built in)

### Vietnam-local: Alobo
Alobo (a general multi-sport, Vietnam-based court-booking platform used for pickleball, badminton, football, etc.) provides venues a "Terms & Policy" configuration screen with an example refund schedule shown directly in its own help docs: **cancel 24+ hours ahead → 100% refund; cancel 6–24 hours ahead → 50% refund; cancel under 6 hours or no-show → 0% refund.** This is presented as a suggested template for venue owners to fill in themselves, not a fixed platform rule. (Source: https://wiki.alobo.vn/article/huong-dan-cai-dat-dieu-khoan-va-quy-dinh-tai-san/)

### Vietnam-local: Picki
Match/session organizers on Picki can set a "hạn chót hủy kèo" (cancellation deadline), with the app's own example being **30 minutes before start time**, and can optionally enable a late-cancellation penalty (see No-show section below). This is a per-match, organizer-set deadline rather than a platform-wide or venue-wide policy. (Source: https://picki.com.vn/)

> **Common conventions:** Every platform that actually operates real bookings (Playtomic, CourtReserve, Skedda, PlayByPoint, CityPickle, Alobo) converges on the same shape: a **single cutoff window, expressed in hours before start**, after which cancellation either becomes impossible or forfeits payment. **24 hours** recurs constantly as the default "safe" cutoff (Playtomic open matches, CityPickle, GO Pickle's full-refund threshold, Alobo's 100%-refund example). Below that cutoff, the near-universal consequence is loss of some or all of the payment, not a separate "penalty" mechanism.

> **Notable variants:** (1) Alobo's example uses a **graduated three-tier refund schedule** (100%/50%/0%) rather than one hard cutoff — a smoother approach than the single on/off cutoff nearly everyone else uses. (2) PlayByPoint and Skedda uniquely separate "when can you even press cancel" from "when do you stop being penalized" into two independently configurable settings, letting a venue allow cancellation but still charge a fee. (3) Playtomic's platform-wide policy applies only to Open Matches; ordinary court reservations are entirely delegated to each club with no platform floor or ceiling. (4) Picki's 30-minute example deadline is far shorter than every other product's default, reflecting its use case (casual pickup matches rather than paid court rentals).

---

## 2. No-show consequences

### Playtomic
Documented only for **Open Matches**: a player who neither attends nor cancels 24+ hours ahead can be reported by other players to Customer Care. The absent player "will be charged for the court fees" — a debt is created in-app that must be paid before the account can be used again. Attending players who paid online are refunded (up to 10 days to process); wallet-credit payments are not refundable. The match result is voided so it doesn't affect skill ratings. (Source: https://playerhelp.playtomic.com/hc/en-gb/articles/43240624037393-What-happens-if-a-player-doesn-t-show-up)

### CourtReserve
No dedicated no-show article was found in the general Booking Settings or Player FAQ docs; no-show appears to be handled through the same "penalty cancellations" counter used for late cancellations — "Remove Ability to book after X Penalty Cancellations" blocks future booking once a member accumulates enough penalized cancellations/no-shows. (Source: https://help.courtreserve.com/en/articles/4799536-booking-settings-general) A dedicated, separate no-show policy page was not found — **gap**.

### Skedda
Skedda has **no dedicated no-show feature**. Its own guidance is that venues should write their no-show terms into their own venue Terms & Conditions; Skedda's role is limited to supporting tools like strict lock-in (to reduce no-shows via non-refundable upfront payment) and an "Occupancy Tracking"/check-in feature. (Source: search of support.skedda.com confirmed no dedicated article exists; https://support.skedda.com/en/articles/112700-booking-conditions confirms the Booking Conditions feature also does not address no-shows) — **explicit gap, by design (Skedda is a configurable platform).**

### PlayByPoint
Has a dedicated, named feature: "**No-Show Rules and Penalties**" — clubs configure rules that "enforce penalties for users who fail to show up," which "can be configured to send warnings or temporarily restrict booking privileges." No-shows are tracked over a club-configurable "Days Back to Count the No Shows" rolling window, and admins can view a player's no-show history from their profile. Exact penalty severity (warning vs. suspension vs. fee) is left to the club to configure — the doc does not prescribe a default. (Source: https://help.playbypoint.com/en/articles/11723427-no-show-rules-and-penalties)

### CityPickle
No dedicated no-show article was found in the fetched help pages; the 24-hour cancellation policy implies a no-show is treated the same as a late cancellation (full charge), but this was not explicitly confirmed in CityPickle's own docs — **gap, not confirmed.**

### Vietnam-local: Alobo
No-show is folded directly into the cancellation/refund policy example: "Hủy dưới 6 giờ hoặc không đến: không hoàn tiền" ("Cancel under 6 hours, or don't show up: no refund"). There is no separate strike, warning, or ban mechanism documented — the only consequence shown is forfeiting the payment already collected. (Source: https://wiki.alobo.vn/article/huong-dan-cai-dat-dieu-khoan-va-quy-dinh-tai-san/)

### Vietnam-local: Picki
If the match organizer enables "Phạt hủy muộn" (late-cancellation penalty), a player who cancels after the deadline "sẽ bị ghi nợ xấu trong CLB" — automatically recorded with a "bad debt" / negative mark inside the club's internal system. This is a **reputation/record-based penalty within the club**, not an automatic monetary charge or platform-wide ban — it relies on the club's own social/administrative follow-up. (Source: https://picki.com.vn/)

> **Common conventions:** Where a no-show consequence is documented at all (Playtomic, PlayByPoint, Alobo, Picki), it is **either the same "forfeit the payment/fee" mechanism used for late cancellation, or an escalating-strike system that restricts future booking after repeated incidents** — never both a fee and an unconditional ban on the very first no-show.

> **Notable variants:** Skedda and (as far as could be found) CourtReserve's dedicated docs and CityPickle treat no-show as an extension of the cancellation policy rather than a first-class, separately named concept — Skedda explicitly pushes this responsibility to the venue's own T&Cs. PlayByPoint is the only product with a purpose-built "count no-shows over a rolling window, then restrict" strike system comparable to what larger membership clubs use. Picki's "bad debt" record is notably **non-monetary and non-automated in its consequence** — it flags the player but leaves enforcement (e.g., removing them from the club) to a human admin.

---

## 3. Member vs. casual/guest priority

### Playtomic
Handled through the "**Club Membership**" feature: a club can give members custom "Booking Privileges" that differ from the default applied to everyone else, including a **longer/different "Booking ahead days"** window, different max-bookings-per-day, active-booking limits, and a separate (often shorter) cancellation-policy window. Pricing rules attached to a membership can apply per-court/day/time discounts (including bigger discounts specifically for off-peak hours), and clubs choose whether the membership discount is visible/purchasable online, onsite, or both. (Source: https://helpmanager.playtomic.com/hc/en-gb/articles/20534703609745-Club-Membership-Feature)

### CourtReserve
Advance-booking windows are natively segmented by membership type: "administrators can limit how far in advance users can make court reservations... It is possible to set different limits for each membership type." CourtReserve's own marketing page gives the canonical example: "Members might be allowed to book 48 hours in advance while non-members get a 24-hour window," and separately, "Prime Time" (peak) reservation counts can be capped per membership tier (e.g., limit members to two prime-time bookings per week; restrict guest access to evenings entirely). (Sources: https://help.courtreserve.com/en/articles/4799536-booking-settings-general and https://courtreserve.com/pickleball-court-scheduling-software-features/)

### Skedda
Handled via "**User Tags**": a tag lets a venue configure preferential booking windows by tag ("members might book 14 days ahead while others book only 7 days out" is Skedda's own example), space visibility restrictions, differential pricing ("users with the Friends tag pay $10/hr after 6pm; everyone else pays $15/hr"), and usage quotas per tag (e.g., students 2 hrs/week, members 5 hrs/week). Untagged users get default access unless a rule explicitly restricts them. (Source: https://support.skedda.com/en/articles/105772-user-tags)

### PlayByPoint
The most granular of the products surveyed. Key terms distinguish a "**Guest**" (no account), a "**Non-Member**" (has an account, no active membership), and "**Affiliation**" (the rule container for membership tiers). Documented rule types include: separate advance-booking windows per affiliation and surface (its own example: "Members can book courts 10 days in advance, non-members only 2 days"; another: "Tennis courts are available to book approximately 5 days in advance, while pickleball courts have a 7-day booking window"); guests blocked from booking before a set hour; guest-count caps per member; surface restrictions (e.g., "Only members can book clay courts; non-members limited to hard courts"); forced full payment for non-members vs. split-payment eligibility for members; and free player slots as a member perk. (Source: https://help.playbypoint.com/en/articles/11395832-all-reservation-rules-explained)

### CityPickle
A direct, concrete real-world match to the "members book further out" pattern: **members get 14-day advance booking, non-members get 7 days.** Members also receive 20% off hourly court rentals (member must be present), 20% off programming, and — notably — **50% off "off-peak open play"** specifically for members. (Sources: https://www.city-pickle.com/membership and https://help.city-pickle.com/en/articles/265985)

### Vietnam-local: Picki
Distinguishes club members ("thành viên") from external invited guests ("khách mời"): a match organizer can enable "Thu phí khách mời" to charge guests a different (typically higher) fee than members for the same match — a fee-based differentiation rather than a booking-window differentiation. No member-specific advance-booking-window feature was found in Picki's own docs. (Source: https://picki.com.vn/)

### Vietnam-local: Alobo
Uses a "Gói Hội Viên" (membership package) / "Xé vé" (session-ticket) model: venues sell time-blocked ticket packages (e.g., "Xé vé sáng/chiều/tối" — morning/afternoon/evening ticket bundles, or monthly/quarterly bundles) with configurable usage limits per session/day/month. This is a **prepaid-bundle model tied to time blocks**, rather than an earlier-booking-window privilege — a materially different mechanism for "member advantage" than the day-count-based windows used by the Western products. (Source: https://wiki.alobo.vn/article/huong-dan-mo-hinh-kinh-doanh-ghv/)

> **Common conventions:** Every configurable platform (CourtReserve, Skedda, PlayByPoint) and the one fully-documented single venue (CityPickle) implement member priority the same two ways simultaneously: **(a) members can book further in advance than casual/non-members**, and **(b) members pay a discounted rate**. The specific numbers vary, but "members book earlier + pay less" is the dominant, near-universal pattern. CityPickle's real 14-day-member/7-day-non-member split is the cleanest confirmed real-world instance of the exact pattern named in this research's brief.

> **Notable variants:** PlayByPoint goes further than the rest by also gating **which physical surfaces/courts** a tier can book at all (e.g., members-only clay courts), not just timing and price. Playtomic ties membership less to booking-window priority and more to a bundled discount/wallet product sold as a subscription. The two Vietnam-local examples (Picki, Alobo) skip the "earlier booking window" mechanic entirely — Picki differentiates by per-match guest fee, and Alobo differentiates by selling prepaid time-blocked session bundles — suggesting the "book N days earlier" convention common in the US/EU products may not be the natural first pattern to reach for in a Vietnam-market casual/social pickleball context.

---

## 4. Standing/recurring bookings

### Playtomic
Recurring "**Recurring Series**" bookings can only be created by **club staff in Playtomic Manager — players cannot create a recurring reservation from the app themselves** ("Can players create recurring reservations from the app? No, you must do them from Playtomic Manager."). A series has one payment type and one price policy for its owner; other participants can be added per-occurrence. Notably, "the club's cancellation policy only applies to the booking owner, not to other participants in the series" — participants can leave a recurring match at any time regardless of the venue's cancellation window. No explicit rule was found in Playtomic's docs for what happens when a one-off booking attempt conflicts with an existing recurring series — the series simply occupies its slots on the schedule like any other reservation. (Source: https://helpmanager.playtomic.com/hc/en-gb/articles/20535145594513-Recurring-booking-series)

### CourtReserve
CourtReserve's own marketing describes recurring reservations as available to members directly ("lock in weekly, biweekly, or custom-interval court times with automated conflict detection that accounts for leagues, events, maintenance blocks, and holiday closures") — but this is a marketing claim, not the more granular help-center documentation available for booking limits; no help-center article on the specific mechanics of recurring-vs-one-off conflict resolution was found during this research — **gap in help-center-level detail, though the capability itself is confirmed to exist.** (Source: https://courtreserve.com/pickleball-court-scheduling-software-features/)

### Skedda
"Repeat Bookings" are available to all admin roles by default; a venue can also grant this ability to regular (non-admin) users, and can restrict it to specific user tags, or disable it for non-admins entirely ("If you don't want non-admin users to be able to create repeat bookings, you can choose to enable this feature only for users with certain tags (or nobody at all)"). Any repeat-booking attempt still has to satisfy the venue's normal booking window, booking conditions, and hours-of-availability rules for every occurrence. Skedda's own docs do **not** describe a specific mechanism for resolving conflicts between an existing repeat series and a new one-off booking attempt — ordinary space/time double-booking prevention is presumably what applies, but this was not explicitly stated. (Source: https://support.skedda.com/en/articles/105723-repeat-bookings)

### PlayByPoint
PlayByPoint's recurring capability is built primarily for **Programs** (clinics/lessons/leagues with a season-long schedule) rather than an individual player's standing personal court reservation: "Customers can book a specific number of sessions per week for the entire length of a program," and clubs use a "Mass Schedule" option to set up recurring weekly programs/lessons. No PlayByPoint article was found describing a "standing reservation" feature for an individual member's personal recurring court slot outside of Programs, nor a documented conflict-resolution rule between a recurring Program and an ad-hoc single booking — **gap.** (Source: https://help.playbypoint.com/en/articles/11395832-all-reservation-rules-explained and search of help.playbypoint.com)

### Vietnam-local: Picki
Offers a lightweight "lưu làm mẫu" (save as template) feature so an organizer can quickly recreate a previous match/session's settings — this reduces friction for regularly-repeated matches but is a **manual re-creation shortcut, not an automated recurring series** that reserves future slots on its own. (Source: https://picki.com.vn/)

### Vietnam-local: Alobo
No explicit "recurring booking" feature was found in the fetched pages; however, Alobo's membership/ticket-package model (monthly/quarterly bundles tied to a specific daily time block, e.g., "Xé vé 7h-10h") functions as an implicit standing arrangement — the customer is effectively committing to the same time-of-day slot repeatedly for the life of the package, administered through debt/usage tracking rather than a calendar-recurrence engine. (Source: https://wiki.alobo.vn/article/huong-dan-mo-hinh-kinh-doanh-ghv/)

> **Common conventions:** Where recurring bookings exist at all (Playtomic, CourtReserve, Skedda), creation is **either restricted to admins/staff by default or explicitly configurable to be admin-only** — none of the surveyed products default to letting any casual player set up an unsupervised standing reservation. Where documented, the recurring booking still has to individually satisfy the venue's normal booking-window/availability rules for every occurrence (Skedda states this explicitly; Playtomic's per-occurrence pricing logic implies the same).

> **Notable variants:** None of the five non-Vietnam products had a clearly documented, explicit rule for **how a conflict between an existing standing/recurring booking and a new one-off booking request is resolved** — this was the single biggest documentation gap found across the whole research task, on every product. Playtomic is the one product that explicitly decouples cancellation-policy enforcement for the series owner vs. other participants. PlayByPoint's recurring mechanism is scoped to lesson/clinic Programs, not personal standing court time, which is a materially different feature from what "member gets a standing weekly slot" usually means in a pickleball club context. Both Vietnam-local examples substitute a lighter-weight mechanism (a reusable template, or a prepaid time-blocked bundle) instead of a true recurring-reservation engine.

---

## 5. Peak-hour pricing

### Playtomic
Peak pricing is handled at two levels. First, availability engineering: Playtomic Manager's "Reservation Rules" documentation explicitly recommends **pairing looser booking rules with lower prices in low-occupancy hours, and stricter "avoid unbookable time" rules in high-occupancy (peak) hours** to maximize court utilization — its own worked example splits a day into "Low Occupancy Hours (10am–3pm)" with flexible rules and "High Occupancy Hours (3pm–10:30pm)" with strict, gap-free rules. (Source: https://helpmanager.playtomic.com/hc/en-gb/articles/20535323617425-Availability-Fixed-Flexible-reservations) Second, within the Club Membership feature, clubs can configure "Advanced Pricing" rules that vary by court/day/time, explicitly suggesting "bigger discounts during off-peak hours" for members. (Source: https://helpmanager.playtomic.com/hc/en-gb/articles/20534703609745-Club-Membership-Feature)

### CourtReserve
"Prime Time" is CourtReserve's named peak-hour construct: venues define one or more prime-time blocks, then can cap prime-time reservation counts by membership tier and optionally layer dynamic pricing on top (per the "Booking Settings: Restrictions" doc and CourtReserve's own marketing copy: "restrict high-demand court times by membership tier, enforce per-player booking limits during peak hours, and optionally apply dynamic pricing"). CourtReserve's own blog gives a concrete illustrative example rather than a fixed rule: "If your courts are always busier and more in demand after 4pm on weekdays, then you'll want to have higher prices then compared with quieter periods during the middle of the day or on the weekend" — i.e., **evenings/weekdays as peak, midday/weekends as off-peak**, but this is guidance, not a platform default. (Sources: https://help.courtreserve.com/en/articles/8071325-booking-settings-restrictions and https://courtreserve.com/how-to-price-your-pickleball-court-time-for-maximum-profit/)

### Skedda
Skedda's "Pricing Rules" are the most explicitly generalized: a rule can be based on "which space(s) is selected, duration, time of the day, day of the week, and user tag," evaluated in order (first matching rule wins), with no charge applied if nothing matches. Skedda's own worked example prices a tennis court differently for a >4-hour booking and for members vs. non-members, illustrating that peak/off-peak is just one more condition a venue can add to the same rule system — Skedda does not itself define what "peak" means; it only supplies the time-of-day/day-of-week condition primitives. (Source: https://support.skedda.com/en/articles/105740-pricing-rules)

### PlayByPoint
Peak/off-peak is a first-class concept called "**Shift**" ("a block of time (such as 'Primetime' or 'Lowtime') that your club defines"), and the Reservation Pricing grid is configured by **surface × shift × affiliation** simultaneously — meaning a club can set a different price for the same court, at the same skill of player, purely based on which shift (peak vs. off-peak) it falls in. Reservation Rules such as guest limits, max-reservations-per-user, and minimum-player counts can also all be scoped to a specific shift. (Sources: https://help.playbypoint.com/en/articles/12286844-reservation-pricing and https://help.playbypoint.com/en/articles/11395832-all-reservation-rules-explained)

### CityPickle
Confirms peak/off-peak differential pricing exists in practice, though CityPickle's own pages define it only through a member benefit rather than stating explicit peak hours: members get "50% Off Off-Peak Open Play" (vs. the standard 20% member discount on regular court rentals), implying a standard (peak) price and a separately discounted off-peak price exist, without the exact off-peak hours being stated on the pages fetched. (Source: https://www.city-pickle.com/membership)

### Vietnam-local
No Vietnam-local product's own documentation (Picki, Pickcourt, Alobo) was found to explicitly define peak vs. off-peak pricing rules or specific hour ranges — **explicit gap.** Alobo's session-ticket packages are organized around named time blocks ("sáng/chiều/tối" — morning/afternoon/evening), which strongly implies Vietnamese venues price differently by time-of-day in practice, but Alobo's own docs do not state specific price differentials or explicitly label any block as "peak." This is noted as an inference, not a confirmed primary-source claim.

> **Common conventions:** Every non-Vietnam product that documents pricing at all (Playtomic, CourtReserve, Skedda, PlayByPoint) lets a venue define peak/off-peak **by time-of-day and day-of-week as independent, combinable conditions**, not as a single fixed global rule — the platforms supply the mechanism; each individual venue supplies its own actual hours and price gap. Where an illustrative example is given at all, evenings/weekday-after-work hours are consistently cast as peak and midday/weekend as off-peak (CourtReserve's own example; Playtomic's own worked example).

> **Notable variants:** PlayByPoint is the only product that promotes peak/off-peak ("Shift") to a named, first-class scheduling primitive that other rules (guest limits, player minimums, not just price) also key off of — in the others, peak/off-peak is just one condition among several in a generic pricing-rule engine. CityPickle is the only real venue in this set that ties its off-peak differential specifically to membership status (50% off *for members* in off-peak) rather than applying an off-peak discount to everyone. No product or Vietnam-local example in this research documents a country- or city-specific universal peak-hour convention (e.g., a fixed "5–9pm is peak" industry norm) — every peak/off-peak window found is venue-specific.

---

## Implications for a single-venue Vietnam pickleball app

*(This section is the author's synthesis based on the research above — not a sourced fact, and should be treated as a starting hypothesis to validate with the actual venue owner, not a settled decision.)*

- **Cancellation:** A single hard cutoff (e.g., 24 hours = full refund/no charge, inside 24 hours = forfeit) is the simplest pattern to build and matches what most products converge on (Playtomic Open Matches, CityPickle, GO Pickle, Alobo's top tier). A single-venue app doesn't need Skedda/PlayByPoint's per-affiliation dual-setting complexity (separate "can cancel" vs. "cancel without penalty" cutoffs) unless the venue specifically wants members to get a shorter/friendlier window than casual players — which is easy to add later as one extra field, not a reason to build the two-setting complexity up front.
- **No-show:** Given a single venue (not a multi-venue SaaS needing configurability for many different owners), a lightweight approach in the spirit of Picki's "bad debt" flag or Alobo's "treat no-show like a very-late cancellation" (same forfeit-the-fee rule, no separate strike system) is proportionate. PlayByPoint's full strike-counter/rolling-window system is aimed at larger multi-admin clubs and is likely over-engineering for one venue at launch.
- **Member vs. casual priority:** The clearest, most copy-able pattern is CityPickle's real-world one: **members get an earlier booking window (e.g., +7 days) and a discounted rate**; this is well understood by players (it's the same mental model as airline/hotel status tiers) and doesn't require PlayByPoint-level granularity (per-surface restrictions, per-shift guest caps) that a single small venue is unlikely to need on day one.
- **Standing/recurring bookings:** Every product studied restricts *creation* of recurring bookings to staff/admins (or makes it admin-configurable) — a single venue should default to **staff-created recurring bookings only**, at least initially, rather than building self-service recurring booking for players. The unresolved "recurring vs. one-off conflict" gap found across every product studied is worth deciding explicitly and early (e.g., a simple rule: a standing booking blocks that slot permanently until staff release it, full stop) rather than assuming an off-the-shelf convention exists to copy.
- **Peak-hour pricing:** The universal pattern (venue defines its own peak/off-peak time blocks and a price differential; evenings and weekends being typical Vietnam pickleball peak times is a reasonable starting assumption for a single social/recreational venue, though this should be confirmed against the specific venue's actual observed demand, not assumed from Western court-sport data) is straightforward to implement as two or three named time bands with distinct prices, without needing a full generic rule engine like Skedda's or PlayByPoint's "Shift" abstraction — that generality mainly pays off for a multi-venue platform, which this is explicitly not.
