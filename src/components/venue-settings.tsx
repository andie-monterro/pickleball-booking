"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  DayOpeningHours,
  HorizonSettings,
  ManagedCourt,
} from "@/lib/staff/venue-settings";
import styles from "./venue-settings.module.css";

const WEEKDAY_NAME = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Whole hours only, and a day ends at midnight at the latest.
const START_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const END_HOURS = Array.from({ length: 24 }, (_, index) => index + 1);

const COURT_ERROR: Record<string, string> = {
  court_name_taken: "Another Court already has that name.",
  court_has_bookings:
    "This Court still holds Bookings that have not been played. Cancel them first, then take the Court out of booking.",
  court_not_found: "That Court no longer exists. Refresh the page.",
  invalid_request: "Give the Court a name of 60 characters or fewer.",
};

const HOURS_ERROR: Record<string, string> = {
  bookings_outside_new_hours:
    "Bookings on that weekday fall outside the new hours. Cancel them first, then change the hours.",
  invalid_request: "Opening Hours are whole hours, and the closing hour comes after the opening one.",
};

const HORIZON_ERROR: Record<string, string> = {
  invalid_request:
    "Give both horizons in whole days, up to 365, with the Member one at least as long as the casual one.",
};

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

async function readError(
  response: Response,
  messages: Record<string, string>,
  fallback: string,
): Promise<string> {
  const body = (await response.json()) as { error?: string };
  return messages[body.error ?? ""] ?? fallback;
}

type VenueSettingsProps = {
  courts: ManagedCourt[];
  openingHours: DayOpeningHours[];
  horizons: HorizonSettings;
};

export function VenueSettings({ courts, openingHours, horizons }: VenueSettingsProps) {
  const router = useRouter();
  const [newCourtName, setNewCourtName] = useState("");
  const [renamingId, setRenamingId] = useState<number>();
  const [renameTo, setRenameTo] = useState("");
  const [courtError, setCourtError] = useState<string>();
  const [savingCourt, setSavingCourt] = useState(false);
  const [hoursError, setHoursError] = useState<string>();
  const [savingWeekday, setSavingWeekday] = useState<number>();
  const [casualDays, setCasualDays] = useState(String(horizons.casualHorizonDays));
  const [memberDays, setMemberDays] = useState(String(horizons.memberHorizonDays));
  const [horizonError, setHorizonError] = useState<string>();
  const [savingHorizons, setSavingHorizons] = useState(false);
  const [horizonsSaved, setHorizonsSaved] = useState(false);

  const sendCourt = async (method: "POST" | "PATCH", body: unknown) => {
    setSavingCourt(true);
    setCourtError(undefined);
    try {
      const response = await fetch("/api/staff/courts", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setCourtError(
          await readError(
            response,
            COURT_ERROR,
            "The Court could not be changed. Refresh the page and try again.",
          ),
        );
        return;
      }
      setNewCourtName("");
      setRenamingId(undefined);
      router.refresh();
    } finally {
      setSavingCourt(false);
    }
  };

  const saveOpeningHours = async (dayOfWeek: number, startHour: number | null, endHour: number | null) => {
    setSavingWeekday(dayOfWeek);
    setHoursError(undefined);
    try {
      const response = await fetch("/api/staff/opening-hours", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dayOfWeek, startHour, endHour }),
      });
      if (!response.ok) {
        setHoursError(
          await readError(
            response,
            HOURS_ERROR,
            "The Opening Hours could not be changed. Refresh the page and try again.",
          ),
        );
        return;
      }
      router.refresh();
    } finally {
      setSavingWeekday(undefined);
    }
  };

  const saveHorizons = async () => {
    setSavingHorizons(true);
    setHorizonError(undefined);
    setHorizonsSaved(false);
    try {
      const response = await fetch("/api/staff/horizons", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          casualHorizonDays: Number(casualDays),
          memberHorizonDays: Number(memberDays),
        }),
      });
      if (!response.ok) {
        setHorizonError(
          await readError(
            response,
            HORIZON_ERROR,
            "The Booking Horizons could not be changed. Refresh the page and try again.",
          ),
        );
        return;
      }
      setHorizonsSaved(true);
      router.refresh();
    } finally {
      setSavingHorizons(false);
    }
  };

  return (
    <section aria-labelledby="venue-settings-heading" className={styles.settings}>
      <h3 id="venue-settings-heading">Venue settings</h3>
      <p className={styles.hint}>
        These are the venue&apos;s own data. A change here shows up in the grid
        and in the booking rules straight away.
      </p>

      <div className={styles.group}>
        <h4>Courts</h4>
        <p className={styles.hint}>
          A Court is never deleted, because Bookings and the Audit Log name it.
          Taking one out of booking removes it from every grid, and you can bring
          it back later.
        </p>
        <ul className={styles.rows}>
          {courts.map((court) => (
            <li key={court.id}>
              {renamingId === court.id ? (
                <>
                  <label className={styles.field}>
                    New name
                    <input
                      aria-label={`New name for ${court.name}`}
                      onChange={(event) => setRenameTo(event.target.value)}
                      value={renameTo}
                    />
                  </label>
                  <span className={styles.rowActions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={savingCourt}
                      onClick={() => setRenamingId(undefined)}
                      type="button"
                    >
                      Keep the name
                    </button>
                    <button
                      className={styles.primaryButton}
                      disabled={savingCourt || renameTo.trim() === ""}
                      onClick={() => sendCourt("PATCH", { courtId: court.id, name: renameTo })}
                      type="button"
                    >
                      Save the name
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <strong>{court.name}</strong>
                    {court.active ? "" : " — out of booking"}
                  </span>
                  <span className={styles.rowActions}>
                    <button
                      aria-label={`Rename ${court.name}`}
                      className={styles.secondaryButton}
                      disabled={savingCourt}
                      onClick={() => {
                        setCourtError(undefined);
                        setRenameTo(court.name);
                        setRenamingId(court.id);
                      }}
                      type="button"
                    >
                      Rename
                    </button>
                    <button
                      aria-label={
                        court.active
                          ? `Take ${court.name} out of booking`
                          : `Bring ${court.name} back into booking`
                      }
                      className={styles.secondaryButton}
                      disabled={savingCourt}
                      onClick={() =>
                        sendCourt("PATCH", { courtId: court.id, active: !court.active })
                      }
                      type="button"
                    >
                      {court.active ? "Take out of booking" : "Bring back"}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        {courtError && (
          <p className={styles.error} role="alert">
            {courtError}
          </p>
        )}
        <div className={styles.newCourt}>
          <label className={styles.field}>
            New Court name
            <input
              onChange={(event) => setNewCourtName(event.target.value)}
              placeholder="Court 5"
              value={newCourtName}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={savingCourt || newCourtName.trim() === ""}
            onClick={() => sendCourt("POST", { name: newCourtName })}
            type="button"
          >
            Add the Court
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <h4>Opening Hours</h4>
        <p className={styles.hint}>
          Slots exist only inside these hours, and they are whole hours. Close a
          single day with a Block instead — that keeps the weekday as it is.
        </p>
        <ul className={styles.rows}>
          {openingHours.map((day) => (
            <li key={day.dayOfWeek}>
              <strong className={styles.weekday}>{WEEKDAY_NAME[day.dayOfWeek]}</strong>
              <span className={styles.rowActions}>
                <label className={styles.inlineField}>
                  Opens
                  <select
                    aria-label={`${WEEKDAY_NAME[day.dayOfWeek]} opens at`}
                    disabled={savingWeekday !== undefined}
                    onChange={(event) =>
                      saveOpeningHours(
                        day.dayOfWeek,
                        Number(event.target.value),
                        day.endHour ?? 22,
                      )
                    }
                    value={day.startHour ?? ""}
                  >
                    <option value="">—</option>
                    {START_HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHour(hour)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.inlineField}>
                  Closes
                  <select
                    aria-label={`${WEEKDAY_NAME[day.dayOfWeek]} closes at`}
                    disabled={savingWeekday !== undefined || day.startHour === null}
                    onChange={(event) =>
                      saveOpeningHours(
                        day.dayOfWeek,
                        day.startHour ?? 6,
                        Number(event.target.value),
                      )
                    }
                    value={day.endHour ?? ""}
                  >
                    <option value="">—</option>
                    {END_HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHour(hour)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  aria-label={
                    day.startHour === null
                      ? `Open on ${WEEKDAY_NAME[day.dayOfWeek]}`
                      : `Close all day on ${WEEKDAY_NAME[day.dayOfWeek]}`
                  }
                  className={styles.secondaryButton}
                  disabled={savingWeekday !== undefined}
                  onClick={() =>
                    saveOpeningHours(
                      day.dayOfWeek,
                      day.startHour === null ? 6 : null,
                      day.startHour === null ? 22 : null,
                    )
                  }
                  type="button"
                >
                  {day.startHour === null ? "Open this day" : "Closed all day"}
                </button>
              </span>
            </li>
          ))}
        </ul>
        {hoursError && (
          <p className={styles.error} role="alert">
            {hoursError}
          </p>
        )}
      </div>

      <div className={styles.group}>
        <h4>Booking Horizons</h4>
        <p className={styles.hint}>
          How many whole venue days ahead each standing may book, counting today
          as the first day. A Member must reach at least as far as a casual
          player.
        </p>
        <label className={styles.field}>
          Members, in days
          <input
            inputMode="numeric"
            onChange={(event) => setMemberDays(event.target.value)}
            value={memberDays}
          />
        </label>
        <label className={styles.field}>
          Casual players, in days
          <input
            inputMode="numeric"
            onChange={(event) => setCasualDays(event.target.value)}
            value={casualDays}
          />
        </label>
        {horizonError && (
          <p className={styles.error} role="alert">
            {horizonError}
          </p>
        )}
        {horizonsSaved && !horizonError && (
          <p className={styles.hint}>Saved. The day strip already follows the new values.</p>
        )}
        <button
          className={styles.primaryButton}
          disabled={savingHorizons}
          onClick={saveHorizons}
          type="button"
        >
          {savingHorizons ? "Saving…" : "Save the horizons"}
        </button>
      </div>
    </section>
  );
}
