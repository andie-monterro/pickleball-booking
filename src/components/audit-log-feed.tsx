import type { AuditEntry } from "@/lib/audit-log";
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

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  booking_created: "created a Booking",
  booking_cancelled: "cancelled a Booking",
  staff_account_created: "created a Staff account",
  staff_account_deactivated: "deactivated a Staff account",
};

// What the action was about. An entry snapshots it, so the sentence reads the
// same after the Booking or the Staff account is gone.
function subjectOf(entry: AuditEntry): string {
  if ("bookerName" in entry.details) {
    const { bookerName, courtName, startsAt, endsAt } = entry.details;
    return `for ${bookerName} — ${courtName}, ${VENUE_DATE_TIME.format(
      new Date(startsAt),
    )}–${VENUE_TIME.format(new Date(endsAt))}`;
  }
  return `for ${entry.details.accountName} — ${entry.details.accountPhone}`;
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
