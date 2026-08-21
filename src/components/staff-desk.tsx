"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuditEntry } from "@/lib/audit-log";
import { VENUE_TIME_ZONE } from "@/lib/clock";
import type { DeskPlayer } from "@/lib/staff/players";
import type {
  ScheduledBooking,
  StaffSchedule,
  StaffScheduleSlot,
} from "@/lib/staff/schedule";
import styles from "./staff-desk.module.css";

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
};

const NEW_PLAYER = "new";

const CREATE_ERROR: Record<string, string> = {
  slot_taken: "That Slot was just taken. Pick another one.",
  outside_horizon:
    "That day is outside this Player's Booking Horizon. A Member reaches further ahead.",
  slot_not_bookable: "That Slot is outside Opening Hours.",
  slot_in_past: "That Slot has already started.",
  player_not_found: "That Player record no longer exists.",
  invalid_phone: "Enter the phone number as +84… with no spaces.",
  invalid_display_name: "Enter the player's name.",
};

type StaffDeskProps = {
  schedule: StaffSchedule;
  players: DeskPlayer[];
  auditEntries: AuditEntry[];
  staffName: string;
};

export function StaffDesk({
  schedule,
  players,
  auditEntries,
  staffName,
}: StaffDeskProps) {
  const router = useRouter();
  const [selectedSlots, setSelectedSlots] = useState<StaffScheduleSlot[]>([]);
  const [bookerChoice, setBookerChoice] = useState(players[0]?.id ?? NEW_PLAYER);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPhone, setNewPlayerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [pendingCancellation, setPendingCancellation] = useState<ScheduledBooking>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string>();

  const slotByHourAndCourt = new Map(
    schedule.slots.map((slot) => [`${slot.hour}|${slot.courtId}`, slot]),
  );

  const selectSlot = (slot: StaffScheduleSlot) => {
    setPendingCancellation(undefined);
    setCreateError(undefined);
    setSelectedSlots((current) => {
      if (current.length === 1 && current[0].courtId === slot.courtId) {
        const distance = Math.abs(
          new Date(current[0].start).getTime() - new Date(slot.start).getTime(),
        );
        if (distance === 60 * 60 * 1000) {
          return [current[0], slot].sort(
            (left, right) =>
              new Date(left.start).getTime() - new Date(right.start).getTime(),
          );
        }
      }
      return [slot];
    });
  };

  const confirmBooking = async () => {
    const firstSlot = selectedSlots[0];
    if (!firstSlot) {
      return;
    }
    setSubmitting(true);
    setCreateError(undefined);
    try {
      const response = await fetch("/api/staff/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courtId: firstSlot.courtId,
          startsAt: firstSlot.start,
          durationHours: selectedSlots.length,
          ...(bookerChoice === NEW_PLAYER
            ? {
                newPlayer: {
                  displayName: newPlayerName,
                  phone: newPlayerPhone,
                },
              }
            : { playerId: bookerChoice }),
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setCreateError(
          CREATE_ERROR[body.error ?? ""] ??
            "The Booking could not be created. Check the details and try again.",
        );
        router.refresh();
        return;
      }
      setSelectedSlots([]);
      setNewPlayerName("");
      setNewPlayerPhone("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancellation = async () => {
    if (!pendingCancellation) {
      return;
    }
    setCancelling(true);
    setCancelError(undefined);
    try {
      const response = await fetch("/api/staff/bookings", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: pendingCancellation.id }),
      });
      if (!response.ok) {
        setCancelError(
          "This Booking could not be cancelled. Refresh the page and try again.",
        );
        router.refresh();
        return;
      }
      setPendingCancellation(undefined);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  const firstSelected = selectedSlots[0];
  const lastSelected = selectedSlots.at(-1);
  const selectionEnd = lastSelected
    ? new Date(new Date(lastSelected.start).getTime() + 60 * 60 * 1000)
    : undefined;

  return (
    <>
      <section className={styles.intro}>
        <h2>Staff desk</h2>
        <p>
          Signed in as {staffName}. Every Booking you create or cancel here is
          recorded in the Audit Log under your name.
        </p>
      </section>

      <nav aria-label="Choose a day" className={styles.dayStrip}>
        {schedule.days.map((day) => (
          <a
            className={day === schedule.date ? styles.currentDay : styles.day}
            href={`/staff?date=${day}`}
            key={day}
          >
            <strong>{day}</strong>
          </a>
        ))}
      </nav>

      <section
        aria-label={`Staff schedule for ${schedule.date}`}
        className={styles.gridRegion}
      >
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.headerCell}>Time</th>
              {schedule.courts.map((court) => (
                <th className={styles.courtHeader} key={court.id}>
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.hours.map((hour) => (
              <tr key={hour}>
                <th className={styles.headerCell}>{hour}</th>
                {schedule.courts.map((court) => {
                  const slot = slotByHourAndCourt.get(`${hour}|${court.id}`);
                  if (!slot) {
                    return (
                      <td className={styles.closed} key={court.id}>
                        Closed
                      </td>
                    );
                  }
                  if (slot.status === "blocked") {
                    return (
                      <td className={styles.blocked} key={court.id}>
                        Blocked
                      </td>
                    );
                  }
                  if (slot.booking) {
                    const booking = slot.booking;
                    return (
                      <td className={styles.taken} key={court.id}>
                        <button
                          aria-label={`Cancel ${booking.bookerName} on ${slot.courtName} at ${slot.hour}`}
                          className={styles.takenButton}
                          onClick={() => {
                            setSelectedSlots([]);
                            setCancelError(undefined);
                            setPendingCancellation(booking);
                          }}
                          type="button"
                        >
                          <strong>{booking.bookerName}</strong>
                          <span>{booking.bookerPhone}</span>
                        </button>
                      </td>
                    );
                  }
                  const selected = selectedSlots.some(
                    (candidate) =>
                      candidate.courtId === slot.courtId &&
                      candidate.start === slot.start,
                  );
                  return (
                    <td className={styles.free} key={court.id}>
                      <button
                        aria-label={`Book ${slot.courtName} at ${slot.hour}`}
                        aria-pressed={selected}
                        className={selected ? styles.selectedSlot : styles.slotButton}
                        onClick={() => selectSlot(slot)}
                        type="button"
                      >
                        {selected ? "Selected" : "Free"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {firstSelected && selectionEnd && (
        <aside aria-label="Book for a Player" className={styles.panel} role="dialog">
          <div>
            <p className={styles.eyebrow}>Book for a Player</p>
            <h3>{firstSelected.courtName}</h3>
            <p>
              {schedule.date}, {VENUE_TIME.format(new Date(firstSelected.start))}–
              {VENUE_TIME.format(selectionEnd)}
            </p>
            {selectedSlots.length === 1 && (
              <p className={styles.hint}>
                Tap the next free Slot on this Court to extend to two hours.
              </p>
            )}
            <label className={styles.field}>
              Booker
              <select
                onChange={(event) => setBookerChoice(event.target.value)}
                value={bookerChoice}
              >
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName} — {player.phone}
                    {player.memberUntil ? ` (Member until ${player.memberUntil})` : ""}
                  </option>
                ))}
                <option value={NEW_PLAYER}>New Player (walk-in)</option>
              </select>
            </label>
            {bookerChoice === NEW_PLAYER && (
              <div className={styles.newPlayer}>
                <label className={styles.field}>
                  Name
                  <input
                    onChange={(event) => setNewPlayerName(event.target.value)}
                    placeholder="Bao Pham"
                    value={newPlayerName}
                  />
                </label>
                <label className={styles.field}>
                  Phone
                  <input
                    inputMode="tel"
                    onChange={(event) => setNewPlayerPhone(event.target.value)}
                    placeholder="+84901234567"
                    value={newPlayerPhone}
                  />
                </label>
                <p className={styles.hint}>
                  The record stays unverified. When this person signs up with the
                  same phone number, they take it over with their history.
                </p>
              </div>
            )}
            <p>The named Player is the Booker, under their own Booking Horizon.</p>
            {createError && (
              <p className={styles.error} role="alert">
                {createError}
              </p>
            )}
          </div>
          <div className={styles.panelActions}>
            <button
              className={styles.secondaryButton}
              disabled={submitting}
              onClick={() => setSelectedSlots([])}
              type="button"
            >
              Clear
            </button>
            <button
              className={styles.primaryButton}
              disabled={submitting}
              onClick={confirmBooking}
              type="button"
            >
              {submitting ? "Booking…" : "Create Booking"}
            </button>
          </div>
        </aside>
      )}

      {pendingCancellation && (
        <aside aria-label="Cancel this Booking" className={styles.panel} role="dialog">
          <div>
            <p className={styles.eyebrow}>Cancel this Booking</p>
            <h3>{pendingCancellation.bookerName}</h3>
            <p>
              {VENUE_DATE_TIME.format(new Date(pendingCancellation.startsAt))}–
              {VENUE_TIME.format(new Date(pendingCancellation.endsAt))}
            </p>
            <p>
              A staff cancellation is penalty-free at any time. The Booker earns
              no Strike and the Slots reopen at once.
            </p>
            {cancelError && (
              <p className={styles.error} role="alert">
                {cancelError}
              </p>
            )}
          </div>
          <div className={styles.panelActions}>
            <button
              className={styles.secondaryButton}
              disabled={cancelling}
              onClick={() => setPendingCancellation(undefined)}
              type="button"
            >
              Keep Booking
            </button>
            <button
              className={styles.primaryButton}
              disabled={cancelling}
              onClick={confirmCancellation}
              type="button"
            >
              {cancelling ? "Cancelling…" : "Cancel Booking"}
            </button>
          </div>
        </aside>
      )}

      <section aria-labelledby="audit-log-heading" className={styles.auditLog}>
        <h3 id="audit-log-heading">Audit Log</h3>
        {auditEntries.length === 0 ? (
          <p>No staff actions yet.</p>
        ) : (
          <ul>
            {auditEntries.map((entry) => (
              <li key={entry.id}>
                <span className={styles.auditWhen}>
                  {VENUE_DATE_TIME.format(new Date(entry.occurredAt))}
                </span>
                <span>
                  <strong>{entry.staff.displayName}</strong>{" "}
                  {ACTION_LABEL[entry.action]} for {entry.details.bookerName} —{" "}
                  {entry.details.courtName},{" "}
                  {VENUE_DATE_TIME.format(new Date(entry.details.startsAt))}–
                  {VENUE_TIME.format(new Date(entry.details.endsAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
