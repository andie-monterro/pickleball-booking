# Web App Ringing — Can a Web Push Make a Phone Ring?

This note feeds Linear ticket AND-62. The question behind it: if one Player starts a call inside the pickleball-booking web app, can the other Player's phone ring when that Player does not have the app open? The app today is a plain Next.js web app with no PWA manifest, no service worker, and no push. This is a fact sheet only — it does not recommend a choice between push, foreground-only calling, or an SMS nudge, and it does not recommend a vendor. It exists so the PO can make that call with facts in hand.

For context, the repo already sends SMS through Prelude's Verify API v2 (`src/lib/auth/otp-provider.ts`, `POST https://api.prelude.dev/v2/verification` and `/check`), but only for one-time-passcode delivery — never for general transactional text.

## Note on method

Every claim below is followed by an inline `(Source: URL)` pointing at the primary source it came from — a browser vendor's own docs or blog, a W3C spec, or a provider's own pricing/API page. Where a tool could only fetch a summarized version of a page rather than the full text, that is treated as a soft signal, and a second source was sought to confirm it. Secondary write-ups (blog aggregators, SEO comparison sites) were used only to find where to look, never as the cited fact — where no primary source could confirm a claim, that is stated as a gap rather than filled in with a guess. Prices change often; each price below carries the page it was read from and the fact that it was fetched during this research pass (September 2026), since SMS and push pricing move without notice.

## 1. Web Push support today, platform by platform

### 1.1 iOS Safari

Apple added Web Push for web apps on iOS and iPadOS in **iOS/iPadOS 16.4** (March 2023). (Source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

It only works for a web app that has been **added to the Home Screen** first — an open Safari tab does not qualify. The site also needs a web app manifest with `display` set to `standalone` or `fullscreen` for the install to count as a "web app" in Apple's sense. (Source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

The permission prompt to receive push must be triggered by direct user interaction (e.g., tapping a "subscribe" button) — it cannot be requested automatically on load. (Source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

Once granted, Apple says these notifications "work exactly like notifications from other apps" — they show on the Lock Screen, in Notification Center, and on a paired Apple Watch, and Focus modes apply to them the same as native app notifications. (Source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

**Steps for the user on iOS, in order:**
1. Open the site in Safari.
2. Tap Share → Add to Home Screen.
3. Open the app from the Home Screen icon (not the browser).
4. Tap something in-app that triggers the permission request.
5. Tap Allow on the system permission prompt.

That is five user actions before the Player can receive anything, and two of them (steps 2–3) are PWA-install steps most users have never had reason to do for a court-booking site.

### 1.2 Android Chrome

The Push API on Chrome for Android has been supported since Chrome 42 (2015), and unlike iOS it works **directly in the browser tab** — a website is not required to be installed to the home screen to request permission and receive push. (Source: https://developer.chrome.com/blog/push-notifications-on-the-open-web)

**Steps for the user on Android Chrome:**
1. Open the site (as a normal tab, no install needed).
2. Tap something that triggers the permission request.
3. Tap Allow on the browser's permission dialog.

That is one real step beyond just using the site — no install screen involved. (Home Screen install is optional on Android and only changes how the icon looks/launches — it is not a push prerequisite there, unlike iOS.)

### 1.3 Desktop browsers (Chrome, Edge, Firefox, Safari)

The Push API standard is listed by MDN as **Baseline: widely available since March 2023**, meaning it works consistently "across many devices and browser versions" including desktop. (Source: https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

**Chrome/Edge/Firefox desktop:** push works for a normal website in a normal tab. The flow web.dev documents is: feature-detect service worker + PushManager support → register a service worker → call `Notification.requestPermission()`, which shows the browser's permission prompt (Allow/Block) → call `pushManager.subscribe()`. No PWA installation step appears anywhere in that flow. (Source: https://web.dev/articles/push-notifications-subscribing-a-user) A service worker can also be woken to handle a push even after the browser window that opened it is closed, as long as the browser process itself is still running. (Source: https://web.dev/articles/push-notifications-faq)

**Safari desktop (macOS):** Web Push shipped in **Safari 16 on macOS Ventura** (2022). Contrary to iOS, it works for a **regular website** — "if you've already implemented Web Push for your web app or website using industry best practices, it will automatically work in Safari," with no Apple Developer Program membership needed. (Source: https://webkit.org/blog/12945/meet-web-push/) The permission request must still follow from a user gesture (a click or keystroke), the same one-click model as other desktop browsers. (Source: https://webkit.org/blog/12945/meet-web-push/) Apple separately shipped an "Add to Dock" way to install a site as a standalone app, but that requires macOS Sonoma 14+ and is not a push prerequisite on Ventura or later — it is a different, optional feature. (Source: search summary of Apple/WebKit "Add to Dock" coverage; a primary Apple source confirming the Sonoma version number specifically was not directly fetched — see Gaps.)

**Steps for the user on any desktop browser:** open the site → click something that triggers the request → click Allow. Two clicks, no install, on Chrome, Edge, Firefox, and desktop Safari alike.

### Summary table

| Platform | Home Screen / PWA install required? | Steps to first push | OS version needed |
|---|---|---|---|
| iOS Safari | Yes | ~5 (install, relaunch from icon, trigger, allow) | iOS/iPadOS 16.4+ |
| Android Chrome | No | ~2 (trigger, allow) | Chrome 42+ (long available) |
| Desktop Chrome/Edge/Firefox | No | ~2 (trigger, allow) | Long available; Baseline since March 2023 |
| Desktop Safari (macOS) | No | ~2 (trigger, allow) | Safari 16 / macOS Ventura+ |

iOS is the outlier: it is the only platform in this comparison that requires a Home Screen install before push is possible at all.

## 2. Ringing: what a web push can and cannot do

### What the web platform gives you

A Notification created through the Notifications API can carry a title, body, icon, and (per the constructor options) things like a tag, a `silent` flag, and — on platforms that support it — a vibration pattern. On mobile browsers, a page cannot show a plain `new Notification()` from an unfocused page; it must go through `ServiceWorkerRegistration.showNotification()`, since the plain constructor throws on most mobile browsers. (Source: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) This produces a standard system notification — banner, lock-screen entry, sound if not silenced — not a distinct "incoming call" screen.

The Web Push Protocol lets a server mark a push message's `Urgency` as very-low/low/normal/high and set a `TTL` (time-to-live), but the spec is explicit that Urgency is a hint the push service can use to decide whether to wake a low-battery device for it — it is not a guarantee of immediate delivery, and it does not wake the OS into a full-screen ringing UI. (Source: https://web.dev/articles/push-notifications-web-push-protocol) The W3C Push API spec itself does not define any priority or urgency concept, does not mention "silent push," and only says a push service "ensures reliable and efficient delivery" without committing to a delivery-time guarantee. (Source: https://www.w3.org/TR/push-api/)

**Notification Triggers API** — a proposed API that would have let a service worker schedule a local, time/condition-based notification without a network round trip — was discontinued by its own authors. Chrome's own page on it says plainly: "The development of Notification Triggers API, part of Google's capabilities project, has ended. It wasn't clear that we could provide consistent and reliable experiences across platforms." (Source: https://developer.chrome.com/docs/web-platform/notification-triggers) There is no current, shipped web-standard mechanism designed to reproduce a phone-call-style wake.

### What native apps get instead

**iOS:** Apple's CallKit gives a VoIP app a full-screen, system-native incoming-call UI — the same one the Phone app uses — even when the app is not running in the foreground, triggered by a **PushKit** VoIP push. PushKit VoIP pushes wake the app in the background specifically so it can call `CXProvider.reportNewIncomingCall()` and hand off to that native UI. (Source: https://developer.apple.com/documentation/pushkit and https://developer.apple.com/documentation/callkit) This path is high-priority and reliable in a way ordinary push is not — but Apple restricts it: VoIP push is meant for actual call delivery, and using it for other purposes risks App Store rejection or removal. (Source: https://developer.apple.com/documentation/pushkit) There is no web equivalent of PushKit/CallKit — a web page cannot register for VoIP push or draw the system incoming-call screen.

**Android:** the Telecom framework's `ConnectionService` lets a calling app plug into the system's call handling (or run entirely self-managed via the Core-Telecom Jetpack library) and, together with a **full-screen intent** notification, show a full-screen incoming-call UI even from the lock screen. (Source: https://developer.android.com/develop/connectivity/telecom and https://developer.android.com/develop/ui/views/notifications/time-sensitive) Crucially, since **Android 14 (API 34)**, the `USE_FULL_SCREEN_INTENT` permission that makes this possible is, by default, granted only to apps that provide calling or alarm functionality — the Play Store actively revokes it from apps that target Android 14+ and don't fit that profile, as of a policy deadline of May 31, 2024. Other apps can still request the permission, but the user must explicitly grant it via a settings screen; it is no longer auto-granted at install. (Source: https://developer.android.com/about/versions/14/behavior-changes-14) A web push cannot request or hold `USE_FULL_SCREEN_INTENT` at all — that's an Android app manifest permission, not something reachable from a browser tab or PWA.

**Bottom line:** a web push, at best, is a standard system notification (banner/lock-screen entry, a sound if not silenced, maybe vibration). It cannot draw the full-screen "incoming call" UI that CallKit (iOS) or a full-screen-intent-holding calling app (Android) can, and there is no shipped or in-development web API that closes that gap.

## 3. Server-side requirements and cost for web push

### What the app would need to add

- **VAPID keys**: a one-time-generated public/private key pair ("application server keys"). The server signs each push request with the private key; the push service checks that signature against the public key the browser registered during subscription. (Source: https://web.dev/articles/push-notifications-web-push-protocol, and the key-generation flow at https://web.dev/articles/push-notifications-overview — `npx web-push generate-vapid-keys`)
- **Push subscription storage**: each browser/device that grants permission returns a `PushSubscription` object (an endpoint URL plus the encryption keys needed to address that browser's push service) that the server must store per player, per device, and update if a subscription is invalidated. (Source: https://web.dev/articles/push-notifications-overview)
- **A send endpoint using the Web Push Protocol**: the server POSTs an encrypted payload to whichever push service the subscription's endpoint belongs to — this part of the protocol is standardized, so the server does not need to special-case Chrome vs. Firefox vs. Safari; "each browser uses whatever push service it wants," but the wire format is common. (Source: https://web.dev/articles/push-notifications-overview) A web app manifest and a registered service worker are prerequisites the app doesn't have today (per the ticket's framing) and would both need to be added.

### Cost

Sending web push through the browser vendors' own push services (Apple's web push service used for Safari, Google's FCM used for Chrome, Mozilla's autopush used for Firefox) is not billed per message at the protocol level — a server that speaks the Web Push Protocol directly and self-hosts (e.g., with the open-source `web-push` npm library) pays no vendor fee for delivery itself, only its own hosting/compute. Concretely for FCM: Firebase's own pricing page lists Cloud Messaging as a no-cost product on both the free "Spark" plan and the pay-as-you-go "Blaze" plan, with no per-message charge documented. (Source: https://firebase.google.com/pricing)

Given that, why do people pay third-party push providers (OneSignal, Firebase's higher-level SDK, etc.) at all? Based on what the fetched docs describe (not a recommendation, just what the providers themselves are for): those services aren't charging for the underlying delivery — they're charging for the layer on top of it: managing subscriptions across many sites/apps, a dashboard, audience segmentation, delivery analytics, retry/dead-subscription handling, and a single SDK that abstracts the per-browser differences instead of the app hand-rolling VAPID + Web Push Protocol logic itself. None of that changes the fact that the underlying APNs-for-web/FCM/autopush delivery paths themselves are free to use directly.

## 4. Fallback options if push isn't viable or reliable enough

### (a) Foreground-only signaling

If the call only connects when both Players already have the page open, no push infrastructure, manifest, or service worker is needed at all — signaling can happen over a live connection (e.g., WebSocket/WebRTC signaling) while both tabs are open. This sidesteps every platform requirement and cost discussed above, at the cost of the call simply not being possible to start unless the other Player happens to already be in the app.

### (b) SMS nudge ("please open the app, your co-player is calling")

**Can Prelude send this kind of message today?** Yes — separately from Verify. Prelude's docs describe a distinct **Transactional API** ("Notify"), explicitly positioned apart from Verify: "If you want to send OTP codes, use the Verification API" — Notify is for other transactional (and marketing) messages, over SMS, RCS, or WhatsApp, with automatic fallback to SMS if the preferred channel is unavailable. (Source: https://docs.prelude.so/transactional/v2/documentation/introduction) The send call is `POST https://api.prelude.dev/v2/notify`, requiring `to` (E.164 phone number), a `template_id` (Prelude requires a pre-configured template — it does not appear to accept arbitrary free text — configured with your Customer Success team), and a `variables` object matching that template; sending variables the template doesn't define returns an `invalid_template_variables` error. (Source: https://docs.prelude.so/transactional/v2/api-reference/send-a-transactional-message) Note the endpoint host, `api.prelude.dev`, matches the same host the repo's OTP code already calls — confirmed live during this research (`api.prelude.dev` answered with an HTTP 405 on a GET, i.e., a real endpoint expecting POST, not a dead host), even though Prelude's current docs are published under `docs.prelude.so` rather than `.dev`.

**Cost per SMS to Vietnam (VND/USD), by source, all fetched during this research pass (September 2026) — treat as approximate and expect drift:**

| Provider | Price to VN | Currency/notes | Source |
|---|---|---|---|
| Twilio | $0.2852 per outbound SMS | USD, per message segment; "prices may change...additional carrier fees may apply"; separate $0.001 fee on failed messages | https://www.twilio.com/en-us/sms/pricing/vn |
| Bird (formerly MessageBird) | $0.26 per message | USD, "alphanumeric" sender rate to Vietnam; carrier fees apply on top; other sender types (long code, toll-free, short code) not published for VN | https://bird.com/pricing/sms |
| Prelude (Verify API, general pricing page — not VN-specific) | example SMS rate €0.0043 | EUR; Prelude states this is a pass-through of carrier cost with "no margin," but the published figure is a generic example, not confirmed as the Vietnam-specific rate | https://prelude.so/pricing |
| eSMS.vn (Vietnamese local provider, SMS Brandname/transactional) | ~520 VND/SMS (brandname), ~450 VND/SMS (fixed-number sender) | VND; "giá giao động" (price fluctuates); volume discounts for >5,000 messages/month on request | https://esms.vn/chinh-sach-gia |
| Vonage | not retrieved | — | attempted https://www.vonage.com/communications-apis/sms/pricing/vn/ — page returned HTTP 403 to the fetch tool; not confirmed from a primary source in this pass |

At current exchange rates (roughly 25,000–26,000 VND/USD as of this research), Twilio's and Bird's dollar rates for Vietnam (~$0.26–$0.29) work out to roughly **6,500–7,400 VND per SMS** — an order of magnitude above the ~450–520 VND eSMS.vn quotes for its Vietnam-local brandname service. This gap (international aggregator vs. Vietnam-local provider) is consistent across the two categories of source found; it was not possible from these primary pages alone to confirm why (e.g., differing carrier interconnect costs, regulatory/brandname registration differences), so that reason is not stated as fact.

Prelude's own Vietnam-specific SMS rate (for either Verify or Notify) was not found published on a primary Prelude page — `prelude.so/countries` mentions 230 destinations and country-specific rates but did not return a resolvable VN figure inside this tool's fetch; per that page, exact country rates require contacting Prelude directly (Source: https://prelude.so/countries).

## Gaps / open questions

- **Exact iOS/iPadOS notification sound/vibration control**: MDN's Notifications API page did not, in the content retrieved, spell out how much control a web notification has over custom sound or vibration on iOS specifically. WebKit's iOS post says notifications "work exactly like" native ones but doesn't itemize sound/vibration API support. Not confirmed from a primary source.
- **Safari "Add to Dock" macOS version number**: multiple secondary sources say this needs macOS Sonoma 14+, but no single primary Apple/WebKit page was directly fetched and quoted confirming that version number in this pass — flagging rather than asserting it as Apple's own claim.
- **Vonage's Vietnam SMS price**: the vendor's own pricing page returned an HTTP 403 to the fetch tool and was not retrieved through a primary source in this pass.
- **Prelude's actual Vietnam-specific per-SMS rate** (Verify or Notify): not found published; Prelude's pricing page shows an example European rate only and points to contacting them directly for country-level pricing.
- **Full MDN browser-compatibility matrix for the Push API and Notifications API** (exact per-browser version numbers beyond the "Baseline since March 2023" summary): the fetch tool returned the page's prose but not the interactive compatibility table itself, so this note relies on the Baseline summary plus vendor blog posts (WebKit, Chrome) for version specifics rather than MDN's own version-by-version table.
- **Whether desktop Chrome/Edge/Firefox impose any additional step (e.g., a settings-level global notification toggle) beyond the one permission prompt**: not found spelled out on a primary source; assumed absent based on the documented subscribe flow, but not independently confirmed as "no extra step, ever."
