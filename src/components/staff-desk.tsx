"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VENUE_TIME_ZONE } from "@/lib/clock";
import type { DeskPlayer } from "@/lib/staff/players";
import type {
  ScheduledBlock,
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

const BLOCK_ERROR: Record<string, string> = {
  slot_taken:
    "A Slot in this range is already taken. Cancel that Booking first, then place the Block.",
  outside_opening_hours: "This range runs outside Opening Hours.",
  court_not_found: "That Court no longer exists.",
};

const HOUR_MS = 60 * 60 * 1000;

type StaffDeskProps = {
  schedule: StaffSchedule;
  players: DeskPlayer[];
  staffName: string;
};

export function StaffDesk({ schedule, players, staffName }: StaffDeskProps) {
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
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string>();
  const [pendingBlockRemoval, setPendingBlockRemoval] = useState<ScheduledBlock>();
  const [removingBlock, setRemovingBlock] = useState(false);

  const slotByHourAndCourt = new Map(
    schedule.slots.map((slot) => [`${slot.hour}|${slot.courtId}`, slot]),
  );

  // The selection is a contiguous range of free Slots on one Court: a Booking
  // takes one or two of them, a Block takes as many as Staff pick.
  const selectSlot = (slot: StaffScheduleSlot) => {
    setPendingCancellation(undefined);
    setPendingBlockRemoval(undefined);
    setCreateError(undefined);
    setBlockError(undefined);
    setSelectedSlots((current) => {
      const alreadySelected = current.some(
        (candidate) => candidate.courtId === slot.courtId && candidate.start === slot.start,
      );
      const sameCourt = current.length > 0 && current[0].courtId === slot.courtId;
      const adjacent =
        !alreadySelected &&
        sameCourt &&
        current.some(
          (candidate) =>
            Math.abs(
              new Date(candidate.start).getTime() - new Date(slot.start).getTime(),
            ) === HOUR_MS,
        );
      if (!adjacent) {
        return [slot];
      }
      return [...current, slot].sort(
        (left, right) =>
          new Date(left.start).getTime() - new Date(right.start).getTime(),
      );
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

  const placeBlock = async () => {
    const firstSlot = selectedSlots[0];
    if (!firstSlot) {
      return;
    }
    setBlocking(true);
    setBlockError(undefined);
    try {
      const response = await fetch("/api/staff/blocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courtId: firstSlot.courtId,
          startsAt: firstSlot.start,
          slotCount: selectedSlots.length,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setBlockError(
          BLOCK_ERROR[body.error ?? ""] ??
            "The Block could not be placed. Refresh the page and try again.",
        );
        router.refresh();
        return;
      }
      setSelectedSlots([]);
      router.refresh();
    } finally {
      setBlocking(false);
    }
  };

  const confirmBlockRemoval = async () => {
    if (!pendingBlockRemoval) {
      return;
    }
    setRemovingBlock(true);
    setBlockError(undefined);
    try {
      const response = await fetch("/api/staff/blocks", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blockId: pendingBlockRemoval.id }),
      });
      if (!response.ok) {
        setBlockError(
          "This Block could not be removed. Refresh the page and try again.",
        );
        router.refresh();
        return;
      }
      setPendingBlockRemoval(undefined);
      router.refresh();
    } finally {
      setRemovingBlock(false);
    }
  };

  const firstSelected = selectedSlots[0];
  const lastSelected = selectedSlots.at(-1);
  const selectionEnd = lastSelected
    ? new Date(new Date(lastSelected.start).getTime() + HOUR_MS)
    : undefined;
  // A Booking covers one or two Slots, so a longer range can only be blocked.
  const canBook = selectedSlots.length <= 2;

  return (
    <>
      <section className={styles.intro}>
        <h2>Staff desk</h2>
        <p>
          Signed in as {staffName}. Everything you create or cancel here is
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
                    const block = slot.block;
                    return (
                      <td className={styles.blocked} key={court.id}>
                        {block ? (
                          <button
                            aria-label={`Remove the Block on ${slot.courtName} at ${slot.hour}`}
                            className={styles.blockedButton}
                            onClick={() => {
                              setSelectedSlots([]);
                              setPendingCancellation(undefined);
                              setBlockError(undefined);
                              setPendingBlockRemoval(block);
                            }}
                            type="button"
                          >
                            Blocked
                          </button>
                        ) : (
                          "Blocked"
                        )}
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
                            setPendingBlockRemoval(undefined);
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
        <aside
          aria-label="Book or block these Slots"
          className={styles.panel}
          role="dialog"
        >
          <div>
            <p className={styles.eyebrow}>
              {canBook ? "Book or block these Slots" : "Block these Slots"}
            </p>
            <h3>{firstSelected.courtName}</h3>
            <p>
              {schedule.date}, {VENUE_TIME.format(new Date(firstSelected.start))}–
              {VENUE_TIME.format(selectionEnd)}
            </p>
            <p className={styles.hint}>
              {canBook
                ? "Tap the next free Slot on this Court to extend the range."
                : "This range is longer than two Slots, so it can only be blocked."}
            </p>
            {blockError && (
              <p className={styles.error} role="alert">
                {blockError}
              </p>
            )}
            {canBook && (
              <label className={styles.field}>
                Booker
                <select
                  onChange={(event) => setBookerChoice(event.target.value)}
                  value={bookerChoice}
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.displayName} — {player.phone}
                      {player.memberUntil
                        ? ` (Member until ${player.memberUntil})`
                        : ""}
                    </option>
                  ))}
                  <option value={NEW_PLAYER}>New Player (walk-in)</option>
                </select>
              </label>
            )}
            {canBook && bookerChoice === NEW_PLAYER && (
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
            {canBook && (
              <p>The named Player is the Booker, under their own Booking Horizon.</p>
            )}
            {createError && (
              <p className={styles.error} role="alert">
                {createError}
              </p>
            )}
          </div>
          <div className={styles.panelActions}>
            <button
              className={styles.secondaryButton}
              disabled={submitting || blocking}
              onClick={() => setSelectedSlots([])}
              type="button"
            >
              Clear
            </button>
            <button
              className={styles.secondaryButton}
              disabled={submitting || blocking}
              onClick={placeBlock}
              type="button"
            >
              {blocking ? "Blocking…" : "Place Block"}
            </button>
            {canBook && (
              <button
                className={styles.primaryButton}
                disabled={submitting || blocking}
                onClick={confirmBooking}
                type="button"
              >
                {submitting ? "Booking…" : "Create Booking"}
              </button>
            )}
          </div>
        </aside>
      )}

      {pendingBlockRemoval && (
        <aside aria-label="Remove this Block" className={styles.panel} role="dialog">
          <div>
            <p className={styles.eyebrow}>Remove this Block</p>
            <h3>Blocked Slots</h3>
            <p>
              {VENUE_DATE_TIME.format(new Date(pendingBlockRemoval.startsAt))}–
              {VENUE_TIME.format(new Date(pendingBlockRemoval.endsAt))}
            </p>
            <p>
              Removing the Block reopens all of its Slots at once. Nothing else
              changes.
            </p>
            {blockError && (
              <p className={styles.error} role="alert">
                {blockError}
              </p>
            )}
          </div>
          <div className={styles.panelActions}>
            <button
              className={styles.secondaryButton}
              disabled={removingBlock}
              onClick={() => setPendingBlockRemoval(undefined)}
              type="button"
            >
              Keep Block
            </button>
            <button
              className={styles.primaryButton}
              disabled={removingBlock}
              onClick={confirmBlockRemoval}
              type="button"
            >
              {removingBlock ? "Removing…" : "Remove Block"}
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

    </>
  );
}
