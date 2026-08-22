// The staff schedule: the same courts × hours grid as the public availability
// read, plus the booker identity behind every taken Slot. Staff resolve
// disputes and answer phone calls, so the desk sees who holds a Court; the
// public view never does.
//
// A Staff member's own Booking Horizon does not narrow this read. The desk
// books for the named Player, whose horizon is checked at write time, so hiding
// days from Staff would only hide the venue's real schedule from them.

import type { QueryResultRow } from "pg";
import { readBookingHorizon } from "@/lib/booking-horizon";
import { clock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { slotRangeEnd, type ClaimKind } from "@/lib/slot-claims";
import {
  claimKey,
  formatHour,
  readVenueGrid,
  venueDayBounds,
  type VenueCourt,
} from "@/lib/venue-grid";
import { addDays, parseVenueDate, venueDateFromInstant, type VenueDate } from "@/lib/venue-date";

export type StaffSlotStatus = "free" | "taken" | "blocked";

export interface ScheduledBlock {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface ScheduledBooking {
  id: string;
  bookerId: string;
  bookerName: string;
  bookerPhone: string;
  startsAt: string;
  endsAt: string;
  // Whether the Booking has begun, so the desk only offers a No-show mark on a
  // Booking there is something to judge about. "Any time after it starts"
  // includes the start instant itself.
  started: boolean;
  // Whether Staff already marked it as a No-show, so the desk offers the undo
  // instead of a second mark.
  noShow: boolean;
}

export interface StaffScheduleSlot {
  courtId: number;
  courtName: string;
  hour: string;
  start: string;
  status: StaffSlotStatus;
  booking?: ScheduledBooking;
  // The Block holding this Slot, so the desk can remove the whole Block from
  // any of its Slots.
  block?: ScheduledBlock;
}

export interface StaffSchedule {
  date: string;
  timeZone: string;
  // Day strip for the desk: the venue days a Member could book, so Staff see at
  // least as far ahead as any Player.
  days: string[];
  courts: VenueCourt[];
  hours: string[];
  slots: StaffScheduleSlot[];
}

interface ScheduleClaimRow extends QueryResultRow {
  court_id: number;
  slot_starts_at: Date;
  source_kind: ClaimKind;
  booking_id: string | null;
  booker_id: string | null;
  booker_name: string | null;
  booker_phone: string | null;
  starts_at: Date | null;
  duration_hours: number | null;
  block_id: string | null;
  block_starts_at: Date | null;
  block_slot_count: number | null;
  no_show: boolean;
}

export async function readStaffSchedule(dateParam?: string): Promise<StaffSchedule> {
  const horizon = await readBookingHorizon();
  const date =
    dateParam === undefined || dateParam === ""
      ? venueDateFromInstant(clock.now())
      : parseVenueDate(dateParam);
  const now = clock.now();
  const { timeZone, courts, hours, slotStarts } = await readVenueGrid(date);
  const claims = slotStarts.length === 0 ? [] : await readScheduleClaims(date);
  const claimByCourtAndStart = new Map(
    claims.map((claim) => [claimKey(claim.court_id, claim.slot_starts_at), claim]),
  );

  return {
    date: date.key,
    timeZone,
    days: Array.from(
      { length: horizon.memberDays },
      (_, index) => addDays(horizon.firstDate, index).key,
    ),
    courts,
    hours: hours.map(formatHour),
    slots: courts.flatMap((court) =>
      slotStarts.map((start, index) =>
        slotFor(
          court,
          hours[index],
          start,
          claimByCourtAndStart.get(claimKey(court.id, start)),
          now,
        ),
      ),
    ),
  };
}

function statusFor(claim: ScheduleClaimRow | undefined): StaffSlotStatus {
  if (!claim) {
    return "free";
  }
  return claim.source_kind === "booking" ? "taken" : "blocked";
}

function slotFor(
  court: VenueCourt,
  hour: number,
  start: Date,
  claim: ScheduleClaimRow | undefined,
  now: Date,
): StaffScheduleSlot {
  const slot: StaffScheduleSlot = {
    courtId: court.id,
    courtName: court.name,
    hour: formatHour(hour),
    start: start.toISOString(),
    status: statusFor(claim),
  };
  if (claim?.block_id && claim.block_starts_at && claim.block_slot_count) {
    slot.block = {
      id: claim.block_id,
      startsAt: claim.block_starts_at.toISOString(),
      endsAt: slotRangeEnd({
        courtId: claim.court_id,
        startsAt: claim.block_starts_at,
        slotCount: claim.block_slot_count,
      }).toISOString(),
    };
  }
  if (
    claim?.source_kind === "booking" &&
    claim.booking_id &&
    claim.booker_id &&
    claim.starts_at &&
    claim.duration_hours
  ) {
    slot.booking = {
      id: claim.booking_id,
      bookerId: claim.booker_id,
      bookerName: claim.booker_name ?? "",
      bookerPhone: claim.booker_phone ?? "",
      startsAt: claim.starts_at.toISOString(),
      endsAt: new Date(
        claim.starts_at.getTime() + claim.duration_hours * 60 * 60 * 1000,
      ).toISOString(),
      started: claim.starts_at.getTime() <= now.getTime(),
      noShow: claim.no_show,
    };
  }
  return slot;
}

async function readScheduleClaims(date: VenueDate): Promise<ScheduleClaimRow[]> {
  const [dayStart, nextDayStart] = venueDayBounds(date);
  const result = await getPool().query<ScheduleClaimRow>(
    `select slot_claims.court_id,
            slot_claims.slot_starts_at,
            slot_claims.source_kind,
            bookings.id as booking_id,
            bookings.booker_id,
            bookings.starts_at,
            bookings.duration_hours,
            players.display_name as booker_name,
            players.phone as booker_phone,
            blocks.id as block_id,
            blocks.starts_at as block_starts_at,
            blocks.slot_count as block_slot_count,
            strikes.id is not null as no_show
       from slot_claims
       left join bookings
         on slot_claims.source_kind = 'booking'
        and bookings.id = slot_claims.source_id
       left join players on players.id = bookings.booker_id
       left join strikes
         on strikes.booking_id = bookings.id
        and strikes.reason = 'no_show'
       left join blocks
         on slot_claims.source_kind = 'block'
        and blocks.id = slot_claims.source_id
      where slot_claims.slot_starts_at >= $1
        and slot_claims.slot_starts_at < $2`,
    [dayStart, nextDayStart],
  );
  return result.rows;
}
