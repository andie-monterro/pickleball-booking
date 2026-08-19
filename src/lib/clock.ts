// The injectable clock. All time-dependent code must read time from `clock`,
// never from `new Date()` / `Date.now()` directly, so tests can set the
// current time (booking horizon, cancellation cutoff, strike window, ...).

// Instants are plain UTC Dates everywhere. Anything shown to humans, and any
// venue-local rule (opening hours, "day"), is interpreted in this time zone.
export const VENUE_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VENUE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

let current: Clock = systemClock;

export const clock: Clock = {
  now: () => current.now(),
};

export function formatVenueTime(at: Date): string {
  return VENUE_TIME_FORMATTER.format(at);
}

export function fixedClock(at: Date): Clock {
  return { now: () => at };
}

export function setClock(replacement: Clock): void {
  current = replacement;
}

export function resetClock(): void {
  current = systemClock;
}
