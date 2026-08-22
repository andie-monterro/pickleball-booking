import type { AuditEntry, StrikeAuditDetails } from "@/lib/audit-log";
import { VENUE_TIME_ZONE } from "@/lib/clock";
import styles from "./audit-log-feed.module.css";

const VENUE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const VENUE_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const VENUE_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  dateStyle: "medium",
});

const WEEKDAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  booking_created: "created a Booking",
  booking_cancelled: "cancelled a Booking",
  block_placed: "placed a Block",
  block_removed: "removed a Block",
  staff_account_created: "created a Staff account",
  staff_account_deactivated: "deactivated a Staff account",
  no_show_marked: "marked a No-show",
  no_show_undone: "undid a No-show mark",
  strike_waived: "waived a Strike",
  court_added: "added a Court",
  court_renamed: "renamed a Court",
  court_deactivated: "deactivated a Court",
  court_reactivated: "brought a Court back",
  opening_hours_changed: "changed Opening Hours",
  booking_horizons_changed: "changed the Booking Horizons",
  membership_changed: "changed a membership",
};

const STRIKE_REASON_LABEL: Record<StrikeAuditDetails["strikeReason"], string> = {
  late_cancel: "Late Cancel",
  no_show: "No-show",
};

// A venue date, kept as YYYY-MM-DD. Read at UTC midnight, which is the same
// calendar day in venue time.
function venueDateLabel(date: string | null): string {
  return date === null ? "none" : VENUE_DATE.format(new Date(`${date}T00:00:00Z`));
}

// What the action was about. An entry snapshots it, so the sentence reads the
// same after the Booking, the Court or the Staff account is gone. Readers tell
// the details shapes apart by their fields, never by the action.
function subjectOf(entry: AuditEntry): string {
  const { details } = entry;
  if ("strikeReason" in details) {
    const { earnedAt, playerName, strikeReason } = details;
    return `for ${playerName} — ${
      STRIKE_REASON_LABEL[strikeReason]
    } earned ${VENUE_DATE_TIME.format(new Date(earnedAt))}`;
  }
  if ("court" in details) {
    const { court, previousCourt } = details;
    return previousCourt ? `— ${previousCourt} is now ${court}` : `— ${court}`;
  }
  if ("weekday" in details) {
    const { weekday, openingHours, previousOpeningHours } = details;
    return `— ${WEEKDAY_NAME[weekday]}: ${openingHours ?? "closed"} (was ${
      previousOpeningHours ?? "closed"
    })`;
  }
  if ("casualHorizonDays" in details) {
    const { casualHorizonDays, memberHorizonDays } = details;
    return `— ${memberHorizonDays} days for Members, ${casualHorizonDays} for casual players (was ${details.previousMemberHorizonDays} and ${details.previousCasualHorizonDays})`;
  }
  if ("memberUntil" in details) {
    const { memberUntil, playerName, previousMemberUntil } = details;
    return `for ${playerName} — member until ${venueDateLabel(
      memberUntil,
    )} (was ${venueDateLabel(previousMemberUntil)})`;
  }
  if ("courtName" in details) {
    const { bookerName, courtName, startsAt, endsAt } = details;
    const booker = bookerName ? `for ${bookerName} — ` : "";
    return `${booker}${courtName}, ${VENUE_DATE_TIME.format(
      new Date(startsAt),
    )}–${VENUE_TIME.format(new Date(endsAt))}`;
  }
  return `for ${details.accountName} — ${details.accountPhone}`;
}

export function AuditLogFeed({ entries }: { entries: AuditEntry[] }) {
  return (
    <section aria-labelledby="audit-log-heading" className={styles.feed}>
      <h3 id="audit-log-heading">Audit Log</h3>
      {entries.length === 0 ? (
        <p>No staff actions yet.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className={styles.when}>
                {VENUE_DATE_TIME.format(new Date(entry.occurredAt))}
              </span>
              <span>
                <strong>{entry.staff.displayName}</strong>{" "}
                {ACTION_LABEL[entry.action]} {subjectOf(entry)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
