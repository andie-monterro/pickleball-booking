# Grab deep links and the rider's own saved places (AND-141)

## Question

If a Grab deep link could say *"take this rider to the place **they** have already saved as Home"*,
the app would never need to hold a home address at all, and the ADR-0001 tension on the map
([AND-139](https://linear.app/andie-monterro/issue/AND-139)) would disappear. Can it?

Four sub-questions, settled against vendor documentation:

1. Does any documented `grab://open?...` parameter — or any other Grab hand-off surface — let the
   caller reference the **rider's own saved place** ("Home", "Work", a favourite) by name or id,
   instead of supplying explicit coordinates?
2. If not: what happens if the deep link supplies a **pickup only** and leaves the destination
   empty? Does Grab open on a destination picker with the rider's saved places already listed?
3. Does `dropOffAddress` accept a **free-text address without coordinates**, and does Grab resolve
   it? This decides whether the app needs a geocoding/maps provider.
4. Is there a documented limit on how a third party may pre-fill a rider's destination — terms of
   service, partner-tier gating, or a registered-partner requirement?

### This document zooms, it does not repeat

`docs/research/vietnam-ride-services.md` on branch `research/vietnam-ride-services` (AND-98) already
established the base facts and is **not** restated here:

- `grab://open?...` accepts `dropOffLatitude` / `dropOffLongitude` / `pickUpLatitude` /
  `pickUpLongitude` / `dropOffAddress` / `pickUpAddress` / `screenType` / `taxiTypeId` / `sourceID`.
- The link is vendor-documented only as a **field in a Farefeed API response**
  (`directDeepLink` / `deepLink`), not as a standalone published URL scheme.
- Grab is the only one of five Vietnamese ride services with any usable deep link at all.

That document's source caution carries over verbatim and is repeated here because it matters:
several third-party "Grab API" OpenAPI specs found online — **apis.io, apisscore.com,
publicapi.dev, github.com/api-evangelist/grab**, and RapidAPI listings — are **not vendor-published
and are unverified or likely fabricated**. None of them was used as a source for any claim below.

Primary/vendor here means `developer.grab.com`, `grab.com` (including Grab's help and marketing
pages), and Grab's own GitHub organisation `github.com/grab`. Everything else is labelled informal.
Every inference is labelled as an inference.

---

## 1. Can a deep link name the rider's own saved place? — **No. Undocumented, and this is a clean negative.**

**Finding: not found.** No documented parameter, field, or endpoint anywhere on
`developer.grab.com` lets a caller reference a rider's own saved Grab place (Home, Work, a
favourite) by name or id in place of explicit latitude/longitude.

What was checked, and what was found:

| Surface checked | Result | Source |
|---|---|---|
| Farefeed request schema (the only documented Rides API, and the thing that generates the deep link) | Defines `pickUp` and `dropOff` as objects of `latitude`, `longitude`, `address` only. No `placeId`, `savedPlaceId`, `placeName`, or any symbolic-destination field exists in the schema. | https://developer.grab.com/docs/partner-farefeed/ |
| Full developer-portal product index | Lists Delivery/Express, GrabMall, Payments, GrabKios, Partner Apps, GrabFood, Login With Grab (Identity), Farefeed (Rides), Grab For Business, GrabMart, GrabDefence, Loyalty, Communications. There is **no** "Places", "Saved Places", or "Favourites" API category at all. | https://developer.grab.com/docs/ |
| Login With Grab / GrabId — the one surface that could plausibly carry rider-personal data | Documented purpose is authentication only: sign in with a Grab account, obtain access/ID tokens, read basic ID-token information (expiry, partner user id). Grab's own SDK README shows only placeholder scopes (`"gid_test_scope_1 gid_test_scope_2 gid_test_scope_3 openid"`) and documents **no** address, place, favourite, or location scope. It does not mention rides, destinations, or deep links at all. | https://github.com/grab/grabplatform-sdk-ios (Grab's own GitHub organisation) |
| Targeted searches for `saved place`, `favourite location`, `home address`, `place ID`, `savedPlaceId` scoped to developer.grab.com | Nothing relevant returned. | — |

**Do not confuse this with GrabMaps.** `grabmaps.grab.com` (fetched directly for this document) is a
real Grab product page — "Hyperlocal mapping technology and location data solutions for
businesses" — but it does not document a "Place ID" field or any partner-facing API schema at all;
the word "place" appears only once, in generic marketing copy. Whether GrabMaps exposes a Place-ID
concept to partners anywhere is **unverified** (an informal, third-party AWS Location Service page
lists GrabMaps as a geocoding data provider — see Gaps — but that is not GrabMaps' own
documentation). Even if it does, a GrabMaps place id would identify a **public map entity** (a POI,
a building), not a **specific rider's personal Home/Work/favourite entry** — the two concepts are
not the same thing, and nothing anywhere documents passing either kind of id into `grab://open`.

**Verdict.** A symbolic, rider-owned destination is **undocumented**. This is a finding, not a
failure: the check covered the ride API's actual schema, the complete documented product index, and
the identity surface that would have had to carry such data. Strictly, "undocumented" is not the
same as "impossible" — Grab could hold an unpublished parameter — but there is no vendor basis to
design against one, and building on an undocumented parameter would be building on sand.

**Consequence for the map:** the ADR-0001 tension is **not** dissolved by this route. If the app
pre-fills a destination, the app must supply coordinates, and it must get them from somewhere.

---

## 2. Pickup-only, destination left empty — the near-equivalent, and why it is not free

### What the vendor documents

**Via Farefeed, pickup-only is not possible at all — this is vendor-documented.** The Farefeed
request schema marks `dropOff`, `dropOff.latitude`, `dropOff.longitude` and `dropOff.address` all
**"Required"**, and the same for `pickUp`. The docs describe a 400 error case: *"When
Latitude/Longitude are missing. Latitude and Longitude should be valid."*
(https://developer.grab.com/docs/partner-farefeed/). A Farefeed call with no destination is
rejected, so it never returns a `directDeepLink` to open.

**Via a hand-built `grab://open?...` URL, the behaviour is undocumented.** Grab documents the deep
link only as a response field, never as a scheme with its own published parameter contract. Nothing
on `developer.grab.com` states what the Grab app does when it receives a `grab://open` URL with the
`dropOff*` parameters simply absent. There is no vendor statement either way.

**Grab's saved-places feature itself is vendor-confirmed**, independently of any deep link:

> "Saved Places is a new way to save your frequently used pickup and dropoff addresses all at one
> place" ... "The addresses will appear as a shortcut every time you book a ride"
> — https://www.grab.com/kh/en/saved-places/ , https://www.grab.com/my/saved-places/ (vendor pages)

So the normal Grab booking flow does surface the rider's own Home/Work/favourites as one-tap
shortcuts. A dedicated Help Centre article exists at
`https://help.grab.com/passenger/en-ph/360020645352`, but it returned an error page on direct fetch,
so its exact wording could not be quoted; the two grab.com marketing pages above carry the same
claim in citable form.

### Inference, clearly marked as such

**(Inference — not vendor-confirmed.)** It is plausible that a hand-built
`grab://open?pickUpLatitude=…&pickUpLongitude=…&screenType=BOOKING` with no `dropOff*` parameters
falls through to the Grab app's normal destination-entry screen, which independently surfaces the
rider's saved places. This is reasoning from the absence of a contrary statement, not a documented
guarantee. Grab could equally show an error, a blank map, or a fresh app home screen when fields
its own API marks Required are missing. **This is exactly the kind of claim that a five-minute phone
test settles and that no amount of further reading will** — see Gaps.

### What the app would actually look like under this design

The app opens a `grab://open` link with the pickup pre-filled to the venue's coordinates and every
destination parameter omitted. The rider lands on Grab's own destination screen. If that rider has
already saved a "Home" place **inside their own Grab app**, they tap it once and they are done. If
they have not, they type an address there — exactly as they would have if they had opened Grab
themselves with no link at all.

The app stores nothing. It never asks for a home address, never keeps one on the device, and never
needs geocoding. ADR-0001 is untouched, and [AND-142](https://linear.app/andie-monterro/issue/AND-142)
(how the address is kept on the device) and [AND-140](https://linear.app/andie-monterro/issue/AND-140)
(what Vietnam's personal-data law requires for a home address) would both fall away, because there
would be no address anywhere.

**But the app also cannot set up or detect the rider's saved Grab places.** It cannot tell whether
this rider has a Home saved, cannot create one for them, and cannot know afterwards whether the tap
happened. The benefit lands only on riders who already curate their own Grab account, and the app
can never tell which riders those are.

### ⚠️ This collides with a settled decision on the map — surfacing, not routing around

[AND-139](https://linear.app/andie-monterro/issue/AND-139) decision 1 records that **the PO was
offered the thinner "pickup only" option and rejected it**, because Grab's GPS already solves the
pickup and pre-filling only the pickup adds almost nothing. The fallback described here **is** that
pickup-only option as far as the app is concerned. The rider's experience differs from opening Grab
fresh only in that the pickup pin is already correct.

So this is not a free zero-storage win that the map has not yet considered. It is the option the PO
has already turned down, now re-appearing as the only route that needs no address. Presenting it as
a new option would be routing around decision 1. If the map wants it, decision 1 has to be
reopened with the PO, with the honest trade named: **no address anywhere, versus one fewer tap for
riders who have curated Grab's saved places.**

---

## 3. Does `dropOffAddress` take free text that Grab resolves? — **Documented evidence says no: the caller must geocode.**

**Finding.** Grab's schema documents `address` as a **required companion to** latitude/longitude,
not as a substitute that Grab geocodes on its own. Exact quotes from
https://developer.grab.com/docs/partner-farefeed/ (request schema):

- `pickUp.address` — *"**Required.** Address of the pick-up point."*
- `dropOff.address` — *"**Required.** Address of the drop-off point."*
- `dropOff.latitude` — *"**Required.** Latitude of the drop-off point"*
- `dropOff.longitude` — *"**Required.** Latitude of the drop-off point"* — the vendor doc literally
  repeats "Latitude" in the longitude field's description; quoted verbatim, `sic`.
- `directDeepLink` — *"A valid url that can be used to redirect to Grab App... All the search
  parameters will be pre filled in the Grab App."*

Address and coordinates are marked Required **side by side for the same point**. The docs never
present the address as an either/or alternative to coordinates, and never state that Grab geocodes
the address string server-side. The only failure mode documented is a 400 on missing or invalid
latitude/longitude, which reinforces that coordinates are the load-bearing input and must already be
valid when the caller submits them.

**Verdict, unhedged: on the documented evidence, the app would need its own geocoding/maps
provider** to turn what a Player types into coordinates before building a link. The
`dropOffAddress` string is best read as a display label that rides along with the coordinates.

**What is genuinely undocumented.** Two things, and they are narrower than the verdict:

- What Grab does with the address string once the fare and deep link are generated — pure display
  text on the confirmation screen, or something more — is not documented.
- Whether a **hand-built** `grab://open?dropOffAddress=<free text>&screenType=BOOKING` with no
  coordinates resolves anyway. The Required markings above govern the **Farefeed API request**, not
  the URL scheme. A hand-built link is a different code path and Grab publishes no contract for it.
  It is possible the app resolves the text; it is equally possible it ignores the parameter or
  errors. **(Inference: the fact that Grab's own generator always pairs address with coordinates is
  weak evidence that the app expects both — but only a test settles it.)** See Gaps.

**Cost note for the map.** A geocoding provider is a new third-party dependency and a real cost.
The map already flags this under "Not yet specified" and correctly conditions it on this ticket.
The answer is: **yes, on documented evidence it bites** — unless the Gaps test below overturns it,
or unless the map takes the section-2 route and stores no address at all.

---

## 4. Documented limits on third-party destination pre-fill

**Finding: every partner-facing surface on `developer.grab.com` gates behind manual approval, not
self-serve signup — but the one page that would state a destination-pre-fill-specific limit could
not be read.**

What is confirmed, quoted directly from vendor pages:

| Surface | What is documented | Source |
|---|---|---|
| Grab ID / Login With Grab (the account/auth layer partner apps sit on) | *"The process to set up your account with Grab is manual. Contact the GrabID team to get help with your initial setup."* Partner ID, Partner Secret, Client ID/Secret and Merchant ID are issued only after this manual setup; redirect URIs must be pre-registered; OAuth scopes beyond the base `openid` scope are "distributed during partner onboarding," gated by an account manager. | https://developer.grab.com/docs/grab-id/ |
| Partner Apps program (embedding inside Grab's super-app — a different integration, not deep-linking out) | *"Contact our partnerships team to discuss onboarding at partnerapp.partnerships@grabtaxi.com."* | https://developer.grab.com/docs/partner-apps/ |
| Farefeed (the API that generates the `grab://open` deep link) | Requires OAuth2 client-credentials access (`ride.estimate` scope), which is obtained the same way — by registering as a Grab partner, not anonymous self-serve. No self-serve API-key signup form exists on the portal. | https://developer.grab.com/docs/partner-farefeed/ (already established in `vietnam-ride-services.md`, re-confirmed here) |
| Grab Developer Terms of Use — the page that would most likely state a specific destination-pre-fill restriction | Page exists at `https://developer.grab.com/pages/terms-of-use` but is a client-rendered single-page app; both a direct fetch and a plain `curl` returned only an empty React shell with no readable clause text. **Confirmed to exist, content not retrievable by this research method** — this is an access gap, not a confirmed-absent finding. | https://developer.grab.com/pages/terms-of-use |
| Grab's Vietnamese consumer transport ToS (already reviewed in `vietnam-ride-services.md`, AND-98) | Defines and permits the human-staffed Concierge/"Web-booked Ride" flow (2.12, 2.14); forbids account/identity delegation (3.1.8) and unauthorized commercial exploitation of app content (3.1.7). Neither clause names deep links, destination pre-fill, or a third-party web app redirecting into the rider's own, separately-authenticated Grab app. | https://www.grab.com/vn/terms-policies/transport-delivery-logistics/ |

**Verdict.** Two separate things are true and should not be conflated:

- **Getting a Farefeed API credential (the vendor-documented route to a `directDeepLink`) requires
  becoming an approved Grab partner** — a manual, sales/account-manager-gated process with no
  published tier list, fee schedule, or SLA on approval time. This is confirmed across three
  independent developer-portal pages (Grab ID, Partner Apps, Farefeed's own OAuth requirement).
- **Whether a hand-built `grab://open?...` link — constructed without ever calling Farefeed, and
  without any Grab partner credential at all — is separately restricted is not confirmed either
  way.** The one page that would most plausibly say so (`pages/terms-of-use`) could not be read.
  Nothing in the consumer ToS (the only ToS text this research could actually read, across both this
  document and AND-98) names deep links or third-party destination pre-fill at all. **(Inference:**
  a same-origin app-to-app URI scheme redirect is architecturally different from calling Grab's
  backend under partner credentials, and Grab's own Farefeed docs present `grab://open` as *output*
  the caller receives and hands to the OS, not an API the caller calls directly — so it is plausible
  the deep link itself sits outside the partner-terms perimeter even though obtaining it via Farefeed
  does not. This is reasoning from document structure, not a vendor statement, and should not be
  relied on without the Gaps test below.**)

---

## Summary

| # | Question | Answer |
|---|---|---|
| 1 | Can a deep link name the rider's own saved Grab place instead of coordinates? | **No — undocumented.** Checked against the only Rides API's request/response schema, the full developer-portal product index, and the one identity surface (Login With Grab) that could plausibly carry personal place data. None expose a symbolic-place parameter. Clean negative, not a search failure. |
| 2 | Pickup-only, destination left empty — does Grab show a saved-places picker? | **Via Farefeed: no, not possible — destination is a documented Required field, so no deep link is even generated without one.** Via a hand-built `grab://open` link with `dropOff*` omitted: **undocumented either way.** Separately, Grab's own Saved Places feature is vendor-confirmed to surface Home/Work/favourites as one-tap shortcuts in the *normal* booking flow — so the plausible (inferred, untested) real-world behaviour is a near-equivalent to the zero-storage design the ticket describes, but it is exactly the pickup-only option the map's decision 1 already rejected once, and any reuse must go back to the PO, not route around that decision. |
| 3 | Does `dropOffAddress` accept free text that Grab geocodes? | **On documented evidence, no** — Farefeed's schema requires `address` and `latitude`/`longitude` together for the same point, never as alternatives, and never states server-side geocoding of the address string. The app would need its own geocoding/maps provider to turn typed text into coordinates before building a link, unless it takes the no-address (section 2) route instead. Whether a hand-built link with address-only (no coordinates) resolves is separately undocumented. |
| 4 | Documented limits on third-party destination pre-fill? | **Getting the vendor-documented route to a deep link (Farefeed) requires becoming an approved Grab partner** — manual, sales-gated, no published tiers or fees. Whether a hand-built deep link outside that credentialed path carries its own restriction is unresolved: the one page most likely to say so (Grab's Developer Terms of Use) could not be read (JS-rendered, empty on fetch), and the consumer ToS this research *could* read never mentions deep links or destination pre-fill. |

**Bottom line for the map.** The "reference the rider's saved place directly" idea in the ticket's
framing does not exist as a documented capability — it would have to be built on an undocumented
parameter, which is not a sound design basis. The nearest real equivalent — pickup-only, let Grab's
own picker surface the rider's saved places — is technically plausible but unverified, and it is not
a new discovery: it is the same "pickup only" shape the PO already rejected on this map (decision 1),
so re-adopting it is a decision for the PO, not a research conclusion. On the free-text destination
question, documented evidence points to "no, Grab does not geocode for you," meaning a maps/geocoding
provider is a real, live cost if the map goes with a pre-filled destination address rather than the
no-address route.

## Gaps / follow-up tests

- **Read `https://developer.grab.com/pages/terms-of-use` with a real browser (not a fetch tool).**
  It is a JS-rendered SPA; both `curl` and this research's fetch tooling returned only an empty
  shell. This is the single most decision-relevant unread document in this research — it is the one
  place Grab would state a destination-pre-fill-specific restriction, if one exists. Minimal test:
  open the URL in an actual browser (or a headless browser with JS execution) and read the clause
  text directly.
- **Device test: does a hand-built `grab://open?pickUpLatitude=…&pickUpLongitude=…&screenType=BOOKING`
  URL (destination parameters omitted entirely, no Farefeed call made) open Grab's normal
  destination-entry screen with the rider's Saved Places offered as shortcuts?** This is the load-
  bearing test for question 2's "near-equivalent" claim, and no amount of further document reading
  settles it — only a phone with the Grab app installed can. Test on both Android and iOS, and
  re-test periodically since undocumented behaviour can change without notice.
- **Device test: does a hand-built `grab://open?dropOffAddress=<free text>&screenType=BOOKING` with
  no latitude/longitude resolve to a real destination, error, or silently ignore the address?** This
  is the load-bearing test for question 3 and directly decides whether a maps/geocoding provider is
  a hard requirement.
- **Confirm whether Grab's Help Centre article on Saved Places
  (`https://help.grab.com/passenger/en-ph/360020645352-How-to-save-a-favorite-place-or-location-in-the-app`)
  and its destination-screen counterpart say anything more specific than the marketing pages quoted
  above.** Both returned client-rendered error pages to this research's fetch tooling; a manual
  browser read may recover exact wording, including whether the destination-entry screen is described
  in enough detail to state definitively that saved places appear there for every booking entry
  point (versus just the main app-home shortcuts already confirmed).
- **Whether GrabMaps (referenced only via a third-party AWS Location Service page, not
  developer.grab.com itself) is offered to partners as a public geocoding API**, which would answer
  question 3's "do we need a maps provider" with "yes, and Grab itself might sell one" rather than
  requiring an unrelated third-party geocoder. Minimal test: search developer.grab.com directly for
  "GrabMaps" and, if nothing surfaces, contact Grab's partnerships channel to ask whether GrabMaps
  is externally available at all.
