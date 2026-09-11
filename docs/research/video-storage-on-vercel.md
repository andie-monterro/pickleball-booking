# Video Storage and Processing Cost on the Vercel Stack

This note answers Linear ticket [AND-110](https://linear.app/andie-monterro/issue/AND-110/find-out-what-it-costs-to-store-and-serve-one-video-per-booking-on-the): on the stack fixed by [ADR-0002](../adr/0002-nextjs-vercel-neon-stack.md) (Next.js on Vercel, Postgres on Neon), what does it cost, and what does it take, to hold one video per played Booking and serve it back to the one Booker who played it. It is a fact-gathering note. The decision about where clips actually live and what produces them is a separate ticket (see [AND-106](https://linear.app/andie-monterro/issue/AND-106/wayfinder-map-play-session-clip-a-booker-gets-something-they-can-post)), gated on the venue's tech lead. Nothing here is a recommendation.

## Note on method

Every pricing and limits claim below carries an inline `(Source: URL)`. Vercel figures come from `vercel.com/docs` pages fetched directly in this session (September 2026) — not from training-data memory, since the ticket flagged that these numbers moved recently. Third-party pricing (AWS S3, Cloudflare R2/Stream, Backblaze B2, Mux) is fetched from each vendor's own pricing page where a fetch succeeded; where a page returned a JS shell instead of the pricing table, that is stated as a **Gap** and the number is instead sourced from secondary aggregators with an explicit "unverified, confirm before deciding" flag. Nothing is asserted from memory. The **Not yet specified** section of AND-106 says the camera-footage size research had not reported at the time of writing, so the arithmetic in §2 is worked for a range — 1, 3, and 8 GB per hour of footage — per the ticket's own instruction.

The venue has not published a fixed Court count or opening-hours figure anywhere in the repo (`CONTEXT.md`, ADRs, migrations). §2 states the assumptions it used plainly, as inputs to a formula, so the retention ticket can re-run the arithmetic once real numbers exist.

---

## 1. What Vercel offers, and the realistic alternatives

### Vercel Blob

- A managed object store with **public** and **private** access stores. Private Blob requires authentication on every read and write; public Blob is served directly by the CDN with no auth. (Source: https://vercel.com/docs/vercel-blob/private-storage, https://vercel.com/docs/vercel-blob/public-storage)
- **Size limit**: maximum file size is **5 TB**; files larger than 100 MB should use multipart upload. (Source: https://vercel.com/docs/vercel-blob/usage-and-pricing)
- **Cache limit**: any blob over **512 MB** is never cached at the edge — every access is a cache MISS, which is the expensive path (below). A hi-def hour of court footage (1–8 GB) is always over this line. (Source: https://vercel.com/docs/vercel-blob/usage-and-pricing)
- **Pricing** (Singapore / `sin1`, the region Neon already runs in per ADR-0002): Storage **$0.025/GB-month**, Blob Data Transfer **$0.053/GB**, Simple Operations (cache-hit reads, `head()`) **$0.40/1M**, Advanced Operations (`put()`, `copy()`, `list()`) **$5.00/1M**; `del()` is free. (Source: https://vercel.com/docs/pricing/regional-pricing/sin1, https://vercel.com/docs/vercel-blob/usage-and-pricing)
- **The private-blob catch**: serving a private blob through a Function costs more than the headline Blob Data Transfer rate, because the request crosses two hops. Vercel's own docs: *"Your Function fetches the blob from the store, then streams it to the browser... you pay Blob Data Transfer + Fast Origin Transfer on cache miss for the Function-to-store fetch, plus Fast Data Transfer + Fast Origin Transfer for the Function-to-browser response."* In `sin1` that's $0.053 (BDT) + $0.27 (FOT) + $0.16 (FDT) + $0.27 (FOT again) = **≈$0.75/GB delivered** if the video is relayed through a Function. (Source: https://vercel.com/docs/vercel-blob/usage-and-pricing, https://vercel.com/docs/vercel-blob/private-storage, https://vercel.com/docs/pricing/regional-pricing/sin1)
- **The fix**: Blob supports **presigned URLs** (`presignUrl()`) that let the authenticated browser fetch directly from the blob store, skipping the Function relay entirely. That drops the cost back to the single-hop rate — BDT + one FOT ≈ **$0.32/GB** in `sin1` — the same shape as public-blob delivery. (Source: https://vercel.com/docs/vercel-blob/vercel-signed-urls) This is the pattern §5 recommends if Blob is the eventual choice.
- Vercel's own guidance: *"We do not recommend serving files larger than 100 MB through private Blob stores unless traffic is low."* (Source: https://vercel.com/docs/vercel-blob/private-storage) A play-session clip is a large file, but by AND-106's decision 2 it is genuinely low-traffic — exactly one Booker, viewing it a handful of times — so this caveat is a caution, not a disqualifier.

### The alternatives, including egress

| Option | Storage | Egress (the surprise) | Notes |
|---|---|---|---|
| **Vercel Blob** (private, presigned URL) | $0.025/GB-mo | ≈$0.32/GB | sin1 rates above |
| **Amazon S3** (Standard, ap-southeast-1) | ≈$0.025/GB-mo *(approximate — see Gaps)* | ≈$0.12/GB *(approximate — see Gaps)* | Native Lifecycle rules auto-expire objects (Source: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html) |
| **Cloudflare R2** | $0.015/GB-mo (Source: https://developers.cloudflare.com/r2/pricing/) | **$0** — R2 charges no egress at all (Source: https://developers.cloudflare.com/r2/pricing/) | Class A ops $4.50/1M, Class B $0.36/1M; native Object Lifecycle Rules (Source: https://developers.cloudflare.com/r2/buckets/object-lifecycles/) |
| **Backblaze B2** | $6.95/TB-mo ≈ $0.00695/GB-mo (Source: https://www.backblaze.com/cloud-storage/pricing) | Free up to **3× the average amount stored that month**, then $0.01/GB (Source: https://www.backblaze.com/cloud-storage/pricing) | Cheapest raw storage of the object stores; the free-egress multiple is pegged to *how much you store*, which matters at short retention (§2) |
| **Mux Video** | $0.0024/min stored-mo (720p) (Source: https://www.mux.com/pricing) | $0.0008/min delivered (720p), **first 100,000 delivered minutes/month free** (Source: https://www.mux.com/pricing) | Also charges **encoding**, $0.025/min ingested at "Plus" 720p (Source: https://www.mux.com/pricing) — billed per minute of video, not per GB |
| **Cloudflare Stream** | $0.005/min stored-mo, prepaid in $5/1,000-min blocks (Source: https://developers.cloudflare.com/stream/pricing/) | $0.001/min delivered, no free tier found on the pricing page | Also billed per minute, not per GB |

The two managed-video rows (Mux, Cloudflare Stream) don't bill by GB at all — their cost is driven by clip **count × duration**, not by the footage bitrate. That is why §2's 1/3/8 GB-per-hour range only moves the object-storage rows; Mux and Cloudflare Stream cost the same regardless of which end of that range the camera turns out to produce.

---

## 2. The arithmetic for this venue

### Assumptions (not sourced facts — plug in real numbers when they exist)

No Court count or opening-hours figure exists anywhere in the repo today. The model below uses a placeholder "handful of Courts, open most of the day" reading and shows its formula so it can be re-run:

| Input | Value used | Basis |
|---|---|---|
| Courts | 4 | "a handful," per the ticket wording — placeholder |
| Opening hours/day | 12 | placeholder (e.g. 07:00–19:00) |
| Utilization (booked share of Slots) | 70% | placeholder, a plausible busy-venue planning figure |
| Average Booking length | 1 hour (1 Slot) | a Booking is 1–2 Slots per `CONTEXT.md`; 2-Slot Bookings roughly double the clip size for that Booking |
| Footage size per hour of source video | **1 GB / 3 GB / 8 GB** | the range the ticket asks for, since the camera-footage sibling research had not reported |

From these: **played clips/day ≈ 4 × 12 × 0.70 = 33.6**, so **≈1,008 clips/month** (30-day month). Monthly egress (one download per clip — Booker opens their library once per clip, per AND-106 decision 6) is therefore **1,008 × size-per-hour GB**, independent of retention. Storage at steady state is **clips/day × retention-days × size-per-hour GB** (7-day, 30-day) or **clips/day × 365 × size** as an illustrative snapshot for "unlimited" (which never stops growing — that is the point of the unlimited column).

### Monthly cost — 1 GB/hour footage

| Backend | 7-day retention | 30-day retention | Unlimited (12-mo snapshot, still growing) |
|---|---:|---:|---:|
| Vercel Blob (presigned URL) | $332 | $351 | $632 |
| Vercel Blob (relayed through a Function) | $765 | $784 | $1,066 |
| Amazon S3 (ap-southeast-1, approx.) | $127 | $146 | $428 |
| Cloudflare R2 | **$3.53** | **$15** | **$184** |
| Backblaze B2 | $4.66 | $7.01 | $85 |
| Mux (encoding + storage; delivery free under 100K min/mo) | $1,546 | $1,657 | $3,278 |
| Cloudflare Stream | $131 | $363 | $3,740 |

### Monthly cost — 3 GB/hour footage

| Backend | 7-day | 30-day | Unlimited (12-mo snapshot) |
|---|---:|---:|---:|
| Vercel Blob (presigned URL) | $994 | $1,052 | $1,897 |
| Vercel Blob (relayed through a Function) | $2,295 | $2,353 | $3,197 |
| Amazon S3 (approx.) | $381 | $439 | $1,283 |
| Cloudflare R2 | **$10.59** | **$45** | **$552** |
| Backblaze B2 | $13.97 | $21.02 | $256 |
| Mux | $1,546 | $1,657 | $3,278 |
| Cloudflare Stream | $131 | $363 | $3,740 |

### Monthly cost — 8 GB/hour footage

| Backend | 7-day | 30-day | Unlimited (12-mo snapshot) |
|---|---:|---:|---:|
| Vercel Blob (presigned URL) | $2,652 | $2,806 | $5,058 |
| Vercel Blob (relayed through a Function) | $6,119 | $6,274 | $8,525 |
| Amazon S3 (approx.) | $1,015 | $1,169 | $3,421 |
| Cloudflare R2 | **$28.23** | **$121** | **$1,472** |
| Backblaze B2 | $37.26 | $56.04 | $682 |
| Mux | $1,546 | $1,657 | $3,278 |
| Cloudflare Stream | $131 | $363 | $3,740 |

**Reading this table:** Mux and Cloudflare Stream don't move between the three tables — they bill per minute of clip, not per GB, so a heavier camera doesn't cost them more (it also means they can't get cheaper if the footage turns out to be small). Every object-storage row scales roughly linearly with the GB-per-hour figure. The gap between Cloudflare R2/Backblaze B2 and everything else is almost entirely egress pricing — R2 charges none at all, and B2's free egress allowance (3× what you're storing) comfortably covers a single-viewer-per-clip access pattern except at very short retention windows, where the free allowance (pegged to the small amount currently stored) is thin relative to the month's total egress — hence B2 shows a small overage charge in the 7-day column that disappears at 30-day and unlimited retention.

Vercel Blob is workable but not cheap unless the app serves it via a presigned URL rather than relaying bytes through a Function (§5) — the naive relay pattern roughly costs +130%.

---

## 3. Can a Vercel Function trim or transcode an hour of source video?

**Current limits** (Fluid Compute, which is on by default for new projects) (Source: https://vercel.com/docs/functions/limitations, https://vercel.com/docs/fluid-compute):

| Limit | Hobby | Pro / Enterprise |
|---|---|---|
| Max duration (default / max / extended-beta) | 300s / 300s / — | 300s / 800s / 1800s (30 min, beta) |
| Package size (standard / "Large Functions" beta) | 250 MB / 5 GB | 250 MB / 5 GB |
| Memory (default / max) | 2 GB / 2 GB | 2 GB / 4 GB |
| Request/response body | 4.5 MB | 4.5 MB |
| Billing | Active CPU (only while code executes) + Provisioned Memory (whole instance lifetime) | same |

The 5 GB package size is for the **deployed bundle** (code, a static `ffmpeg` binary, model files) — it is not the working space for the video itself, which is downloaded at request time, not shipped in the deployment. This session's fetches of Vercel's docs did not turn up a stated `/tmp` or ephemeral-disk size for a standard Function invocation — flagged as a **Gap** below.

**Where it's practical, and where it falls over:**

- **A pure trim (no re-encode)** — cutting the file at existing keyframes with something like `ffmpeg -c copy` — is CPU-cheap (little more than reading and rewriting a container), so it plausibly finishes in low tens of seconds of Active CPU even for an hour-long file, comfortably inside the 300s default. This is the practical case for "give the Booker just their Booking's Slots out of a longer recording."
- **A re-encode** (needed if cuts don't land on keyframes, or the output needs a different bitrate/format for sharing) is a different story. Software x264 encoding throughput is commonly reported in the low single-digit multiple of real time on a single vCPU depending on resolution/preset — meaning an hour of 720p footage could plausibly take somewhere from ~15 minutes to over an hour of serial CPU time to re-encode. That is past the 300s default, likely past the 800s Pro maximum, and only fits inside the 1800s (30-minute) **beta** extended maximum if the encode is fast enough — and Active CPU billing then adds up for real (Active CPU is charged in CPU-hours; at Singapore's $0.160/Active-CPU-hour (Source: https://vercel.com/docs/functions/usage-and-pricing) even 20 minutes of CPU is only ≈$0.05, so the money is not the constraint — the wall-clock ceiling is).
- **Before any of that runs**, the function has to get the 1–8 GB source file from wherever the camera system dropped it. Downloading that inside the same invocation eats into the same duration budget, and (per the Gap above) may or may not fit in the function's writable disk — this is the first thing to nail down experimentally if a Function-based trim is seriously considered.

**Bottom line for Q3**: trimming without re-encoding looks genuinely practical inside a normal Function today. Transcoding an hour-long file is no longer flatly impossible the way it was pre-Fluid, but it is close to the edge of the current limits (duration especially), and depends on details (resolution, encode preset, whether cuts need re-encoding at all) this ticket cannot pin down without the camera-footage research.

---

## 4. Platform-native alternatives if a Function can't do it

| Option | What it is | Implication for ADR-0002 |
|---|---|---|
| **Vercel Sandbox** | Isolated Linux microVMs, up to 24-hour sessions on Pro (vs. a Function's 800s/1800s), up to 8 vCPU / 16 GB on Pro. Billed Active CPU $0.128/hr + Provisioned Memory $0.0212/GB-hr + Data Transfer $0.15/GB out (downloads from the internet are free) in `iad1` (Source: https://vercel.com/docs/sandbox/pricing). No duration wall anywhere near a Function's. | Still a first-party Vercel product — no new vendor, no new env vars — but it is a different primitive than "Vercel Functions," which is the specific thing ADR-0002 names. Adopting it is a small, explicit addendum to the ADR, not a silent fit. |
| **Queue + worker** (Vercel Queues, `@vercel/queue`, a subscriber Function) | Decouples "a clip needs trimming" from the user's request — the Booker isn't kept waiting on an HTTP response while ffmpeg runs. (Source: https://vercel.com/docs/queues/sdk, https://vercel.com/docs/queues/concepts) | Stays fully inside Vercel/Next.js. But the **worker function itself is still a Vercel Function**, bound by the same duration/package/CPU limits in §3 — queueing solves "don't block the request," not "the encode is too big for a Function." |
| **Managed video service doing the trim at ingest** (Mux, Cloudflare Stream) | The vendor's own pipeline receives the raw footage and produces the trimmed/encoded asset; the app never runs ffmpeg itself. | This is infrastructure **outside** ADR-0002's stack — a new vendor, a new API key, typically a webhook callback the app must receive. Per AND-106's explicit instruction, this must be surfaced as an ADR-0002 conflict, not routed around quietly. |

---

## 5. Serving a private video to exactly one signed-in Booker

- **Access control belongs in the route handler, not middleware.** Vercel's own private-storage guidance: verify auth "directly in your route handler, right next to the `get()` call" rather than relying on middleware, because a middleware bug could expose cached private content to the wrong request. (Source: https://vercel.com/docs/vercel-blob/private-storage)
- **Signed URLs / expiry**: Vercel Blob's `presignUrl()` signs a specific operation (`get`, `head`, `put`, `delete`) into a URL scoped to one pathname, with an optional `validUntil` timestamp shorter than the token's own expiry — the standard shape of "this Booker, this clip, until this time." (Source: https://vercel.com/docs/vercel-blob/vercel-signed-urls) The equivalent on S3/R2/B2 is a presigned URL via the S3-compatible API; on Mux/Cloudflare Stream it's a signed playback URL/token issued per viewer.
- **CDN caching**: Vercel explicitly recommends **against** letting a CDN cache a private blob response (no `s-maxage`) — `Cache-Control: private, no-cache` (browser-only cache, revalidated every time) or `private, no-store` (nothing cached at all) is the recommended header for sensitive content. (Source: https://vercel.com/docs/vercel-blob/private-storage) A single-viewer clip is exactly this case: it should not sit in a shared edge cache where a cache-key mistake could serve it to someone else.
- **Range requests / seeking**: this session's Vercel-docs fetches did not turn up an explicit statement of byte-range support for Blob's `get()` or presigned URLs — flagged as a **Gap**. S3, R2, and B2 all expose the standard S3 API, which supports HTTP Range requests as a matter of course; Mux and Cloudflare Stream serve adaptive HLS/DASH, which is built around seeking. If scrubbing through the clip matters to the product and Blob is the eventual choice, confirm range-request behavior before relying on it.

---

## 6. What enforces deletion at expiry

| Backend | Native expiry? |
|---|---|
| Vercel Blob | No native TTL found in the docs fetched this session. The app needs a scheduled job (a Vercel Cron Job hitting a route) that lists blobs past retention and calls `del()` — which is free. (Source: https://vercel.com/docs/vercel-blob/usage-and-pricing) |
| Amazon S3 | Yes — bucket **Lifecycle rules** expire objects N days after creation automatically, no application code. Deletion is asynchronous (can lag a day or two). (Source: https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html) |
| Cloudflare R2 | Yes — **Object Lifecycle Rules**, configurable via dashboard, Wrangler, or the S3 API; objects typically removed within 24 hours of eligibility. (Source: https://developers.cloudflare.com/r2/buckets/object-lifecycles/) |
| Backblaze B2 | B2 also documents file-version Lifecycle Rules; this session did not re-fetch B2's own lifecycle docs in detail, so treat the exact rule semantics as needing a quick confirm before relying on them. |
| Mux / Cloudflare Stream | No automatic TTL-based expiry surfaced in the pricing pages fetched — deleting an aged-out asset looks like it needs an explicit API call on a schedule either way. Flagged as a **Gap**; would need a dedicated docs pass if either is seriously considered. |

So: pick a storage backend with native Lifecycle rules (S3, R2, and apparently B2) and deletion is the platform's problem. Pick Vercel Blob, Mux, or Cloudflare Stream and the app needs its own scheduled deletion job regardless of which one is chosen.

---

## 7. Does any of this need a row in Postgres?

Not necessarily, if the storage side is a plain object store: a naming convention of `<booking-id>.mp4` (or similar) lets the app address a clip purely by the Booking's own id, with no new table. The object store's own upload timestamp (Blob's `uploadedAt` from `list()`, S3's `LastModified`, R2/B2 equivalents) is enough to know an object's age for retention purposes — Lifecycle rules key off exactly that metadata, not a Postgres column.

A Postgres row (or at minimum a column on an existing table) starts earning its keep in two situations, neither of which is required by the storage choice alone:

1. **Async processing state.** If trimming happens off the request path (a queue worker, or a managed-ingest webhook), the Booker's clip-library screen needs to show "processing" vs. "ready" vs. "failed" — that state has to live somewhere, and a naming-convention-only object store doesn't naturally expose it (though a bare "does the object exist yet" check gets partway there).
2. **A vendor-assigned asset id.** Mux and Cloudflare Stream mint their own asset/video IDs that are not the Booking id — using either means storing a `booking_id → external_asset_id` mapping somewhere, which is exactly what a Postgres row is for. A plain object store under the app's own naming convention avoids this entirely.

Auth doesn't force a new row either way: verifying "is this signed-in Player the Booking's Booker" reuses the Booking → Booker relationship that already exists in Postgres today — nothing new to model there.

---

## Gaps

- **S3 ap-southeast-1 exact rates.** `aws.amazon.com/s3/pricing` renders its region-specific tables via JavaScript and returned only a shell to this session's fetch. The $0.025/GB-month storage and $0.12/GB egress figures used in §2 are a synthesis from secondary sources (search results), not a page this session read directly. Confirm via the AWS Pricing Calculator before treating the S3 numbers as more than a planning estimate.
- **Vercel Function `/tmp` / ephemeral disk size.** Not found in the Functions limits or advanced-configuration pages fetched this session. This matters directly for whether an 8 GB source file can even be downloaded into a Function for processing (§3).
- **Vercel Blob range-request (byte-range) support.** Not explicitly confirmed either way in the private-storage or SDK docs fetched (§5).
- **Backblaze B2 Lifecycle Rule semantics.** Existence is well known but this session did not re-fetch B2's own lifecycle docs to confirm exact configuration and timing, unlike S3 and R2 which were directly confirmed.
- **Mux / Cloudflare Stream automatic expiry.** No TTL-based auto-delete found on either pricing page; likely needs an explicit delete call on a schedule, but neither vendor's asset-management docs were fetched to confirm.
- **ffmpeg re-encode throughput numbers in §3** are general, widely-reported ffmpeg benchmarks, not a Vercel-specific or freshly-sourced figure — treated as an estimate, not a citation.

## Env vars named (no locations)

`BLOB_READ_WRITE_TOKEN`, `VERCEL_OIDC_TOKEN`, `CRON_SECRET` — Vercel Blob and Cron Job auth, referenced above. Per house rule, nothing here says where any key is stored.
