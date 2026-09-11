# Venue Camera Footage Delivery — Technical Survey (AND-109)

This document is a **survey, not a vendor recommendation**. It exists to answer one technical
question for AND-109: if a pickleball venue installs *some* camera system, what would this
booking app actually be able to fetch, technically, for "Court 3, 18:00–19:00 today" -> highlight
clip? It does not recommend which system the venue should buy, and it does not weigh cost
against value for the venue. Two vendor families are covered:

- **Family 1** — sports/court-camera products (Pixellot, Veo, Hudl, Reeplayer, Staige, and
  Southeast-Asia-market offerings).
- **Family 2** — general CCTV/NVR technology (ONVIF, RTSP, Hikvision, Dahua, Reolink, UniFi
  Protect).

Every claim below is sourced. Where a vendor's marketing page claims "API available" but no
public developer documentation could be found to back it, this is flagged explicitly as
**MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND**, per the research brief. Where a primary source
could not be reached (paywalled, requires partner login, or genuinely undocumented), that is
also stated rather than guessed.

---

## Family 1: Sports/Court Camera Products

### Pixellot

Pixellot publishes real developer documentation ("Pixellot Marketplace") at
`docs.pixellot.tv`, aimed at "VAS" (Value Added Service) partners, plus a REST reference on
SwaggerHub.

- **Documented API/webhook:** Yes. There is a Partner API (JWT-authenticated, separate
  production/staging environments) for creating/updating/retrieving entities, plus four webhook
  subscription types: `EventTimestamp` (stream/recording lifecycle, e.g.
  `cloudRecordedHdUrlReady`), `EventChanges`, `ClipNotification`, and `TeamChange`.
  ([API Integration – Marketplace](https://docs.pixellot.tv/portal/en/kb/articles/pixellot-marketplace-api-documentation),
  [API Integration – Events Monitoring and Hooks](https://docs.pixellot.tv/portal/en/kb/articles/api-webhook-subscriptions-8-11-2023),
  [SwaggerHub partner_api](https://app.swaggerhub.com/apis/Pixellot/partner_api/))
- **Clip-by-time-range via API:** Not documented. The public docs describe event-level and
  webhook-driven notifications (a stream/recording becomes available, a clip is generated) but
  no endpoint that accepts an arbitrary `{court, startTime, endTime}` and returns a clip. The
  granularity is the "event" (i.e., the whole recorded session Pixellot was told to record), not
  an arbitrary sub-range requested after the fact.
- **Auto-highlights exposed to integrators:** Partially. The `ClipNotification` webhook fires for
  `automaticProductionHighlight` and `playerHighlight` content, meaning Pixellot's system *does*
  auto-generate highlights and *does* notify partners when one exists
  ([source](https://docs.pixellot.tv/portal/en/kb/articles/api-webhook-subscriptions-8-11-2023)).
  What the fetched documentation does not confirm is the exact payload (whether the notification
  carries a direct download/signed URL for the clip file itself, versus just an ID to look up
  through another call) — this is a genuine gap in what's public, not a "no."
- **Rough cost per court:** Not officially published by Pixellot. Third-party/reseller sources
  report roughly $199/month per team for a basketball subscription and $949 for the "Air"
  portable hardware unit, with a documented $69/month entry tier
  ([HoopBrief, third-party, not Pixellot](https://hoopbrief.com/blog/pixellot-cost-2026)) — flag
  this as a **third-party estimate, not a vendor price list**; Pixellot's own FAQ does not list
  prices ([pixellot.tv/faq](https://www.pixellot.tv/faq/)).
- **Notes:** Pixellot also exposes a raw-data-consumer VAS type that lets a partner have raw
  video pushed to the partner's **own S3 bucket** — a materially different delivery shape from a
  signed-URL pull (see Q4 below). No partner-tier/NDA language was found in the public docs; the
  onboarding described is closer to "register VAS metadata with an account manager" than a formal
  gated program.

### Veo (Veo Cam)

Note: "Veo" is a naming collision with Google DeepMind's unrelated "Veo" video-generation AI
model — search results mix the two heavily. This survey is about the sports-camera company
(veo.com / developer.veo.co.uk), a Danish court-camera vendor.

- **Documented API/webhook:** Yes, but gated. `developer.veo.co.uk` describes an API surface
  covering **Videos, Users, Groups/Communities, and Comments**, with a webhook-signing mechanism.
  Access is not self-serve: "you'll need a new application which can only be created by one of
  the team at VEO — please get in touch with your representative"
  ([developer.veo.co.uk](https://developer.veo.co.uk/),
  [apioverview](https://developer.veo.co.uk/apioverview)). A separate reference exists at
  `api.dev.camera.veo.co/docs/reference`, suggesting the camera-control surface is documented
  separately from the video/highlight surface.
- **Clip-by-time-range via API:** Not documented in what's publicly reachable. The `Videos`
  resource models whole recorded matches (Veo Cam records an entire booked session
  automatically), and there's no documented endpoint for requesting an arbitrary sub-range clip
  of a video after the fact — only for retrieving/managing whole videos and their AI-tagged
  moments.
- **Auto-highlights exposed to integrators:** Veo's consumer product auto-tags key moments and
  produces highlights inside the Veo Editor app; whether that highlight object is retrievable
  through the developer API (vs. only inside the consumer app) is **not stated** in the reachable
  docs — this is a documentation gap, not a confirmed "yes" or "no."
- **Rough cost per court:** Not published as an official price list on developer.veo.co.uk.
  Consumer pricing (not an API/integration tier) is publicly listed: Veo Cam 3 hardware from
  roughly $1,299–$1,998, plus a required annual subscription of about $67–$109+/month
  ([veo.com Starter subscription page](https://www.veo.com/en-us/veo-cam-3-starter-subscription-product-page);
  aggregator figures cross-checked via [breakingac.com](https://breakingac.com/news/2026/feb/18/veo-3-pricing-plans-explained-subscription-tiers-hidden-costs/) —
  flagged as third-party-compiled, not an official rate card).
- **Notes:** API access requiring a human "representative" conversation is itself a partner-gate
  — this is not a self-serve developer program.

### Hudl (Hudl Focus / Sportscode)

- **Documented API/webhook:** **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND** for Hudl Focus (the
  fixed-camera product relevant here). Hudl's public developer-facing APIs that *do* have real
  documentation are commercial data products — Wyscout Data API (OpenAPI 3.0) and Hudl
  Statsbomb/IQ — which are soccer analytics/stats APIs, not a video-clip-by-time-range API for
  the Focus camera line. No public endpoint reference for Focus was found; Focus/Sportscode
  camera integration is sales-mediated (search results consistently point to "Contact Sales"
  rather than a developer portal for Focus:
  [hudl.com/products/focus](https://www.hudl.com/products/focus)).
- **Clip-by-time-range via API:** Not possible via any public API for Focus. Clip creation is a
  manual, in-app workflow (Hudl Sportscode / the Hudl app) for coaches/analysts.
- **Auto-highlights exposed to integrators:** No. Hudl Focus auto-captures/auto-uploads game
  footage and its ecosystem (Sportscode, Hudl app) supports highlight-reel creation, but this is
  described only as in-consumer-app functionality, never as an integrator-facing API.
- **Rough cost per camera:** Reported (not an official public list price, but consistent across
  multiple secondary sources): camera hardware roughly $1,995–$3,000, plus an annual software
  subscription in the ~$900–$3,300/year range for a high-school-level package
  ([Hudl High School pricing page](https://www.hudl.com/pricing/high-school) lists packages
  without itemized per-camera numbers; per-camera figures come from secondary reporting, e.g.
  [BlinksAndButtons](https://blinksandbuttons.net/how-much-does-hudl-focus-camera-cost/) —
  flagged as third-party).
- **Notes:** Hudl is the clearest "closed, sales-mediated integration" case in Family 1.

### Reeplayer

- **Documented API/webhook:** **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND.** Reeplayer is
  positioned as a consumer/parent-facing livestreaming app for youth sports (soccer) using
  autonomous AI cameras. A partnership with Native Frame (a video infrastructure vendor) is
  described in a case study covering webhook-based stream-authorization and a stats API, but
  that integration is between Reeplayer and its own infrastructure vendor, not a public
  third-party developer API for outside applications
  ([Native Frame case study](https://www.nativeframe.com/blog/how-reeplayer-revolutionized-youth-soccer-with-native-frame-private-cloud)).
  No developer portal, API reference, or SDK for Reeplayer was found.
- **Clip-by-time-range via API:** Not documented; only the consumer app appears able to select
  and share clips.
- **Auto-highlights exposed to integrators:** No public evidence of this being exposed outside
  the consumer app.
- **Rough cost per court:** Not publicly published in any primary source found.

### Staige

- **Documented API/webhook:** **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND.** Staige's own
  marketing site states its platform provides "API interfaces to ensure your system runs
  smoothly 24/7" and references "seamless integration into existing camera systems," but no
  developer portal, endpoint reference, or SDK is linked or discoverable
  ([staige.com/en](https://staige.com/en)). Staige is positioned as a bespoke/consulting-style
  Edge-AI vendor (with Google Cloud as an infrastructure partner) rather than a self-serve
  platform, delivered through a three-phase consulting engagement (PoC → hardware/AI integration
  → operations), which structurally implies integration terms are negotiated per deal rather than
  published.
- **Clip-by-time-range via API:** Not documented anywhere reachable.
- **Auto-highlights exposed to integrators:** Not documented anywhere reachable.
- **Rough cost per court:** Not publicly published; Staige's model is explicitly custom-quoted
  ("Book the full package or individual modules — tailored to your resources").

### Southeast Asia / Vietnam market

Searching Vietnamese terms ("camera sân pickleball", "lắp đặt camera AI sân pickleball") surfaces
**local installation/reseller businesses**, not a distinct regional sports-camera *platform*
vendor. Two representative examples fetched directly:

- **PANACO** (`panaco.vn`) markets a "SmartCourt / AI-Powered Analytics" package claiming ball
  tracking, shot analysis, auto-highlights, and "API và tích hợp" (API and integration) for
  connecting to third-party scoring software and tournament platforms
  ([panaco.vn](https://panaco.vn/dich-vu/lap-dat-camera-san-pickleball/)). **This is a marketing
  claim only** — no developer documentation, endpoint reference, or API spec is published or
  linked; the underlying camera hardware brands they install are standard general-purpose CCTV
  brands: **Hikvision, Dahua, Imou, Ezviz, Reolink, UniFi**. In other words, this "SmartCourt AI"
  package is very likely Family-2 CCTV hardware plus a locally-built analytics/VMS layer, not a
  Pixellot/Veo-class purpose-built sports platform. Published reference pricing: 500,000–3,000,000
  VND (basic) up to 10,000,000–25,000,000 VND (professional tier).
- **cuahang247.com** offers a similar "trọn gói" (full package) pickleball camera + VAR service
  built on **Hikvision, Dahua, and Tiandy** hardware, managed through standard consumer VMS
  software (**IVMS-4200**, **DMSS**, Tiandy Player) rather than any proprietary sports-API
  platform ([cuahang247.com](https://cuahang247.com/san-pham/dich-vu-lap-dat-camera-san-pickleball-tron-goi/)).
  No third-party API or auto-highlight capability is mentioned. Packages range roughly
  6.5M–40M VND depending on camera count (4 to 32 cameras).
- **Conclusion for the SEA segment:** the pickleball-specific "AI camera" installers actually
  found in the Vietnam market are systems integrators reselling and configuring **Family 2
  general CCTV/NVR hardware** (Hikvision/Dahua/Tiandy/UniFi/Reolink) with a "VAR"/analytics
  marketing layer on top, not licensees of an international sports-camera platform like Pixellot
  or Veo. No Vietnam-specific Pixellot/Veo-class vendor with its own public developer API was
  found.

### Other Family-1-adjacent products noticed (not deep-dived)

Search results also surfaced PlaySight SmartCourt, Wingfield, Clutch, Courtana, SwingVision,
Save My Play, and Baseline Vision as racket-sport AI camera products with automatic
highlight/replay claims. These were outside the vendor list this survey was asked to investigate
in depth, so no primary-source API research was done on them; they are noted here only so the
reader knows the category is larger than the five vendors above, in case a future survey needs to
cover them.

### Family 1 summary table

| Vendor | Public API/webhook | Clip-by-time-range via API | Auto-highlights exposed to integrators | Rough cost per court | Notes |
|---|---|---|---|---|---|
| Pixellot | Yes — Partner API + webhooks (documented) | No — event/webhook granularity only, no arbitrary time-range endpoint documented | Partial — `ClipNotification` webhook fires on auto-highlight creation, but payload detail (signed URL vs. reference) not confirmed in public docs | Not officially published; ~$69–199/mo + ~$949 hardware per third-party reports | Also offers raw-data push to partner-owned S3 bucket |
| Veo | Yes, but gated — must contact a Veo rep to get API app credentials | Not documented — API models whole videos, not arbitrary sub-ranges | Not documented whether highlights are API-reachable (consumer app only, confirmed) | Not officially published for API tier; consumer hardware ~$1,299–$1,998 + ~$67–109+/mo subscription | Name collision with Google's unrelated "Veo" video-gen AI |
| Hudl (Focus/Sportscode) | **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND** for Focus; only Wyscout/Statsbomb (stats, not clip) APIs are documented | No | No — highlight creation is in-app only | Reported (not official): ~$1,995–3,000 camera + ~$900–3,300/yr | Sales-mediated integration only |
| Reeplayer | **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND** | No | No | Not publicly published | Only its own infra-vendor integration (Native Frame) is documented, not a public third-party API |
| Staige | **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND** | No | No | Not publicly published (custom-quoted) | Consulting/bespoke engagement model |
| SEA/Vietnam installers (PANACO, cuahang247, etc.) | **MARKETING CLAIM — NO PUBLIC DEV DOCS FOUND** ("API và tích hợp" claimed, undocumented) | No | Claimed in marketing, unverifiable | 500K–40M VND depending on package/camera count | Actually built on Family-2 CCTV hardware (Hikvision/Dahua/Tiandy/UniFi/Reolink) + local VMS, not a distinct sports platform |

---

## Family 2: General CCTV/NVR

### ONVIF (Profile G, Profile T, Replay/Streaming specs)

ONVIF is a standard, not a vendor — it matters here because it is what makes "fetch a time range
from a generic camera/NVR" interoperable across brands, when a given device conforms to the
relevant profile.

- **Time-range export via API:** Yes, when the device supports **Profile G**, which explicitly
  defines a client/device model for configuring, requesting, and controlling recording, plus
  event/recording *search* and an **`ExportRecordedData`** operation that "exports the selected
  recordings to the given storage target"
  ([ONVIF Profile G Specification v1.0](https://www.onvif.org/wp-content/uploads/2017/01/ONVIF_Profile_G_Specification_v1-0.pdf),
  [ONVIF Recording Control Service Spec](https://www.onvif.org/specs/srv/rec/ONVIF-RecordingControl-Service-Spec.pdf),
  [Profile G page](https://www.onvif.org/profiles/profile-g/)). Playback of a specific historical
  time range is done via the **ONVIF Replay** extension to RTSP: the client issues an RTSP `PLAY`
  with absolute-UTC start/end range headers against a "replay URI," and "the replay protocol may
  also be used to download data from the storage device so that export functionality can be
  provided" ([ONVIF Replay Control Service Spec](https://www.onvif.org/specs/srv/replay/ONVIF-ReplayControl-Service-Spec.pdf)).
  **Profile T** is a streaming/advanced-video profile (H.265, imaging, motion/tamper events,
  metadata, two-way audio) layered on Profile S features — it is not itself the recording/export
  profile ([ONVIF Profile T Specification v1.0](https://www.onvif.org/wp-content/uploads/2018/09/ONVIF_Profile_T_Specification_v1-0.pdf)).
- **Requires on-site NVR:** Effectively yes for the recording/export functionality — Profile G is
  implemented by an NVR, a camera with onboard storage, or a VMS server; ONVIF itself is a
  protocol, so *some* on-site (or vendor-cloud) device must actually be doing the recording that
  gets searched/exported.
- **Internet reachability model:** ONVIF/RTSP/Replay is a **local-network protocol** by design
  (RTSP over TCP port 554 by default, ONVIF SOAP/REST over HTTP on the device's LAN address). It
  does not itself define a cloud relay — internet reachability depends entirely on the specific
  vendor/NVR's own cloud-relay feature (see Hikvision/Dahua/UniFi below) or the venue opening
  ports, which ONVIF does not solve.

### RTSP (as a protocol, standalone)

- Explicitly flagged per the brief: **RTSP by itself is a live-stream / stream-control protocol**,
  used to negotiate and control an ongoing media session (`SETUP`/`PLAY`/`PAUSE`/`TEARDOWN`). It
  has no native concept of "give me the recording from 18:00 to 19:00 yesterday" unless paired
  with either (a) ONVIF's Replay extension (which adds absolute-time range headers to `PLAY` and
  a device-side recording store to play back from), or (b) a vendor-specific playback/download API
  (e.g., Hikvision ISAPI, Dahua's HTTP API) that generates a special "playback RTSP URL" or a
  direct file download for a bounded time window
  ([ONVIF Streaming Specification](https://www.onvif.org/specs/stream/ONVIF-Streaming-Spec.pdf),
  [ONVIF Replay Control Service Spec](https://www.onvif.org/specs/srv/replay/ONVIF-ReplayControl-Service-Spec.pdf)).
  A bare RTSP URL to a live camera, with no NVR/recording layer behind it, cannot serve historical
  footage at all.

### Hikvision (ISAPI / Open Platform / HikCentral)

- **Time-range export via API:** Yes, documented. The pattern is: `GET/POST
  /ISAPI/ContentMgmt/search` to search recordings by time (returns one or more `playbackURI`
  values, which look like `rtsp://.../Streaming/tracks/101?starttime=...&endtime=...`), then
  `GET/POST /ISAPI/ContentMgmt/download?playbackURI=...` to start a download of that bounded
  segment as a file
  ([Hikvision: How to search and download the video file via ISAPI](https://www.hikvisioneurope.com/eu/portal/portal/Technology%20Partner%20Program/03-How%20to/How%20to%20search%20and%20download%20the%20video%20file%20from%20NVR%20via%20ISAPI.pdf),
  community confirmation on [ipcamtalk.com](https://ipcamtalk.com/threads/isapi-contentmgmt-download-to-download-a-record-segment.48506/)).
  HikCentral (the VMS/platform layer) additionally exposes an HTTP-based Open API for video,
  alarm, and ANPR functionality to third-party integrators, gated behind partner registration
  ([Hikvision TPP – HikCentral Professional Integration](https://tpp.hikvision.com/products/HCP-Integration)).
- **Requires on-site NVR:** Yes — ISAPI recording/search/download targets a camera or NVR/DVR on
  the local network (or reachable through Hikvision's own cloud relay, see below); it is not a
  cloud-native SaaS.
- **Internet reachability model:** Hik-Connect provides a **P2P/cloud-relay** model: the NVR
  makes an outbound connection to Hikvision's cloud, and remote clients (including, in principle,
  a server-side integration) reach the device through that relay — "no port forwarding, no
  exposing your NVR to the open internet," working even behind CGNAT. Manual port forwarding
  (ports 8000, 554, 80) remains an alternative if the venue prefers direct access
  ([Hik-Connect setup guide](https://cctvprox.com/hik-connect-setup-for-hikvision-acusense-nvr-complete-p2p-remote-view-guide/)).
  Whether the documented ISAPI download endpoints are reachable *through* the Hik-Connect P2P
  relay (vs. only on the LAN) was not confirmed in the sources found — this is a gap: assume
  LAN-only for the ISAPI download endpoints unless a specific cloud-relay API for them is
  separately confirmed.

### Dahua (OpenSDK / Open Platform)

- **Time-range export via API:** Yes, documented in Dahua's HTTP API guide (versions seen up to
  ~4.11.x), which includes "Download Media File between Times" functionality and supports
  multiple output formats (dav, avi, mp4, flv, asf)
  ([community-hosted copies of the Dahua HTTP API doc](https://wiki.dno-it.ru/wp-content/uploads/2023/06/dahua_http_api_for_ipcsd-v1.40.pdf),
  [rroller/dahua GitHub issue referencing v3.26/v4.11.13](https://github.com/rroller/dahua/issues/338)).
  A formal NetSDK also documents playback/download functions
  ([community-hosted NetSDK Programming Guide](https://www.scribd.com/document/352876826/DAHUA-Camera-NetSDK-Programming-Guide)).
  Dahua's *official* current developer channel is a gated partner portal: register at
  `depp.dahuasecurity.com`, **sign an NDA**, then download the API Guide and obtain an API
  license key ([Dahua Partner Alliances / depp.dahuasecurity.com](https://depp.dahuasecurity.com/)).
  Because the fully-current official API Guide sits behind that NDA'd registration, this survey
  relied on community-mirrored copies of the HTTP API spec for technical detail — flagged
  accordingly (the *capability* is well corroborated across multiple independent mirrors, but the
  authoritative current-version document was not directly fetchable here).
- **Requires on-site NVR:** Yes — same shape as Hikvision; a Dahua NVR/DVR or camera with local
  storage is required.
- **Internet reachability model:** Dahua offers its own P2P/cloud-relay mechanism (analogous to
  Hik-Connect) via its mobile apps and DMSS platform; specifics of whether the HTTP API's
  download endpoints are reachable through that relay (vs. LAN-only) were not directly confirmed
  from primary sources in this pass — treat as LAN-only unless independently verified.

### Reolink

- **Documented API:** Partially — Reolink does not maintain what could be called a formal,
  versioned public developer portal with an SLA/partner program. Instead there is a
  community-circulated "Reolink Camera HTTP API User Guide" (a PDF originally shared by Reolink
  support/community staff, now mirrored and reverse-engineered further by third parties into
  OpenAPI specs) covering authentication, system config, recording/playback, PTZ, and AI
  detection over a JSON HTTP interface at `/cgi-bin/api.cgi`
  ([community documentation index](https://github.com/mnpg/Reolink_api_documentations),
  [interactive OpenAPI mirror](https://mosleyit.github.io/reolink_api_wrapper/)). This matches
  the brief's premise: Reolink has historically been closed/limited for formal third-party API
  support — what exists is community-documented rather than an official developer-portal product,
  even though Reolink support staff have historically shared the underlying guide. **Flag:**
  treat Reolink's API as functionally available (many third-party integrations, e.g. Home
  Assistant, work against it) but **not an officially supported/versioned public developer
  program** the way Hikvision's TPP or Dahua's DEPP are.
- **Time-range export via API:** The documented API surface includes recording/playback
  operations, so time-bounded retrieval is achievable in practice via the same
  search-then-download pattern common to this API family, but there is no single official
  Reolink page confirming a stable "export by time range" contract the way Hikvision/Dahua
  formally document.
- **Requires on-site NVR:** Not necessarily — many Reolink cameras record to onboard SD card or
  a Reolink NVR; the API is reachable directly against an individual camera's local IP as well.
- **Internet reachability model:** Reolink ships its own cloud/P2P app (Reolink app, "Reolink
  Cloud") for consumer remote viewing, but the HTTP API itself is documented as operating
  **on the local network via the device's IP address** — reaching it from the internet requires
  either the venue opening a port/VPN, or going through Reolink's own consumer cloud app (which
  is not the same surface as the documented HTTP API).

### UniFi Protect

- **Documented API:** Yes, as of a genuinely recent, official development: **UniFi Protect 5.3
  added an official, documented "Protect API"** as part of Ubiquiti's broader "Public Integration
  API" effort, accessible via the gear icon → Control Plane in the Protect console, replacing
  reliance on the previously-undocumented private API
  ([uilibs/uiprotect discussion #442, "Official Protect API released in 5.3"](https://github.com/uilibs/uiprotect/discussions/442),
  [Getting Started with the Official UniFi API – Ubiquiti Help Center](https://help.ui.com/hc/en-us/articles/30076656117655-Getting-Started-with-the-Official-UniFi-API)
  — this help-center page returned HTTP 403 to automated fetch and could not be read directly;
  its existence and title are corroborated via search-result indexing and the GitHub discussion,
  but its full content was not verifiable here).
- **Time-range export via API:** Not explicitly confirmed in the *official* 5.3 documentation
  from what was reachable. What is well corroborated (via the community `uiprotect` library and
  multiple export tools) is that the underlying Protect video-export mechanism does support
  bounded time-range downloads, with a known practical constraint that very large ranges (e.g.
  8 hours) must be chunked into ~1-hour requests to avoid the export being cancelled
  ([community discussion of export timeouts](https://community.ui.com/questions/Unifi-Protect-Video-Export-Timeout-API/01fbb544-adff-4e6b-96aa-f0916d5363e0),
  [protect-archiver / UnifiVideoExporter tools](https://github.com/lilhoser/UnifiVideoExporter)).
  Whether that specific export capability has already been folded into the *official* 5.3 API
  surface (vs. still only reachable through the older private/undocumented API that the official
  one is gradually superseding) is a real open question this survey could not fully resolve from
  public sources — flagged as a genuine gap, not assumed either way.
- **Requires on-site NVR:** Yes — a UniFi OS Console / Cloud Key / Dream Machine running Protect
  is the on-site recording hub; there is no cloud-only mode for the actual video storage.
- **Internet reachability model:** Local-network-first. The official API is hosted and documented
  on the controller itself. Ubiquiti's broader ecosystem does offer a cloud "Remote Access"
  feature for the consumer app, but the newer official Protect API appears oriented at
  same-network / VPN'd access rather than an inherent internet-exposed cloud endpoint; reaching it
  from the public internet without the venue's own network exposure (port-forward, VPN, or
  Ubiquiti's remote-access relay) was not documented as a first-class supported pattern in what
  was found.

### Family 2 summary table

| Vendor/standard | Time-range export via API | Requires on-site NVR | Internet reachability model | Notes |
|---|---|---|---|---|
| ONVIF (Profile G + Replay ext.) | Yes, if device implements Profile G — `ExportRecordedData` + RTSP Replay with UTC time-range headers | Yes (by an NVR/camera/VMS implementing the profile) | Not defined by the standard itself — LAN by default; cloud reachability is vendor-specific | Profile T is streaming/advanced-video, not the recording/export profile |
| RTSP (standalone) | **No** — live-stream/session-control protocol only | N/A | LAN by default (port 554) | Needs ONVIF Replay or a vendor playback API layered on top for historical footage |
| Hikvision (ISAPI / HikCentral) | Yes — `ContentMgmt/search` then `ContentMgmt/download?playbackURI=...` | Yes | Hik-Connect P2P/cloud relay (no port forward needed) or manual port forwarding | HikCentral Open API is partner-gated (TPP registration) |
| Dahua (HTTP API / NetSDK) | Yes — "Download Media File between Times," multiple output formats | Yes | Vendor P2P/cloud app (DMSS) exists; API-level cloud reachability unconfirmed, assume LAN | Official current docs are NDA-gated behind depp.dahuasecurity.com |
| Reolink | Partial/community-documented, not an official versioned program | No (SD card, NVR, or direct per-camera) | LAN by default for the documented HTTP API; Reolink's own consumer cloud app is a separate surface | Historically closed/limited formal third-party program, as the brief anticipated |
| UniFi Protect | Underlying export capability well corroborated (community tooling); not confirmed as part of the new official 5.3 API surface | Yes (UniFi OS Console/Cloud Key/Dream Machine) | Local-network-first; remote access is a separate consumer feature, not confirmed as a first-class official-API pattern | Official documented API is very new (2026); real gaps remain vs. the unofficial `uiprotect` library |

---

## 1. Clock alignment/drift

Two very different clock models are in play:

- **Sports-camera cloud platforms** (Pixellot, Veo, Hudl Focus, Reeplayer, Staige): these are
  cloud-connected devices whose recordings are timestamped/managed server-side by the vendor's
  own cloud platform once uploaded, and the device itself typically syncs its clock over the
  internet as part of normal cloud-connected operation. No vendor documentation was found stating
  an explicit clock-drift tolerance, but because these are internet-connected appliances checking
  in with a cloud backend continuously (unlike an offline consumer DVR), the practical drift risk
  is much lower — the bigger risk for these platforms is not "wall clock vs. camera clock" but
  "when does the vendor's *event* boundary (which a human or app defined at booking/session-start
  time) line up with the venue's actual booking-system clock," which is an application-level
  scheduling problem, not a hardware clock-drift problem.
- **Local NVR/DVR systems** (Hikvision, Dahua, Reolink, UniFi, generic ONVIF devices): these can
  and do drift meaningfully if not kept on NTP. Consumer-grade quartz clocks are not precise, and
  systems "might be running in isolation for months or even years without synchronization,"
  leading to drift of many minutes over time; industry guidance recommends NTP sync every
  1–24 hours, after which "clocks may drift slightly during these intervals, but it is unlikely to
  drift enough to cause significant issues" — but that guidance assumes NTP is actually configured,
  which is not guaranteed on a small venue's NVR
  ([IPVM: NTP / Network Time Guide for Video Surveillance](https://ipvm.com/reports/network-time-guide-for-video-surveillance)).
  Critically, in a classic BNC/analog DVR setup, the **DVR** overlays the timestamp; in an
  IP-camera/NVR setup, the **individual camera** does, so both camera and NVR clocks need
  independent NTP configuration or they can disagree with each other, not just with true time
  ([same IPVM report](https://ipvm.com/reports/network-time-guide-for-video-surveillance)).
- **Does a slot starting exactly on the hour reliably line up with the footage's internal
  timestamp?** For a cloud sports platform, reasonably yes, assuming the vendor's own
  event-scheduling metadata (not raw camera clock) is what the app queries against — but this was
  not something any vendor's docs explicitly promised as an SLA. For a local NVR/DVR without
  verified NTP configuration, **no** — this should not be assumed reliable without the venue
  actively confirming NTP is configured on both camera and recorder, since drift of "many minutes
  or more" is explicitly called out as a real failure mode by industry guidance.

## 2. Finished highlight via API

The only vendor found with any documented signal in this direction is **Pixellot**: its
`ClipNotification` webhook explicitly fires for `automaticProductionHighlight` and
`playerHighlight` content
([Pixellot – API Integration: Events Monitoring and Hooks](https://docs.pixellot.tv/portal/en/kb/articles/api-webhook-subscriptions-8-11-2023)),
meaning Pixellot's platform does generate finished highlight clips and does notify integrating
partners when one exists. However, the publicly reachable documentation does **not** confirm
whether that notification payload includes a directly downloadable/signed file URL for the
highlight itself, or only a reference/ID requiring a further (undocumented, or partner-only) call.
So the honest answer is: **Pixellot is the closest thing found to "yes," but it is not fully
confirmed end-to-end from public docs alone** — this would need direct partner-account
verification (e.g. registering for Pixellot's partner program and inspecting an actual webhook
payload) to close the gap. No other vendor investigated (Veo, Hudl, Reeplayer, Staige, or any
general-CCTV vendor) was found to expose a finished highlight clip to third-party integrators via
a documented API — highlight generation in those cases is confined to the vendor's own
consumer app/UI, or in Veo's case, undocumented whether the API surfaces it at all.

## 3. File size per hour of footage

Using the standard relationship `MB per hour ≈ bitrate(Mbps) × 3600 / 8` (i.e. `Mbps × 450`),
and typical fixed-camera (not high-motion cinema) bitrates reported by surveillance-industry
sources and one vendor bit-rate table:

| Resolution | Typical H.264 bitrate | ≈ GB/hour (H.264) | Typical H.265 bitrate | ≈ GB/hour (H.265) |
|---|---|---|---|---|
| 720p | ~0.5–2 Mbps ([Hikvision recommended bitrate table](https://www.hikvision.com/content/dam/hikvision/ca/faq-document/H.2645-&-H.2645-Recommended-Bit-Rate-at-General-Resolutions.pdf)) | ~0.2–0.9 GB | roughly 30–50% lower ([general H.265 vs H.264 guidance](https://getstream.io/blog/avc-vs-hevc/)) | ~0.1–0.5 GB |
| 1080p | ~2.5–5 Mbps ([nellyssecurity.com](https://nellyssecurity.com/blogs/articles/security-camera-storage-bitrate-and-resolution-a-complete-guide), [castlesecurity.com.au](https://www.castlesecurity.com.au/news/understanding-your-cctv-cameras-bitrate/)) | ~1.1–2.3 GB | ~1.5–3 Mbps | ~0.7–1.3 GB |
| 4K (2160p) | ~8–34 Mbps, reported ranges vary widely across sources ([arstech.net](https://arstech.net/video-encoding-bitrates-for-4k-and-1080p-with-h-264-and-h-265/)) | ~3.6–15.3 GB | ~4–8 Mbps typical, up to ~20 Mbps for high-detail scenes | ~1.8–3.6 GB (up to ~9 GB at the high end) |

Reasoning: a fixed, mostly-static court-view camera (little motion compared to a broadcast/cinema
shot) sits toward the lower end of each vendor-quoted range, since H.264/H.265 bitrate scales
strongly with scene motion and detail, and a stationary wide shot of a court is low-complexity
video by codec standards. So for **a one-hour pickleball court booking recorded by a single fixed
camera**, a reasonable planning number is roughly **0.2–1 GB/hour at 720p, ~1–2 GB/hour at 1080p,
and ~2–8 GB/hour at 4K** (H.265 preferred where supported, cutting the above H.264 figures
roughly in half). These are reasoning-based estimates from published bitrate guidance, not a
measured number from any single vendor's spec sheet for a "pickleball camera" specifically — no
vendor was found publishing a court-camera-specific MB/hour figure.

## 4. Delivery shape per system

- **Pixellot:** Event/clip references delivered via webhook notification, with the underlying
  media (per docs) reachable as HLS/HTTP URLs (e.g. `cloudRecordedHdUrlReady`); additionally,
  Pixellot supports a **push-to-partner-owned-S3-bucket** model for raw data via its
  "Raw Data Consumer" VAS type. **The booking app would not need to hold video data itself** in
  either shape — it either receives a URL to play/download from Pixellot's cloud, or receives
  files already landed in a bucket the booking app's operator controls (still not the app's own
  server storage, but object storage the operator owns).
- **Veo:** Videos are managed through Veo's cloud platform and API; the exact delivery mechanism
  (signed URL vs. something else) for a `Videos` resource was not confirmed in the reachable docs,
  but the general pattern for cloud sports-camera platforms of this kind is a signed/expiring
  download URL rather than a raw file push. Assuming this pattern holds, **the booking app would
  not need to hold video data itself** — it would fetch/redirect to a signed URL as needed rather
  than storing the media.
- **Hudl:** No public API exists for Focus clip delivery at all (see Family 1 section), so this
  question doesn't apply — there is no documented delivery shape to describe.
- **ONVIF/Profile G `ExportRecordedData`:** Exports to "the given storage target" — in practice
  this means the ONVIF client (i.e., the booking app or an intermediary service acting on its
  behalf) pulls a file from the device/NVR and is responsible for storing/re-hosting it if it
  needs to be shared onward (e.g., surfaced as a clip link inside the booking app). **The booking
  app (or an intermediary the venue/app operator runs) would need to hold the video data itself**,
  at least transiently, since ONVIF does not define a cloud hand-off — it is a
  device-to-client transfer.
- **Hikvision ISAPI / Dahua HTTP API:** Same shape as ONVIF above — `ContentMgmt/download` (or the
  Dahua equivalent) is a direct file download from the NVR/camera to whatever client calls it.
  **The calling application must download and re-host the file itself** if it wants to hand a
  clip to an end user (there is no vendor-hosted signed-URL hand-off for these APIs as documented)
  — unless the venue is also using Hik-Connect/DMSS cloud, in which case the *relay* moves bytes,
  but the app-facing contract for the ISAPI/HTTP-API download endpoints themselves is still "you
  get a file, you store/serve it."
- **Reolink / UniFi Protect:** Same pull-and-store shape — the documented (or community-documented)
  export endpoints hand back a file/stream that the calling application must persist if it is to
  be served onward; **the app would need to hold the video data itself** (even if only
  transiently, to re-serve or hand off to a highlight-generation step) unless the venue separately
  wires up its own cloud storage push, which none of these vendors document as a native feature
  comparable to Pixellot's S3 option.

**Bottom line on Q4:** Family 1's cloud platforms (where an API exists at all) tend toward a
signed-URL / vendor-hosted-media model that keeps the booking app stateless with respect to
video bytes. Family 2's NVR/CCTV/ONVIF world is fundamentally a **pull-and-store** model: the
integrating application (or an intermediary service it operates) ends up holding the file, at
least transiently, unless the venue is willing to build/host its own further storage/relay layer
on top.

## 5. Integrator contract requirements

| Vendor | Requirement, as documented |
|---|---|
| Pixellot | Register VAS metadata with an account manager; JWT auth issued for prod/staging. No explicit NDA or subscription-tier gate found in public docs. |
| Veo | API app must be created *by a Veo team member* on request — effectively a manual partner-approval gate, no self-serve signup found. |
| Hudl (Focus) | Not documented / not found — Focus integration is sales-mediated, no developer program surfaced at all. |
| Reeplayer | Not documented / not found. |
| Staige | Not documented / not found — engagement is consulting-style and custom-quoted. |
| Hikvision | Formal Technology Partner Program with three tiers (Integration/Solution/Premium Partner), application review by a regional partner-alliance manager, ~7 business day turnaround ([tpp.hikvision.com/tpp/AboutTPP](https://tpp.hikvision.com/tpp/AboutTPP), [Getting Started Guide](https://tpp.hikvision.com/pd/GettingStartedGuide.pdf)). Specific NDA/subscription-tier terms not detailed in what's public. |
| Dahua | Registration at `depp.dahuasecurity.com` **requires signing an NDA** before the API Guide/license key is issued ([depp.dahuasecurity.com](https://depp.dahuasecurity.com/)). |
| Reolink | Not documented / not found — no formal partner program; API guide historically shared informally. |
| UniFi Protect | Not documented / not found as a gated program — the official API is exposed directly in the Protect console to any admin of that installation; no separate partner approval step surfaced. |
| ONVIF (standard) | N/A — it's an open standard with conformance testing/certification for vendors, not an integrator contract for app developers. |

## 6. Concrete integration shape per family

**Family 1 (sports-camera cloud platform), where an API exists at all (e.g. Pixellot):**
1. Register as a partner (account-manager-mediated, not self-serve for most vendors) and receive
   API credentials (JWT).
2. Subscribe to the vendor's webhook(s) for the relevant venue/court "event" (the recording
   session the vendor's system was told to run, which itself must have been scheduled to roughly
   match the court/time window in the first place — there is no "give me minutes 18:00–19:00 of
   whatever was recorded" call; the recordable unit is the vendor's own event object).
3. Receive a webhook when the recording (and/or auto-highlight) for that event becomes available.
4. Follow the URL/reference in that webhook to retrieve the media (signed URL, or in Pixellot's
   raw-data model, read it from the operator's own S3 bucket that the vendor pushed to).
5. The app never needs to "seek" into an arbitrary time range after the fact in the way a CCTV/NVR
   integration would — the booking's start/end time has to be pushed to the camera platform
   *up front* (as the event's scheduled window) for this to line up at all.

**Family 2 (general CCTV/NVR + ONVIF):**
1. Confirm the venue's camera/NVR conforms to ONVIF Profile G (or use the vendor's proprietary
   equivalent — ISAPI for Hikvision, the HTTP API/NetSDK for Dahua).
2. Register as a partner/developer with that vendor if going through its proprietary API
   (Hikvision TPP, Dahua DEPP with NDA) — or skip vendor registration entirely and talk ONVIF
   directly to the device on the venue's LAN.
3. At request time (after a booking's start/end time is known — this can be looked up
   after-the-fact, unlike Family 1), call the search operation (ONVIF recording search /
   Hikvision `ContentMgmt/search` / Dahua equivalent) with the court's camera ID and the
   `{startTime, endTime}` derived from the booking.
4. Call the export/download operation (`ExportRecordedData` / `ContentMgmt/download` / Dahua
   "Download Media File between Times") to pull a file for that exact range.
5. The calling application (or an intermediary service run by the venue/app operator) receives a
   raw video file and must store/re-host it — there is no vendor-hosted signed URL step baked in.
6. Reaching the device from the public internet (since this app runs on Vercel, not on the
   venue's LAN) requires either the venue exposing the device (port-forward/VPN) or using the
   NVR vendor's own P2P/cloud relay (Hik-Connect, DMSS) if that relay actually forwards the
   relevant API/download traffic — which was not confirmed as guaranteed for any of the vendors
   surveyed. In practice this usually means an on-site relay/agent process is needed to bridge the
   venue's LAN to the internet-facing booking app, rather than the booking app talking to the NVR
   directly.

## 7. Which family is favored

**Family 1 (sports-camera cloud platforms) is favored for this specific use case** — an
internet-hosted booking app (on Vercel) needing to fetch a clip keyed to a specific booking's
time range — for the following reasons, each grounded in what was found above:

- **Reachability:** Family 1 platforms are inherently internet-facing SaaS products with cloud
  APIs; Family 2 devices are LAN-first and only reach the internet through vendor-specific,
  imperfectly-documented P2P relays, or by the venue exposing its network — a materially bigger
  operational and security burden for a Vercel-hosted app to depend on.
- **Delivery shape:** Family 1's signed-URL/webhook model (at least for Pixellot) keeps this app
  stateless with respect to video bytes; Family 2 is fundamentally pull-and-store, meaning this
  app (or an intermediary it runs) would need to become a video host, with all the storage-cost
  and re-hosting implications that carries.
- **Clock/scheduling alignment:** Family 1 platforms tie a recording to a scheduled "event" that
  can be set up to match the booking window in advance, which sidesteps the clock-drift problem
  entirely (no need to trust a possibly-unsynced camera clock — the vendor's own event boundary is
  authoritative). Family 2 requires trusting an on-site NVR's clock to actually be
  NTP-synced, which is not guaranteed at a small venue.
- **Where Family 2 wins instead:** if the venue already has (or is going to install) ordinary CCTV
  for security regardless of any highlight feature, and is willing to run a small always-on
  bridge/agent on-site (to solve the reachability and re-hosting problems above), Family 2 is far
  cheaper hardware-wise and works with commodity, second-sourceable equipment (as the SEA-market
  survey shows — venues are already installing Hikvision/Dahua/Tiandy cameras for basic security
  regardless of any highlight ambition). But that requires the app/venue team to build the parts
  a Family 1 vendor would otherwise provide out of the box (the export-orchestration, storage, and
  clip-serving layer) — Family 2 is a cheaper hardware/software bill of materials in exchange for
  more integration work carried by this app's own team.

---

## Answer to AND-109

Numbered to match the ticket's own numbering (1–2 are the two vendor families; 3–7 are the
cross-cutting questions).

1. **Sports/court-camera family** (Pixellot, Veo, Hudl, Reeplayer, Staige, SEA vendors): only
   Pixellot and Veo have real developer documentation. Pixellot has a documented Partner API and
   webhooks, but no endpoint turns an arbitrary time range into a clip — the recordable unit is
   the vendor's own scheduled "event." Veo has a documented API surface but it is gated behind a
   Veo staff member manually creating your API application. Hudl Focus, Reeplayer, and Staige have
   **no public developer documentation** — any "API available" claim for them is marketing only.
   No Vietnam/SEA vendor with its own sports-camera platform was found; local installers (PANACO,
   cuahang247) rebrand standard Hikvision/Dahua/Tiandy/UniFi/Reolink CCTV hardware under an "AI
   SmartCourt" marketing layer, with no developer docs behind their own "API và tích hợp" claims.
   Cost per court is not officially published by any vendor; third-party estimates run roughly
   $69–199/month + ~$949 hardware (Pixellot), ~$67–109+/month + $1,299–1,998 hardware (Veo), or
   ~$900–3,300/year + $2,000–3,000 hardware (Hudl); Staige is fully custom-quoted.

2. **General CCTV/NVR family** (ONVIF/RTSP, Hikvision, Dahua, Reolink, UniFi Protect): all of them
   have *some* documented way to search and export a bounded time range as a file — ONVIF Profile
   G's `ExportRecordedData` plus the Replay extension to RTSP, Hikvision ISAPI
   (`ContentMgmt/search` then `ContentMgmt/download`), Dahua's HTTP API ("Download Media File
   between Times"), Reolink's community-documented HTTP API (not an official versioned program),
   and UniFi's new (2026) official Protect API (whose time-range export coverage isn't fully
   confirmed in the official docs yet, though the underlying capability is well corroborated via
   community tooling). All of them require an on-site recording device (NVR/DVR/camera with
   storage) — there is no cloud-only mode. None is reachable from the public internet without
   either the venue opening ports/a VPN, or relying on the vendor's own P2P/cloud relay
   (Hik-Connect, DMSS) — and whether those relays actually carry the search/download API traffic
   (as opposed to just live view) was not confirmed for any vendor surveyed.

3. **Clock alignment/drift:** Sports-camera cloud platforms tie recordings to a vendor-managed
   "event" object, so drift risk is mostly an app-level scheduling concern rather than a hardware
   clock problem. Local NVR/DVR/CCTV clocks can drift by many minutes if NTP isn't actively
   configured on both the camera and the recorder, and this is common at small venues — a slot
   starting exactly on the hour should not be assumed to line up with the footage's internal
   timestamp unless NTP sync on-site is verified.

4. **Finished highlight via API:** Only Pixellot shows a documented signal in this direction — its
   `ClipNotification` webhook fires when an automatic or player highlight is generated — but public
   docs don't confirm whether the notification carries a directly usable download URL. No other
   vendor surveyed (Veo, Hudl, Reeplayer, Staige, or any CCTV vendor) documents handing a finished
   highlight to a third-party integrator via API; where highlights exist, they're confined to the
   vendor's own consumer app.

5. **File size per hour:** Roughly 0.2–1 GB/hour at 720p, 1–2 GB/hour at 1080p, and 2–8 GB/hour at
   4K for a single, mostly-static fixed court camera, based on published H.264/H.265 bitrate
   guidance (not a court-camera-specific measured figure from any vendor).

6. **Delivery shape:** Family 1 platforms (where an API exists) tend to hand back a signed URL or
   push raw data to a bucket the operator owns, so the booking app itself never has to hold video
   bytes. Family 2 (ONVIF/Hikvision/Dahua/Reolink/UniFi) is a pull-and-store model — the export
   endpoint hands back a file, and the calling application (or an intermediary it runs) has to
   store and re-serve it; there is no vendor-hosted signed-URL hand-off documented for any of
   these.

7. **Integrator contract requirements:** Dahua requires signing an NDA to get its official API
   guide; Hikvision runs a tiered, application-reviewed Technology Partner Program; Veo requires a
   Veo team member to manually create your API application; Pixellot's process is lighter
   (account-manager-mediated registration, no NDA/tier found); Hudl, Reeplayer, Staige, Reolink,
   and UniFi Protect have no documented formal partner-contract process found for this use case.

**Concrete integration shape, for context on items 1–2 above:** Family 1 needs the booking's
time window pushed to the camera platform up front (as a scheduled "event"), then a webhook tells
you when the recording/highlight is ready and where to get it. Family 2 lets you look up the time
range after the fact — search recordings by camera + time range, then call an export/download
operation — but the app has to reach the venue's on-site device (usually via a vendor cloud relay
or a venue-run bridge/VPN, since a Vercel-hosted app can't assume a public IP into the venue's LAN)
and then store the resulting file itself.

**Which family is favored (not a numbered ticket question, but the map needs an answer):**
Family 1 (sports-camera cloud platforms) fits this app's shape better — internet-reachable by
default, no video storage burden on this app, and the recording window is defined up front so
clock drift isn't a real risk. Family 2 (general CCTV/ONVIF) is the cheaper, commodity-hardware
option already common at Vietnamese venues, but it pushes the reachability, clock-trust, and
video-storage problems onto this app's own integration work.
