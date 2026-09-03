# How comparable apps let matched strangers reach each other afterward

This note answers a narrower question than the earlier survey: once two strangers are
matched onto the same court or game by an app, how do they actually communicate with
each other — text, voice, video, or a bare phone-number reveal — and what do these apps
deliberately leave out (persistent inboxes, calling, phone-number display)? It
complements `docs/research/open-match-conventions.md` and does not repeat that
document's ground (join mechanics, no-show/cancellation consequences, spot-lifecycle,
whole-booking cancellation, discovery, or level/rating gating). Where the earlier survey's
thin "what co-players see about each other" subsection already made a claim relevant to
contact channels, this note goes deeper on it rather than restating it.

Each app section below answers, in order: (1) contact channel, (2) scope (per-match vs.
global), (3) lifecycle (does the channel close/archive/persist), (4) safety controls
(block/report/mute), and (5) phone-number visibility. A dedicated section afterward
covers the specific hunt for any app that used to offer in-app voice/video calling
between matched players and later dropped it. Every claim is cited inline. Where a
help-center page could not be fetched directly because of Cloudflare/bot protection, the
citation notes that the text was recovered either from the article's own text as surfaced
by search indexing, or via a read-only text-extraction proxy — both are flagged
explicitly, distinguishing them from a direct fetch. Where nothing citable was found, this
is stated as "not documented publicly" rather than guessed.

## Playtomic

Playtomic documents three distinct, separately named contact channels rather than one.

1. **Contact channel.** In-app text chat, in three separate forms — no voice or video
   calling is mentioned anywhere in Playtomic's own documentation. First, a persistent
   1:1 "Message" button appears on any player's public profile
   ([Private chat between players in Playtomic](https://playerhelp.playtomic.com/hc/en-gb/articles/19832055834769-Private-chat-between-players-in-Playtomic) — direct fetch returned HTTP 403;
   text below recovered via a read-only proxy fetch of the same URL). Second, a
   match-scoped public chat lets a player "chat with the rest of the players registered
   for a Match or Tournament without leaving the application," and notably "it is not
   necessary that you have booked your spot in a Match to access the Chat" — anyone can
   read/post in a match's chat even before confirming they're playing
   ([How you can chat with players in Matches or Tournaments](https://playerhelp.playtomic.com/hc/en-gb/articles/19832063135249-How-you-can-chat-with-players-in-Matches-or-Tournaments) — direct fetch also
   returned HTTP 403 and the proxy fetch was blocked too, so this quote is drawn from the
   article's own text as surfaced by search indexing, not a direct or proxied fetch).
   Third, a player can create their own standing chat group of up to 200 people, shared
   by invite link ([How to create a chat group](https://playerhelp.playtomic.com/hc/en-gb/articles/19831494082705-How-to-create-a-chat-group) — via search indexing).
2. **Scope.** Genuinely mixed, and this is Playtomic's most distinctive design choice
   among the apps surveyed: the match/tournament chat is explicitly per-match (scoped to
   that one activity's registered players, described as "public" within it and
   "supervised by both the Club and a member of the Playtomic support team"), while the
   1:1 "Message" channel is global and persistent — it exists between two players'
   profiles independent of any specific match, gated only on the other player having a
   public profile ([How you can chat with players in Matches or Tournaments](https://playerhelp.playtomic.com/hc/en-gb/articles/19832063135249-How-you-can-chat-with-players-in-Matches-or-Tournaments) via search
   indexing; [Private chat between players in Playtomic](https://playerhelp.playtomic.com/hc/en-gb/articles/19832055834769-Private-chat-between-players-in-Playtomic) via proxy fetch).
3. **Lifecycle.** Not documented publicly for the match-scoped chat — no source states
   whether it closes, goes read-only, or stays open indefinitely once the match ends. For
   the persistent 1:1 chat and the user-created chat groups, nothing suggests any closure
   at all; they are designed to persist. Separately, Playtomic's privacy policy states
   personal data tied to matches, tournaments, and "a group chat related to the match" is
   retained for "10 years from the last access" under a contract-execution legal basis —
   a data-retention figure, not a stated UI lifecycle, but the only concrete number found
   for how long chat-adjacent data survives ([Privacy Policy](https://playtomic.com/privacy-policy)).
4. **Safety controls.** Documented and specific. A player can mute or block a chat from
   the three-dot menu inside that chat, or block/report a player from their profile's
   three-dot menu — block for "prevent[ing] any future interactions with this player,"
   report for when "the player's behavior violates our community standards"
   ([How to block and/or report a Player](https://playerhelp.playtomic.com/hc/en-gb/articles/19831797811729-How-to-block-and-or-report-a-Player) — direct fetch returned HTTP 403; recovered via a
   read-only proxy fetch). Blocking has a documented cross-feature effect confirmed by two
   independent proxy fetches of the same article: "if someone in an Open Match has
   blocked a player, that blocked player will not be able to join the match," and the
   article extends this to Open Matches, Private Bookings, and Community Matches alike —
   i.e., blocking someone also prevents future co-presence in a match together, not just
   chat. (One earlier web-search-engine summary of this same article claimed the opposite
   — that blocking "does not affect open matches" — but the two direct proxy-fetch quotes
   of the article's own text disagree with that summary; this note follows the two
   consistent proxy-fetched quotes over the single conflicting search-engine
   paraphrase.) Blocked/unblocked accounts are managed from Settings → Privacy → Blocked
   accounts ([How to block and/or report a Player](https://playerhelp.playtomic.com/hc/en-gb/articles/19831797811729-How-to-block-and-or-report-a-Player), via proxy fetch).
5. **Phone number visibility.** Confirmed shown, and confirmed by Playtomic's own privacy
   policy rather than inferred: "In public activities, the phone number of the organizer
   will be shared with people enrolled in the specific activity," and separately, in the
   context of "Providing a group chat related to the match," phone number is listed among
   the data categories shared with the group under a contract-execution legal basis
   ([Privacy Policy](https://playtomic.com/privacy-policy)). This is the only app in this survey whose own
   privacy policy explicitly names phone-number sharing with other players as a stated
   processing purpose, rather than leaving the question undocumented.

## MATCHi

MATCHi's own Zendesk help center describes a real in-app chat system distinct from the
"just put your contact details in the join-request message" pattern that the earlier
survey's shallow pass surfaced from the Public Matches Q&A alone.

1. **Contact channel.** In-app text chat and DMs — no voice or video calling is mentioned
   in any MATCHi documentation found. Before a join request is accepted, contact is
   explicitly manual: MATCHi's own guidance to a requester is to "write a message to the
   booker" and that "it's good to include your contact details" in it
   ([Public Matches Q&A](https://matchiplayers.zendesk.com/hc/en-gb/articles/21818109944221-Public-Matches-Q-A) — direct fetch returned HTTP 403; text as surfaced by search
   indexing). Once players are confirmed, MATCHi's dedicated "Chat & messages" article
   describes a real chat system: "a match chat can only start once there are at least
   two confirmed participants," and separately, "players with public profiles" can start
   a private one-to-one direct message with each other "without an active booking"
   ([Chat & messages](https://matchiplayers.zendesk.com/hc/en-gb/articles/30063520683165-Chat-messages) — direct fetch returned HTTP 403; text recovered via a read-only
   proxy fetch of the same URL).
2. **Scope.** Both forms exist side by side, the same split as Playtomic: match chats are
   explicitly per-match ("a match chat can only start once there are at least two
   confirmed participants," tied to that specific booking), while direct messages are a
   global, persistent 1:1 thread — MATCHi's own article states "the system maintains only
   one conversation thread per player pair," i.e. a single standing DM thread between two
   players regardless of how many matches they've played together
   ([Chat & messages](https://matchiplayers.zendesk.com/hc/en-gb/articles/30063520683165-Chat-messages), via proxy fetch).
3. **Lifecycle.** Documented with a specific number, unusually so among the apps
   surveyed: "chats (match chats and DMs) remain accessible for 6 months after the last
   message was sent" ([Chat & messages](https://matchiplayers.zendesk.com/hc/en-gb/articles/30063520683165-Chat-messages), via proxy fetch and via search indexing).
   MATCHi's own privacy policy independently confirms the same figure as a data-retention
   rule rather than a UI description: "Chat messages between you and others are generally
   erased 6 months after the last interaction" ([MATCHi Privacy Policy (PDF, 24 Feb 2025)](https://matchi-assets-prod.s3.eu-west-1.amazonaws.com/terms/matchi_privacy_policy_2025_02_24.pdf), fetched
   directly and confirmed by local text extraction). So the channel does not close at
   match end — it persists and is erased only after 6 months of inactivity, whichever
   match it came from.
4. **Safety controls.** Block, and a lighter-touch leave option, are both documented.
   Blocking "removes them from your friends list and hides your profile from them,
   prevents them from sending you new DMs, and deletes the DM history between you and
   that user" — but, unlike Playtomic, MATCHi's own text states this "doesn't affect
   existing match chat participation," so a blocked player can still be in the same match
   chat as you ([Chat & messages](https://matchiplayers.zendesk.com/hc/en-gb/articles/30063520683165-Chat-messages), via proxy fetch and search indexing).
   Separately, MATCHi's privacy policy frames chat participation itself as opt-out at
   will: "it is optional to use any chat or similar and if you do not wish for us to
   process your messages you may abstain from using such features. You may also leave a
   chat at any time" ([MATCHi Privacy Policy (PDF, 24 Feb 2025)](https://matchi-assets-prod.s3.eu-west-1.amazonaws.com/terms/matchi_privacy_policy_2025_02_24.pdf)). No dedicated
   "report a player" article was found in the fetched MATCHi help-center content — this
   is a documentation gap, not a confirmed absence of the feature.
5. **Phone number visibility.** Mixed and context-dependent, per MATCHi's own privacy
   policy. For the separate Padelboard competition-administration app layered on top of
   MATCHi, the policy explicitly states that "contact information such as phone number
   and e-mail" is processed to "provide you with the means to contact other participants
   in the same competition as yourself" — i.e., confirmed shown, but only in that
   competition/Padelboard context ([MATCHi Privacy Policy (PDF, 24 Feb 2025)](https://matchi-assets-prod.s3.eu-west-1.amazonaws.com/terms/matchi_privacy_policy_2025_02_24.pdf)). For
   ordinary Public Matches and the main chat/DM feature, no source states that a real
   phone number is displayed to the other player through the app — communication there
   happens through MATCHi's own chat, which the policy separately notes runs on "a third
   party supplier to operate our chat function" rather than a number reveal. Whether phone
   numbers are shown specifically in that ordinary chat/booking context is not documented
   either way beyond the Padelboard case already cited.

## Padel Mates

Padel Mates has the thinnest public documentation of the apps surveyed; nearly everything
findable is marketing copy (App Store/Google Play listings) rather than support articles,
and this is flagged throughout.

1. **Contact channel.** In-app text chat only, per the app's own store description:
   "Chat with fellow padel mates and stay connected within the app"
   ([Padel Mates App - App Store](https://apps.apple.com/us/app/padel-mates/id1531797995)). No voice or video calling is mentioned in any
   source found. No dedicated help-center article describing how this chat works was
   found — the app's own help-center page returned no crawlable content.
2. **Scope.** Not documented publicly. No source states whether the chat is a per-match
   thread, a global inbox between two players, or a general community/club-wide chat —
   the marketing copy above is the only mention found and it does not specify.
3. **Lifecycle.** Not documented publicly.
4. **Safety controls.** Report and block exist, per a third-party app-index aggregator
   describing the app's features, but no first-party help article or store-listing text
   naming these specific controls was found in the sources reachable — flag as
   **secondary/unverified**, not confirmed by Padel Mates' own documentation.
5. **Phone number visibility.** Not documented publicly either way. Padel Mates' Google
   Play "Data safety" disclosure confirms the app collects the user's own phone number for
   "app functionality" and separately states "the developer says this app doesn't share
   user data with other companies or organizations" ([Padel Mates - Data safety, Google Play](https://play.google.com/store/apps/datasafety?id=com.padelmates&hl=en_US)) —
   this speaks to sharing with third-party companies, not to whether one player's phone
   number is ever displayed to another player inside the app, which remains undocumented.

## Meetup

Meetup is the generic, non-court-specific baseline. It has no single "match," so its
message channel is scoped to a group/event context rather than a specific booking, and
its safety tooling is the most extensively documented of any app in this survey.

1. **Contact channel.** In-app text messaging only — no voice or video calling, and no
   phone-number reveal, is described anywhere in Meetup's help center. Direct
   member-to-member messaging requires a Meetup+ or Standard/Pro Organizer subscription;
   any member (subscribed or not) can message a group's organizer as long as the
   organizer hasn't disabled receiving messages ([Contacting other members and organizers](https://help.meetup.com/hc/en-us/articles/360002880111-Contacting-other-members-and-organizers) —
   direct fetch returned HTTP 403; text recovered via a read-only proxy fetch of the same
   URL).
2. **Scope.** Global, not match/event-specific. Meetup's messaging is a standing
   member-to-member or member-to-organizer thread tied to the group relationship, not a
   thread scoped to one RSVP'd event ([Contacting other members and organizers](https://help.meetup.com/hc/en-us/articles/360002880111-Contacting-other-members-and-organizers), via
   proxy fetch).
3. **Lifecycle.** No closure at all — chats persist as ordinary conversations. The only
   documented state change is what blocking does to a thread (see below), not anything
   tied to an event ending.
4. **Safety controls.** The most thoroughly documented of any app surveyed here. Blocking
   a member means "they will no longer be able to contact you through messages," and "a
   person that you have blocked will not be able to see your profile details or send you
   any direct messages" regardless of their subscription tier; on desktop the resulting
   chat becomes "read-only" but stays visible in Active Chats, while on mobile it shows as
   "locked" with an Unblock option ([Block someone from contacting me](https://help.meetup.com/hc/en-us/articles/360001673431-Block-someone-from-contacting-me) — direct fetch
   returned HTTP 403; recovered via a read-only proxy fetch). A separate reporting flow
   covers spam, harassment, impersonation, and hate speech, with a documented per-surface
   Report button (on comments, messages, and member profiles) and a requirement to include
   the violating content's URL when filing ([Reporting spam, inappropriate content or activity](https://help.meetup.com/hc/en-us/articles/360001673551-Reporting-spam-inappropriate-content-or-activity) — direct
   fetch returned HTTP 403; recovered via a read-only proxy fetch).
5. **Phone number visibility.** Not documented as shown. Meetup's own usage policy
   classifies phone numbers as private information and prohibits posting another member's
   private information without consent — language that presumes the platform itself is
   not the one surfacing a phone number, though no article states in so many words that
   Meetup never displays one. This mirrors the confirmed policy already on record for
   email addresses (a member's email is never shown on their public profile), but for
   phone numbers specifically the confirmation is weaker — inferred from the
   private-information rule rather than a direct "we never show this" statement.

## PicklePlay

PicklePlay's own dedicated help center (`help.pickleplay.com`) surfaces only
tournament-format articles (round robins, ladder leagues) in what is reachable by search
indexing — no Q&A article on chat, contact, or safety controls was found there. Nearly
everything below is therefore drawn from app-store listings (first-party, but marketing
copy) rather than support documentation, and is flagged accordingly.

1. **Contact channel.** In-app group text chat, scoped per game, per the app's own
   marketing copy: "each match includes an in-game group chat to coordinate warm-ups,
   court changes, and quick substitutions," and separately "built-in chat for every game
   and group, with no need for third-party apps" ([PicklePlay | Find Games. Play More.](https://www.thepickleplay.com/) and
   related product-site copy, via search indexing — no help-center article corroborating
   this was independently found). No voice or video calling is mentioned in any source
   found. Apple's own App Store content-rating disclosure for the app separately lists
   "Messaging and Chat" as content the app contains ([PicklePlay - Pickleball - App Store](https://apps.apple.com/us/app/pickleplay-pickleball/id6760355323), fetched
   directly).
2. **Scope.** Reads as per-game (a chat tied to that specific match/roster) based on the
   "each match includes an in-game group chat" description above, but no help-center
   article confirms this explicitly or says whether a separate global inbox between two
   specific players also exists — treat the per-game framing as the marketing
   description's own words, not an independently confirmed architecture.
3. **Lifecycle.** Not documented publicly. No source states whether a game's chat closes,
   archives, or stays open after the match concludes.
4. **Safety controls.** Not documented publicly in any help article or store listing
   found. The App Store's age-rating disclosure ("Messaging and Chat," "User-Generated
   Content") implies moderation exists in principle, but no article names a specific
   block, report, or mute control for PicklePlay's chat — this is a documentation gap,
   not a confirmed absence.
5. **Phone number visibility.** Not documented publicly either way.

## Pickleheads

Pickleheads has the most granular first-party documentation of chat scope of any app in
this survey, split explicitly into "group chat" and "session chat," described in its own
organizer tutorials.

1. **Contact channel.** In-app text chat only — no voice or video calling is mentioned in
   any Pickleheads documentation found. Pickleheads distinguishes two chat surfaces: a
   standing "group chat," and a "session chat" created automatically per event
   ([Get the most out of Pickleheads – Group and session chat](https://www.pickleheads.com/tutorials/watch/group-and-session-chat); [The Complete Guide to Pickleheads Groups](https://www.pickleheads.com/guides/complete-group-guide),
   both fetched directly). Its own product blog separately confirms a third surface,
   "Court Chat": following a court automatically adds a player to a group chat with other
   players who frequent that same venue, introduced in app version 1.0.25
   ([The Pickleheads mobile app is here!](https://news.joinpickleheads.com/p/pickleheads-mobile-app), fetched directly).
2. **Scope.** Explicitly both, by design, per Pickleheads' own guide: "Group Chat" is
   available to all members of a group for broad announcements (admins can restrict
   posting to admins-only), while "Session Chat" is "automatically created per event and
   limited to confirmed players for that specific session" — i.e. a genuinely per-match
   thread distinct from the group's standing chat ([The Complete Guide to Pickleheads Groups](https://www.pickleheads.com/guides/complete-group-guide), fetched
   directly). Court Chat is a third, venue-scoped tier — persistent and tied to a court
   rather than to any one game or any one pair of players
   ([The Pickleheads mobile app is here!](https://news.joinpickleheads.com/p/pickleheads-mobile-app)).
3. **Lifecycle.** Not documented publicly for session chat specifically — no source
   states whether it closes, archives, or goes read-only once that session's game has
   been played. Group chat and Court Chat are standing/persistent by design (no stated
   end condition).
4. **Safety controls.** Only mute is documented; no block or report control for
   player-to-player chat was found in any reachable Pickleheads help content. A chat
   member can "mute it in the app without leaving the group" to stop notifications while
   remaining in the group and still receiving session invites, and can leave a group
   entirely from its group-details screen ([The Complete Guide to Pickleheads Groups](https://www.pickleheads.com/guides/complete-group-guide), fetched
   directly). Pickleheads' own support page lists only "Report an Issue" (for app bugs),
   "Request a Feature," and "Submit a Court Edit" as reportable categories — no
   player-safety "report a user" or "block a user" article was found there
   ([Pickleheads Support](https://www.pickleheads.com/help) — direct fetch returned HTTP 403; article-title list
   recovered via a read-only proxy fetch of the same URL). This absence is a
   documentation gap in what's publicly reachable, not confirmed proof the feature
   doesn't exist.
5. **Phone number visibility.** Not confirmed either way by a support article. The app's
   Google Play "Data safety" disclosure states phone number and contacts are collected
   (both marked "Optional") for purposes including app functionality and personalization,
   but the same disclosure's list of data "shared with other companies or organizations"
   names only "User payment info" and "User IDs" — phone number is not listed there,
   which speaks to third-party sharing, not to whether it is shown to another Pickleheads
   player inside the app ([Pickleheads - Play Pickleball - Data safety, Google Play](https://play.google.com/store/apps/datasafety?id=com.pickleheads.mobile&hl=en_US)). Separately, the
   app's own onboarding copy mentions "tap into your phone contacts... to quickly invite
   your friends to play" ([The Pickleheads mobile app is here!](https://news.joinpickleheads.com/p/pickleheads-mobile-app)) — this is the user's own device contact
   list used for outbound invites, not another player's number being displayed back to
   them, and should not be conflated with phone-number reveal.

## DUPR

DUPR is a rating platform layered with community features rather than a booking app, and
its own documentation on contact mechanics is the thinnest of the pickleball-specific
apps surveyed.

1. **Contact channel.** In-app group messaging exists, per DUPR's own App Store
   disclosure, which lists "Messaging and Chat" among the app's content types alongside
   "Advertising" and "User-Generated Content" ([DUPR - App Store](https://apps.apple.com/bm/app/dupr/id1567932355), fetched directly).
   A 2023 feature update reportedly added "group messaging... designed to promote
   community and allow for better organized recreational play," attributed to DUPR
   leadership — this attribution comes from a pickleball news outlet's coverage rather
   than DUPR's own blog or app-store changelog, so it is flagged
   **secondary/unverified** for the specific framing, even though the underlying
   messaging feature itself is corroborated by DUPR's own App Store content disclosure
   ([DUPR App Releases New Version: Messaging, Match Impact & More](https://www.thedinkpickleball.com/dupr-app-new-version-2023/)). No voice or video
   calling is mentioned in any DUPR source found. DUPR's own community guidelines add one
   data point about contact happening outside the messaging feature too: they instruct
   players to "communicate with your partner beforehand" ([DUPR Community Guidelines](https://www.dupr.com/community-guidelines), fetched
   directly), which reads as advisory language rather than a description of an in-app
   channel.
2. **Scope.** Not documented publicly. No DUPR source found specifies whether group
   messaging is scoped to a specific match/event or is a persistent, general-purpose
   inbox between two players' profiles.
3. **Lifecycle.** Not documented publicly.
4. **Safety controls.** Report only, and even that is a generic conduct-report mechanism
   rather than a chat-specific tool. DUPR's community guidelines direct users to "report
   any violations to DUPR for investigation" through a dedicated form covering "racism,
   sexism, discrimination, abusive language, physical abuse, harassment, and any other
   behaviors detrimental to an individual or the event" ([DUPR Community Guidelines](https://www.dupr.com/community-guidelines), fetched
   directly). No block or mute feature for DUPR's own messaging was found documented
   anywhere reachable — a third-party scheduling tool that integrates with DUPR ratings
   has its own, unrelated "block a player from a session" admin feature gated by DUPR
   rating range, but that is that third-party tool's own access control, not a DUPR
   user-to-user block feature, and should not be conflated with one.
5. **Phone number visibility.** Not documented as shown to other players, and DUPR's
   privacy policy's only relevant statement points the other way — toward user-generated
   content in shared spaces generally, not phone numbers specifically: "If you post a
   message in a DUPR forum, chat room, message board, or other similar location, the
   information you post may be accessible to other users" ([Privacy Policy](https://www.dupr.com/privacy-policy), fetched
   directly). DUPR does collect the user's own phone number (for account/OTP purposes),
   but no source states that this number is ever surfaced to another player through the
   app.

## Apps that dropped in-app calling

No evidence was found, for any of the seven apps covered above, of in-app voice or video
calling between matched players ever having existed and later being removed. This was
checked specifically via each app's own App Store "What's New" / version-history listing
(Playtomic, MATCHi, Padel Mates, Pickleheads, PicklePlay, and DUPR were each fetched
directly from their Apple App Store listing and their full reachable version history
scanned for "call," "voice," or "video" — none surfaced any such entry: [Playtomic](https://apps.apple.com/us/app/playtomic-padel-pickleball/id1242321076), [MATCHi](https://apps.apple.com/us/app/matchi/id720782039), [Padel Mates](https://apps.apple.com/us/app/padel-mates/id1531797995), [Pickleheads](https://apps.apple.com/us/app/pickleheads-play-pickleball/id6448714446), [PicklePlay](https://apps.apple.com/us/app/pickleplay-pickleball/id6760355323), [DUPR](https://apps.apple.com/bm/app/dupr/id1567932355)),
and via web searches targeting each app by name plus "voice call," "video call," or
"removed feature," none of which returned any official blog post, changelog entry, or
help-center article describing such a feature or its removal for any of these seven apps.
Meetup was not separately checked for calling, since it was already established (above)
to be a text-messaging-only platform with no calling feature described anywhere in its
help center.

This is a clean negative result across every app in scope: every app surveyed either
never documented an in-app calling feature, or (Playtomic, MATCHi, Pickleheads,
PicklePlay, Padel Mates, DUPR) has always been text-chat-only as far as their own
documentation goes. No stated or inferable reason for a removal (abuse, low usage, cost,
safety incidents) could be found, because no removal was found to explain in the first
place. This absence should not be read as proof that no such feature or removal ever
existed anywhere in these companies' histories — only that no record of one surfaced in
the sources reachable for this survey (official blogs, help centers, and App Store
version histories).

## Comparison table

| App | Channel type | Scope (per-match/global) | Closes after match? | Safety controls | Phone number shown? |
|---|---|---|---|---|---|
| Playtomic | In-app text chat (3 forms: match-scoped public chat, persistent 1:1 message, persistent user-created groups) | Both — match chat is per-match; 1:1 message and groups are global/persistent | Not documented for match chat; 1:1 and groups persist by design; chat data retained 10 years per privacy policy | Mute/block a chat; block or report a player (blocking also blocks future co-participation in matches together) | **Confirmed shown** — privacy policy states organizer's phone number is shared with activity enrollees, and phone is listed as shared data for match group chat |
| MATCHi | In-app text chat: match chat (group) + 1:1 DM; manual contact-detail sharing via join-request message before that | Both — match chat is per-match; DM is one persistent global thread per player pair | Persists; erased only after 6 months of inactivity (documented in both help center and privacy policy) | Block (removes from friends list, blocks new DMs, deletes DM history — but does **not** remove them from shared match chats); no report article found; users can leave a chat at will | **Confirmed shown, but only in the separate Padelboard competition context**; not documented for ordinary Public Matches/chat |
| Padel Mates | In-app text chat ("chat with fellow padel mates") | Not documented publicly | Not documented publicly | Block/report claimed by a third-party app-index aggregator only — **secondary/unverified**, not confirmed in Padel Mates' own docs | Not documented publicly either way |
| Meetup | In-app text messaging only (no chat scoped to an "event/match" specifically) | Global — a standing member/organizer thread, not scoped to one RSVP'd event | No closure documented; persists as an ordinary conversation | Extensively documented: block (read-only/locked thread, no profile/DM access) and report (per-surface Report button, requires violation URL) | Not documented as shown; private-information rule implies the platform itself doesn't surface it, but no explicit "never shown" statement found |
| PicklePlay | In-app group chat, per marketing copy ("each match includes an in-game group chat") | Reads as per-game from marketing copy; not confirmed by a help article | Not documented publicly | Not documented publicly (app-store content rating implies moderation exists in principle only) | Not documented publicly |
| Pickleheads | In-app text chat, 3 tiers: session chat (per-event), group chat (standing), Court Chat (per-venue, persistent) | Explicitly both by design — session chat is per-match; group chat and Court Chat are persistent/global | Not documented publicly for session chat; group chat and Court Chat persist by design | Only mute (and leave-group) documented; no block or report article found for player-to-player chat — documentation gap, not confirmed absence | Not documented as shown between players; own-device contacts used only for outbound invites, not reveal |
| DUPR | In-app group messaging (per App Store content disclosure) | Not documented publicly | Not documented publicly | Report only, via a generic conduct-violation form; no block/mute documented | Not documented as shown; privacy policy addresses only public forum/chat content generally |
