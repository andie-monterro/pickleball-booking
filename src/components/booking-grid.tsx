"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  AvailabilityDay,
  AvailabilityResponse,
  AvailabilitySlot,
  SlotStatus,
} from "@/lib/availability";
import type { Booking } from "@/lib/bookings";
import { VENUE_TIME_ZONE } from "@/lib/clock";
import styles from "./booking-grid.module.css";

const STATUS_CLASS: Record<SlotStatus, string> = {
  free: styles.free,
  taken: styles.taken,
  blocked: styles.blocked,
  outside_horizon: styles.outsideHorizon,
};

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

// Mirrors the server-side Booking Horizon for UX only.
function dayNote(day: AvailabilityDay): string {
  if (!day.memberOnly) {
    return "Open to everyone.";
  }
  if (day.bookable) {
    return `Member-only. Opens to everyone ${day.opensToEveryoneOn}.`;
  }
  return `Member-only. You can book it from ${day.opensToEveryoneOn}.`;
}

type BookingGridProps = {
  availability: AvailabilityResponse;
  bookings: Booking[];
  signedIn: boolean;
};

export function BookingGrid({
  availability,
  bookings,
  signedIn,
}: BookingGridProps) {
  const router = useRouter();
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingCancellation, setPendingCancellation] = useState<Booking>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string>();
  const slotByHourAndCourt = new Map(
    availability.slots.map((slot) => [`${slot.hour}|${slot.courtId}`, slot]),
  );

  const selectSlot = (slot: AvailabilitySlot) => {
    setPendingCancellation(undefined);
    setError(undefined);
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
    setError(undefined);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courtId: firstSlot.courtId,
          startsAt: firstSlot.start,
          durationHours: selectedSlots.length,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(
          body.error === "slot_taken"
            ? "This slot was just taken. Choose another slot."
            : "The booking could not be completed. Choose another slot.",
        );
        router.refresh();
        return;
      }
      setSelectedSlots([]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const openCancellation = (booking: Booking) => {
    setSelectedSlots([]);
    setCancelError(undefined);
    setPendingCancellation(booking);
  };

  const confirmCancellation = async () => {
    if (!pendingCancellation) {
      return;
    }
    setCancelling(true);
    setCancelError(undefined);
    try {
      const response = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: pendingCancellation.id,
          confirmLateCancel:
            pendingCancellation.cancellationKind === "late_cancel",
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as {
          error?: string;
          cancellationKind?: "late_cancel";
        };
        if (
          body.error === "cancellation_reclassified" &&
          body.cancellationKind === "late_cancel"
        ) {
          setPendingCancellation({
            ...pendingCancellation,
            cancellationKind: body.cancellationKind,
          });
          return;
        }
        setCancelError(
          body.error === "booking_started"
            ? "This Booking has already started and cannot be cancelled."
            : "This Booking could not be cancelled. Refresh the page and try again.",
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
      <nav aria-label="Choose a day" className={styles.dayStrip}>
        {availability.days.map((day) => (
          <a
            className={day.date === availability.date ? styles.currentDay : styles.day}
            href={`/?date=${day.date}`}
            key={day.date}
          >
            <strong>{day.date}</strong>
            <span>{dayNote(day)}</span>
          </a>
        ))}
      </nav>

      {!signedIn && (
        <p className={styles.signInPrompt}>
          <a href={`/sign-in?returnTo=${encodeURIComponent(`/?date=${availability.date}`)}`}>
            Sign in
          </a>{" "}
          to book a free Slot.
        </p>
      )}

      <section
        aria-label={`Availability for ${availability.date}`}
        className={styles.gridRegion}
      >
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.headerCell}>Time</th>
              {availability.courts.map((court) => (
                <th className={styles.courtHeader} key={court.id}>
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {availability.hours.map((hour) => (
              <tr key={hour}>
                <th className={styles.headerCell}>{hour}</th>
                {availability.courts.map((court) => {
                  const slot = slotByHourAndCourt.get(`${hour}|${court.id}`);
                  if (!slot) {
                    return <td className={styles.closed} key={court.id}>Closed</td>;
                  }
                  const selected = selectedSlots.some(
                    (candidate) =>
                      candidate.courtId === slot.courtId && candidate.start === slot.start,
                  );
                  const bookable =
                    signedIn && slot.status === "free" && slot.label !== "Past";
                  return (
                    <td className={STATUS_CLASS[slot.status]} key={court.id}>
                      {bookable ? (
                        <button
                          aria-label={`Book ${slot.courtName} at ${slot.hour}`}
                          aria-pressed={selected}
                          className={selected ? styles.selectedSlot : styles.slotButton}
                          onClick={() => selectSlot(slot)}
                          type="button"
                        >
                          {selected ? "Selected" : slot.label}
                        </button>
                      ) : (
                        slot.label
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {firstSelected && lastSelected && selectionEnd && (
        <aside aria-label="Confirm booking" className={styles.confirmation} role="dialog">
          <div>
            <p className={styles.eyebrow}>Confirm booking</p>
            <h2>{firstSelected.courtName}</h2>
            <p>
              {availability.date}, {VENUE_TIME.format(new Date(firstSelected.start))}–
              {VENUE_TIME.format(selectionEnd)}
            </p>
            {selectedSlots.length === 1 && (
              <p className={styles.hint}>Tap an adjacent free Slot to extend to two hours.</p>
            )}
            <p>Pay at the venue. Free cancellation ends 6 hours before this Booking starts.</p>
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
          <div className={styles.confirmActions}>
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
              {submitting ? "Booking…" : "Confirm booking"}
            </button>
          </div>
        </aside>
      )}

      {signedIn && (
        <section aria-labelledby="my-bookings-heading" className={styles.myBookings}>
          <h2 id="my-bookings-heading">My upcoming Bookings</h2>
          {bookings.length === 0 ? (
            <p>You have no upcoming Bookings.</p>
          ) : (
            <ul>
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <div className={styles.bookingDetails}>
                    <strong>{booking.courtName}</strong>
                    <span>
                      {VENUE_DATE_TIME.format(new Date(booking.startsAt))}–
                      {VENUE_TIME.format(new Date(booking.endsAt))}
                    </span>
                  </div>
                  <button
                    className={styles.cancelButton}
                    onClick={() => openCancellation(booking)}
                    type="button"
                  >
                    Cancel Booking
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pendingCancellation && (
        <aside aria-label="Confirm cancellation" className={styles.confirmation} role="dialog">
          <div>
            <p className={styles.eyebrow}>Confirm cancellation</p>
            <h2>{pendingCancellation.courtName}</h2>
            <p>
              {VENUE_DATE_TIME.format(new Date(pendingCancellation.startsAt))}–
              {VENUE_TIME.format(new Date(pendingCancellation.endsAt))}
            </p>
            {pendingCancellation.cancellationKind === "late_cancel" ? (
              <p className={styles.warning} role="alert">
                This is a Late Cancel. Confirming will add one Strike to your profile.
              </p>
            ) : (
              <p>This cancellation is penalty-free and will not add a Strike.</p>
            )}
            {cancelError && <p className={styles.error} role="alert">{cancelError}</p>}
          </div>
          <div className={styles.confirmActions}>
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
              {cancelling ? "Cancelling…" : "Confirm cancellation"}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
