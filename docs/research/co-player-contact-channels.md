# Co-Player Contact Channels — Cost & Mechanism Research (AND-61)

## Framing and cost-model assumptions

The app lets two signed-in Players end up on the same Booking (one is the Booker, the other the Taker — see `docs/adr/0004-record-takers-on-a-booking.md`). Both parties may need to coordinate (confirm arrival, agree on a substitute time) without either learning the other's phone number, since phone number is the verified Player identity (`docs/adr/0001-phone-number-as-player-identity.md`) and is therefore a bigger disclosure than a name. This document surveys the mechanisms that could carry that contact and prices each one. It does not recommend a choice — that decision belongs to the PO on AND-60.

**Scale assumption (stated by the ticket, used throughout):**
- 1 venue, 4 courts, 12 opening hours/day, 30 days/month → 4 × 12 × 30 = **1,440 Slots/month**.
- 60% of Slots booked → **864 booked Slots/month**.
- *Modeling caveat:* this treats one booked Slot as approximating one Booking. In the real domain model a Booking can span 1–2 consecutive Slots, so the true Booking count could be somewhat lower than 864. The estimate below does not correct for this — it is a simplification, flagged here rather than hidden.
- 30% of Bookings have a Taker → 864 × 0.30 = 259.2 ≈ **259 Bookings-with-Takers/month**.
- Assume one 3-minute call per such Booking → 259.2 × 3 ≈ **778 call-minutes/month (~13 hours/month)**.
- **Billing-unit clarification (not in the original prompt, added because it changes every hosted-provider number by 2×):** Daily, LiveKit, Twilio Video, Agora, and Vonage all bill **per participant-minute** — a 2-person, 3-minute call is billed as 6 participant-minutes, not 3. So the billable total for those providers is 778 × 2 ≈ **1,556 participant-minutes/month**. Stringee's VoIP pricing is a per-session/software-fee rate (not explicitly doubled per participant) — see its subsection. Masked real-phone calling (candidate 3) is priced as two outbound telephony legs per call — see that subsection.
- **VND conversion rate used:** ~26,000 VND/USD, the USD/VND spot rate reported for early September 2026. Source: [Trading Economics — USD/VND](https://tradingeconomics.com/usdvnd:cur) (accessed 2026-09-03); cross-checked against [Wise — USD to VND historical rate](https://wise.com/us/currency-converter/usd-to-vnd-rate/history). This is an approximate, not to-the-day, figure.

---

## Comparison table

| Candidate | How it works (1-line) | Monthly cost at this scale (USD) | Monthly cost at this scale (VND) | Fixed monthly floor, if any | Vietnam-specific notes | Key caveat |
|---|---|---|---|---|---|---|
| 1a. Daily (audio-only) | Hosted WebRTC SFU; browser joins a Daily "room" over a server-minted token | $0 (1,556 participant-min < 10,000 free/mo) | 0 ₫ | None — pure PAYG | No VN region called out; global edge | List rate is $0.00099/participant-min once free tier is exceeded |
| 1b. Daily (video) | Same, video enabled | $0 (1,556 < 10,000 free/mo) | 0 ₫ | None | Same | List rate $0.004/participant-min beyond free tier |
| 1c. LiveKit Cloud | Hosted SFU (open-source core); JWT token minted server-side | $0 (1,556 < 5,000 free min/mo on Build plan) | 0 ₫ | $0 on Build; $50/mo if the Ship plan's SLA/support is wanted | No VN region confirmed | Per-minute rate does not clearly distinguish audio vs video in published docs |
| 1d. Twilio Video | Hosted Group Rooms; Access Token (JWT) minted server-side | ≈ $6.22 (1,556 × $0.004) | ≈ 161,700 ₫ | None (PAYG); only a one-time trial credit, no recurring free tier | Twilio has no Vietnam local numbers (irrelevant to Video itself, relevant if SIP/PSTN is ever added) | No permanent free monthly tier |
| 1e. Agora (voice) | Hosted RTC voice channel; token signed server-side with App Certificate | $0 (1,556 < 10,000 free Standard min/mo) | 0 ₫ | None | Agora has PoPs in Asia incl. reported Vietnam reach (not independently confirmed on the pricing page) | List rate $0.00099/min beyond free tier |
| 1f. Stringee (VOIP app-to-app) | Vietnamese hosted Call API; internet-to-internet call between two app instances | $0 (778 min < 1,500 free min/mo) | 0 ₫ | Unclear — free tier's relationship to a paid "Standard/Growth" plan subscription is not fully disclosed on the public page | Vietnamese vendor; VND-native pricing; docs in Vietnamese | Once past free tier, ~104–150 ₫/min; exact figure depends on plan tier |
| 1g. Vonage Video API | Hosted Vonage/TokBox session; token generated server-side, no API call needed | ≈ $6.38 (1,556 × $0.0041) | ≈ 165,880 ₫ | None (PAYG); 100,000-minute trial is one-time, not recurring | No VN-specific notes found | Pricing page itself returned HTTP 403 to automated fetch; figures sourced via search snapshot of the same official page |
| 2. Self-hosted signalling (Vercel Fluid Compute WS) + public STUN + rented TURN | App builds its own WebSocket relay for SDP/ICE exchange; STUN is free; TURN is only used when direct P2P fails | ≈ $0–1 (TURN data volume at this scale is ~0.2–2 GB/mo, inside every free/cheap TURN tier) | ≈ 0–26,000 ₫ | $0 on Cloudflare/Metered pay-as-you-go; $39/mo if Xirsys's plan tier is chosen instead | Cloudflare/Twilio/Metered have no VN-specific TURN region called out; Twilio's nearest priced region is Singapore | Dollar cost is negligible at this scale; the real cost is engineering time to build and operate the signalling layer (see subsection) |
| 3a. Twilio Proxy (masked real-call) | Twilio dials both real numbers and bridges them via a masking number | ≈ $138–$277/mo + $1.15/mo number rental (see calc) | ≈ 3.6M–7.2M ₫/mo | $1.15/mo (international number rental) | **Twilio sells no Vietnam local numbers at all** — a serious practical blocker, not just a cost one | Proxy's own page publishes no per-session price; cost is derived entirely from Twilio's general Vietnam Voice per-minute rates |
| 3b. Stringee masked/virtual number | Officially documented Vietnamese product (số mặt nạ) for exactly this use case | Cannot compute — callout-to-real-number rate is not publicly published | — | Unknown | Vietnamese product, built for ride-hailing-style two-party number masking | Pricing requires contacting Stringee sales; no public primary-source number found |
| 3c. Viettel / VNPT telco APIs | Enterprise virtual-PBX / "Voice Brandname" hotline products | Cannot compute — no public per-minute masking rate found | — | ≈ 299,000 ₫/mo cited for a hotline number (not a masking-between-two-consumers product) | Vietnamese telcos | These are contact-center/hotline products aimed at a business-to-customer hotline, not peer-to-peer masking between two consumer mobiles; no matching public product was found |
| 4. Opt-in number sharing | A Player taps "share my number" on a Booking; app does nothing else | $0 | 0 ₫ | None | N/A | Irreversible: once shared, the number cannot be un-shared, and phone is the verified identity (ADR-0001), so this discloses more than a name would |
| 5. Zalo deep link | Deep-link into Zalo hoping to start a chat/call without exposing the number | $0 (no infra) but **mechanism does not exist** | 0 ₫ | N/A | Zalo is Vietnam's dominant chat app | No official Zalo developer documentation describes a masked/anonymous contact link; `zalo.me/<phone>` requires already knowing the number, which defeats the purpose |

---

## 1. Hosted WebRTC providers

All six providers share the same basic shape: the browser calls `getUserMedia`, opens an `RTCPeerConnection`, and the provider's SDK/SFU handles signalling and media relay. The app's job is reduced to (a) an endpoint that mints a short-lived access token/JWT per participant, and (b) creating a "room"/"session" per Booking (either via a server REST call ahead of time, or lazily on first join). None of these calls the callee's phone — the callee must have the Booking's page open in a browser tab at the time of the call; there is no ringtone/notification unless a push mechanism is built separately (e.g. Web Push, which is a distinct, unresearched piece of work).

### 1a/1b. Daily
- Pricing: **$0.004/participant-min (video)**, **$0.00099/participant-min (audio-only, list price)**, volume discounts down to $0.0015/min at 50M+ min/mo. Free tier: **10,000 participant-minutes/month** on all accounts, no credit card required.
  Source: [Daily — WebRTC Infrastructure Pricing](https://www.daily.co/pricing/webrtc-infrastructure/)
- Server-side pieces: a `/meeting-tokens` POST call to mint a per-user JWT, and a `/rooms` POST call to create the room (can also be created lazily). Source: [Daily — Meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens), [Daily — Create and manage rooms with the REST API](https://docs.daily.co/guides/create-and-manage-rooms-with-the-rest-api)
- Browser support: standard WebRTC (see the cross-provider browser-support note below); Daily's docs don't call out anything Daily-specific beyond that.

### 1c. LiveKit Cloud
- Pricing: Build plan includes 5,000 min/mo free, then **$0.0005/participant-min**; Ship plan includes 150,000 min/mo for a $50/mo base; Scale plan drops to $0.0004/min at 1.5M+ included minutes.
  Source: [LiveKit — Pricing](https://livekit.com/pricing)
- Could not verify from official docs whether audio-only connections are billed at a lower per-minute rate than video (the pricing model is described as "per connected participant minute" without a stated media-type discount) — flagging this as unconfirmed rather than assuming a lower audio rate.
  Source checked: [LiveKit Knowledge Base — Understanding LiveKit Cloud Pricing](https://kb.livekit.io/articles/3947254704-understanding-livekit-cloud-pricing)
- Server-side pieces: JWT access tokens signed server-side with the API secret via LiveKit's server SDK (Node/Go/Python/Kotlin); room creation via the Room Service API. Source: [LiveKit — Access tokens & grants](https://docs.livekit.io/home/server/generating-tokens/)

### 1d. Twilio Video
- Pricing: **$0.004/participant-min** for Group Rooms; no permanent monthly free tier (only a one-time trial credit).
  Source: [Twilio — Video Pricing](https://www.twilio.com/en-us/video/pricing)
- Server-side pieces: Access Tokens (JWTs) generated server-side with a Twilio server SDK; Rooms created via REST API or lazily on client join.
  Source: [Twilio — User Identity & Access Tokens for Programmable Video](https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens)
- Vietnam note: irrelevant to WebRTC Video itself (no PSTN involved), but see 3a for what happens if this vendor relationship is later extended to real phone bridging — Twilio has no Vietnam local numbers.
  Source: [Twilio — Vietnam Voice Guidelines](https://www.twilio.com/en-us/guidelines/vn/voice) ("Twilio does not offer Vietnam Local Numbers.")

### 1e. Agora
- Pricing: **$0.99 per 1,000 minutes** (audio) pay-as-you-go; free tier of **10,000 Standard minutes/month**, shared across a project's Video Calling / Voice Calling / Live Streaming usage.
  Source: [Agora — Voice Calling Pricing](https://docs.agora.io/en/voice-calling/overview/pricing), [Agora — Video Calling Pricing](https://docs.agora.io/en/video-calling/overview/pricing)
- Server-side pieces: a token server that signs temporary tokens using the project's App Certificate (Agora publishes an open-source reference implementation, "AgoraDynamicKey").
  Source: [Agora — Deploy a token server](https://docs.agora.io/en/realtime-media/rtc/build/authenticate-users/deploy-token-server)
- Vietnam reach: Agora markets broad Asia-Pacific edge coverage; no Vietnam-specific PoP was confirmed on the primary pricing/docs pages fetched, so this is not stated as verified.

### 1f. Stringee (Vietnam)
- Pricing (VoIP, internet-to-internet, i.e. app-to-app, not to a real phone number): **1,500 free minutes/month**, then 104–150 ₫/minute depending on plan tier (Standard/Growth/overage).
  Source: [Stringee — Phí dịch vụ Call API](https://stringee.com/vi/pricing-call)
- This page explicitly states the listed fee is Stringee's own software fee and **excludes** the telco cost of calling out to a real phone number ("callout") — that rate is not published and requires contacting sales.
- Server-side pieces: Stringee issues an access token server-side (Vietnamese-language SDK docs); the app calls its Call API to place calls.
- This is the only candidate-1 provider headquartered and priced natively in Vietnam.

### 1g. Vonage Video API
- Pricing: **$0.0041/participant-min**, flat regardless of resolution; a one-time 100,000-minute trial for new accounts (not a recurring monthly free tier).
  Source: [Vonage — Video API Pricing](https://www.vonage.com/communications-apis/video/pricing/) (page returned HTTP 403 to this session's automated fetch tool; figures above are drawn from a search-engine snapshot of the same official URL, so treat as slightly less directly verified than the other providers here)
- Server-side pieces: app server creates a Session (server SDK or REST) and issues a Token per participant; no network call is needed to mint the token itself (it's a signed hash).
  Source: [Vonage — Video API Basics](https://tokbox.com/developer/guides/basics/)

### Browser support (applies to every candidate-1 and candidate-2 option)
- `RTCPeerConnection` is supported on iOS Safari from version 11 onward, and on current Chrome for Android.
  Source: [caniuse.com — RTCPeerConnection](https://caniuse.com/rtcpeerconnection)
- iOS-specific gotcha: on iOS, `getUserMedia`/WebRTC only works inside **actual Safari** — other iOS browsers (Chrome, Firefox, etc. on iOS) are all WebKit under the hood and Apple restricts camera/mic access in the WKWebView they use, so WebRTC does not work in them even though they render the page. This also means WebRTC breaks if the Booking link is opened inside an **in-app browser** (e.g. a link tapped inside Zalo, Facebook, or Messenger's built-in webview) rather than in Safari or Chrome proper — a real risk for a mobile-web app whose links get shared in chat apps.
  Source: [webrtcHacks — Guide to WebRTC with Safari in the Wild](https://webrtchacks.com/guide-to-safari-webrtc/), corroborated by [MDN/community discussion referenced via WebRTC-developers.com](https://www.webrtc-developers.com/webrtc-on-chrome-firefox-edge-and-others-on-ios/)
- iOS Safari is also limited to the H.264 video codec (vs. Chrome/Firefox's broader VP8/VP9/AV1 support), which matters only if video (not audio-only) is used.
  Source: same webrtcHacks guide above.

---

## 2. Self-hosted WebRTC signalling (Vercel Functions + STUN + rented TURN)

**What has to be built** (none of this is provided by a vendor in this candidate):
- A WebSocket relay for exchanging SDP offers/answers and ICE candidates between the two Players' browsers, running as a Vercel Function using Fluid Compute's WebSocket support.
- Per-call/per-Booking room state: who has joined, whether the other side is present, and cleanup when a call ends or a participant never shows.
- Reconnection/ICE-restart handling when a mobile network changes (very common on phones switching between Wi-Fi and cellular mid-call).
- Minting and rotating short-lived TURN credentials (HMAC-based, time-limited) for whichever TURN vendor is chosen.
- All of the client-side call UI/UX (ringing state, mute, hang-up) that a hosted SDK would otherwise supply.

This is materially more engineering effort than candidate 1, where the vendor's SDK supplies signalling, reconnection, and (for the SFU providers) media routing already built.

**STUN (free):**
- Google's public STUN servers (`stun.l.google.com:19302` etc.) are widely used and free, though Google does not publish a formal SLA for them as a product.
- Cloudflare operates a free, unlimited public STUN endpoint at `stun.cloudflare.com`.
  Source: [Cloudflare Realtime — TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)

**TURN (only used when direct peer-to-peer fails, e.g. behind symmetric NAT/restrictive firewalls):**
- Cloudflare Realtime TURN: **$0.05/GB**, with the **first 1,000 GB/month free**.
  Source: [Cloudflare Realtime — TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/), [Cloudflare Realtime — SFU/TURN pricing](https://developers.cloudflare.com/realtime/sfu/pricing)
- Twilio Network Traversal Service (STUN/TURN): STUN is free and unlimited; TURN is **$0.40/GB** (US, Germany), **$0.60/GB** (Singapore, India, Japan), **$0.80/GB** (Australia, Brazil) — Singapore is the closest priced region to Vietnam.
  Source: [Twilio — Network Traversal Service Pricing](https://www.twilio.com/en-us/stun-turn/pricing)
- Metered.ca: pay-as-you-go TURN with volume discounts from roughly $0.40/GB down to $0.10/GB, **50 GB/month free**, or a Growth plan at $99/month including 150 GB.
  Source: [Metered — Pricing](https://www.metered.ca/pricing)
- Xirsys: plan-based rather than pure PAYG, starting at **$39/month**.
  Source: [Xirsys — Pricing](https://xirsys.com/pricing)

**Cost at this scale:** Voice-only WebRTC media is low-bitrate (tens of kbps), and TURN relay is only invoked for the subset of calls where direct P2P negotiation fails — commonly a minority of calls in practice. At 778 call-minutes/month total, even a pessimistic assumption of 100% of calls needing full TURN relay puts total relayed data in the low single-digit gigabytes per month — comfortably inside Cloudflare's or Metered's free tier, i.e. **effectively $0/month** on either of those two vendors. (This is an order-of-magnitude estimate from generic voice-call bitrates, not a vendor-published minutes-to-GB conversion — no primary source ties WebRTC audio bitrate to a specific GB figure, so treat the GB estimate itself as a rough calculation, not a citation.) The real cost driver for this candidate is engineering time, not vendor fees.

---

## 3. Masked / number-proxy calling (real phone call, neither side sees the other's number)

### 3a. Twilio Proxy
- Twilio Proxy is described on its own docs page as enabling "masked communications between two parties" by provisioning a temporary number and forwarding calls/messages between them.
  Source: [Twilio — Proxy: One-to-one Masked Communications](https://www.twilio.com/docs/proxy)
- The Proxy product page publishes **no dedicated per-session price** — cost is entirely a function of the underlying Voice/SMS/number pricing for whatever number Proxy uses to mask the call.
- **Blocker:** Twilio does not sell Vietnamese local phone numbers at all.
  Source: [Twilio — Vietnam Voice Guidelines](https://www.twilio.com/en-us/guidelines/vn/voice)
- Vietnam outbound voice rates (used for the calculation below): **$0.1777/min to VN mobile**, **$0.1947/min to VN local/landline**; inbound to a Twilio local number $0.3482/min (not usable here since there is no VN local number); international number rental from **$1.15/month**.
  Source: [Twilio — Programmable Voice Pricing in Vietnam](https://www.twilio.com/en-us/voice/pricing/vn)
- **Cost calculation** (assuming Twilio dials both real VN mobile numbers as two outbound legs and bridges them, which is how masked-call bridging works): 259.2 bookings-with-Takers × 3 min × 2 legs × $0.1777/min ≈ **$138.2/month**, plus the $1.15/month number rental ≈ **$139.4/month total** (≈ 3.6M ₫/month). If Vietnamese carriers instead classify one leg as inbound-to-a-foreign-number for the Vietnamese caller (since there is no VN Twilio number to dial), that caller could additionally be billed an international rate by their own Vietnamese carrier — a real-world cost this analysis cannot quantify from Twilio's pricing pages alone, and a strong practical argument against this option regardless of Twilio's own price.

### 3b. Stringee call masking (Vietnam)
- Stringee has an official, named product for exactly this pattern — "số mặt nạ" (masked phone number) — described as generating a temporary virtual number between two real callers so that "both users remain unaware of each other's actual phone numbers," marketed at ride-hailing/delivery-style intermediary platforms.
  Source: [Stringee — Tạo số mặt nạ cho cuộc gọi (masked phone number)](https://stringee.com/vi/use-cases/so-mat-na-masked-phone-number)
- **Could not verify a per-minute price for this specifically.** The public pricing page only publishes the VoIP (app-to-app internet call) rate discussed in section 1f; the "callout" fee for bridging two real phone numbers through the masking product is explicitly stated as not included in that page and requires contacting Stringee sales. No other primary source with a published number was found.
- Vietnamese numbers are clearly supported (this is a Vietnamese vendor whose flagship use case is Vietnamese ride-hailing), and the callee does see a masked/virtual number, not the real caller's number, per the product description above.

### 3c. Vietnamese telco APIs (Viettel, VNPT, generic aggregators like eSMS.vn)
- Search turned up "tổng đài ảo" (virtual PBX) and "Voice Brandname" hotline products from VNPT and Viettel, aimed at businesses running a customer-service hotline (calls show a business name/brand), with one source citing a hotline-number cost around **299,000 ₫/month**.
  Source (secondary, cited because no better primary source was found): general product marketing pages surfaced via search; **no official Viettel or VNPT pricing page for a peer-to-peer number-masking API between two consumer mobiles was found**, so this figure describes a different product (a business hotline), not the two-Players-on-a-Booking scenario this ticket asks about.
- **This candidate could not be priced for the actual use case asked about.** Flagging explicitly rather than presenting the hotline figure as if it answered the question.

---

## 4. Opt-in number sharing

- Mechanism: a Player taps a "share my number with the other Player on this Booking" action; the app displays the real number to the other party. No calling/messaging infrastructure is added.
- Cost: **$0** — no vendor, no per-minute fee, no infrastructure.
- Privacy trade-off (explicitly called out per the ticket): once a number is shown, there is no way to un-share it — the other Player has already seen and can store it outside the app. This connects directly to `docs/adr/0001-phone-number-as-player-identity.md`: phone number is the verified Player identity in this system, not an incidental contact detail, so sharing it is a materially bigger disclosure than sharing a display name would be. A Player who shares their number on one Booking to reach a Taker has, in effect, handed that person their durable identity, not just a way to reach them for one match.

---

## 5. Deep link to Zalo

**Finding: no official mechanism was found that lets one person start a chat or call with another Zalo user without the initiator already knowing that person's phone number or Zalo ID — this confirms the stated prior rather than refuting it.**

What was found:
- Zalo's public deep-link convention is `https://zalo.me/<phone-number-or-id>`, which opens a chat — but the caller must already possess the phone number (or Zalo user ID) to construct the link. This does not mask anything; it requires the very piece of information this ticket is trying to avoid exposing.
  Source: general references to the `zalo.me/` link format via Zalo's own community/developer forum threads, e.g. [Zalo Developers Community — "Deeplink tới zalo chat kèm tin nhắn"](https://developers.zalo.me/community/detail/5abdf352cf1726497f06)
- Zalo's consumer-facing QR-code "add friend" feature lets someone connect with another user by scanning that user's own QR code instead of typing their phone number. This is a **self-share** mechanism (person B generates and hands over their own QR code/link) — it is not something a third-party app can broker on person B's behalf to hide their number from person A, and it is a friend-add flow, not a one-off masked call. Source: consumer help articles, e.g. [FPT Shop — Cách kết bạn Zalo không cần dùng số điện thoại](https://fptshop.com.vn/tin-tuc/thu-thuat/cach-ket-ban-zalo-khong-can-dung-so-dien-thoai-142658) (secondary source; cited because Zalo's own developer portal at `developers.zalo.me` renders as a client-side single-page app that this session's fetch tool could not retrieve as static content — see caveat below).
- Zalo's Official Account (OA) platform lets a **business** account message end users, but that is a business-to-consumer channel (brand ↔ follower), not a primitive for masking two individual consumer Players from each other.
  Source: [Zalo Official Account API references via developers.zalo.me](https://developers.zalo.me/docs) (page content could not be retrieved as static text by this session's fetch tool; conclusion is based on the general shape of Zalo OA documented functionality found via secondary references, not a directly quoted primary passage)

**Explicit caveat on source quality for this candidate:** `developers.zalo.me` is a JavaScript single-page application; this session's `WebFetch` tool retrieved only page titles, not rendered documentation content, on multiple attempts. The conclusion above is therefore built from Zalo's public `zalo.me/` deep-link convention (observable and stable), Zalo's own community forum thread titles, and third-party consumer help documentation of Zalo's QR/friend features — not a single authoritative Zalo technical spec page confirmed by direct fetch. If a definitive answer is required before a decision is made on AND-60, someone with a Zalo Developer account should check `developers.zalo.me/docs` directly in a browser, since this research could not render that page's actual content.

---

## Summary of what could NOT be verified against a primary source

- **Stringee callout-to-real-number rate** (candidates 1f's PSTN leg and 3b's masking product): the public pricing page explicitly withholds this figure and directs to sales. No number found anywhere.
- **Viettel/VNPT peer-to-peer call-masking pricing** for two arbitrary consumer mobile numbers: no matching product/pricing page found at all; only adjacent business-hotline products were found.
- **LiveKit Cloud's audio-vs-video per-minute differential**: official docs describe a flat per-connected-participant-minute model without confirming whether audio-only sessions are cheaper than video ones.
- **Vonage Video API pricing page**: returned HTTP 403 to this session's automated fetch tool; the cited figures come from a search-engine snapshot of the same official `vonage.com` URL rather than a direct fetch.
- **Agora's Vietnam-specific network reach**: no Vietnam PoP was confirmed on the official pricing/docs pages fetched; general Asia-Pacific coverage claims are marketing language, not a documented list of countries/regions.
- **Zalo's developer documentation content**: the SPA nature of `developers.zalo.me` meant this could only be researched via community-forum titles and third-party consumer help articles, not a directly fetched official spec page (see the explicit caveat in section 5).
- **Twilio Proxy's own per-session pricing**: the product's own docs page states what it does but publishes no price; the dollar figure in section 3a is derived entirely from Twilio's general Vietnam Voice per-minute rates, an inference rather than a quoted Proxy price.
