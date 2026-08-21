// Blocks: staff-made unavailability of one Court for a range of Slots, so
// maintenance and private events take courts out of booking.
//
// A Block occupies Slots exactly like a Booking — one slot_claims row per Slot
// under the same uniqueness constraint — so a blocked Slot can never be
// double-booked and a Block racing a Booking loses or wins in the database. It
// has no Booker and no policy semantics: no horizon, no cutoff, no Strike.
//
// A Block only ever lands on free Slots. A range holding a Booking is refused
// whole, so no player's Booking silently disappears; Staff cancel it first.

import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { recordStaffAction, type StaffIdentity } from "@/lib/audit-log";
import { clock } from "@/lib/clock";
import { runInTransaction } from "@/lib/db";
import {
  claimSlots,
  isSlotTaken,
  readClaimableCourt,
  releaseSlots,
  slotRangeEnd,
  type ClaimRange,
} from "@/lib/slot-claims";

// A venue day's Opening Hours are whole hours inside one day, so no range of
// real Slots can be longer than this. Longer maintenance is several Blocks.
const MAX_SLOT_COUNT = 24;

export interface Block {
  id: string;
  courtId: number;
  courtName: string;
  startsAt: string;
  endsAt: string;
  slotCount: number;
}

interface RemovableBlockRow extends QueryResultRow {
  court_id: number;
  court_name: string;
  starts_at: Date;
  slot_count: number;
}

export class BlockError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "court_not_found"
      | "outside_opening_hours"
      | "slot_taken"
      | "block_not_found",
    readonly status: number,
  ) {
    super(code);
  }
}

function parsePlaceInput(input: unknown): ClaimRange {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BlockError("invalid_request", 400);
  }
  const record = input as Record<string, unknown>;
  const courtId = record.courtId;
  const slotCount = record.slotCount;
  const startsAt =
    typeof record.startsAt === "string"
      ? new Date(record.startsAt)
      : new Date(Number.NaN);

  if (
    !Number.isInteger(courtId) ||
    !Number.isInteger(slotCount) ||
    Number.isNaN(startsAt.getTime()) ||
    startsAt.getUTCMinutes() !== 0 ||
    startsAt.getUTCSeconds() !== 0 ||
    startsAt.getUTCMilliseconds() !== 0
  ) {
    throw new BlockError("invalid_request", 400);
  }
  const range = {
    courtId: Number(courtId),
    startsAt,
    slotCount: Number(slotCount),
  };
  if (
    range.courtId <= 0 ||
    range.slotCount <= 0 ||
    range.slotCount > MAX_SLOT_COUNT
  ) {
    throw new BlockError("invalid_request", 400);
  }
  return range;
}

function parseRemoveInput(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BlockError("invalid_request", 400);
  }
  const blockId = (input as Record<string, unknown>).blockId;
  if (typeof blockId !== "string" || blockId.length === 0) {
    throw new BlockError("invalid_request", 400);
  }
  return blockId;
}

function blockOf(id: string, courtName: string, range: ClaimRange): Block {
  return {
    id,
    courtId: range.courtId,
    courtName,
    startsAt: range.startsAt.toISOString(),
    endsAt: slotRangeEnd(range).toISOString(),
    slotCount: range.slotCount,
  };
}

function auditDetails(block: Block) {
  return {
    courtName: block.courtName,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
  };
}

// The range must be Slots that exist: Slots are derived from Opening Hours, so
// an hour the venue is closed has nothing to take out of booking. The clock does
// not judge the range — a Slot already past is unbookable anyway, so Staff may
// block a maintenance window that is already under way.
async function readBlockableCourtName(
  client: PoolClient,
  range: ClaimRange,
): Promise<string> {
  const court = await readClaimableCourt(client, range);
  if (!court) {
    throw new BlockError("court_not_found", 404);
  }
  if (court.openSlotCount !== range.slotCount) {
    throw new BlockError("outside_opening_hours", 400);
  }
  return court.name;
}

export async function placeBlock(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<Block> {
  const range = parsePlaceInput(rawInput);
  const now = clock.now();

  try {
    return await runInTransaction(async (client) => {
      const courtName = await readBlockableCourtName(client, range);
      const id = randomUUID();
      await client.query(
        `insert into blocks (id, court_id, starts_at, slot_count, created_at)
         values ($1, $2, $3, $4, $5)`,
        [id, range.courtId, range.startsAt, range.slotCount, now],
      );
      await claimSlots(client, range, "block", id);
      const block = blockOf(id, courtName, range);
      await recordStaffAction(client, {
        staff,
        action: "block_placed",
        bookingId: null,
        blockId: id,
        subjectPlayerId: null,
        details: auditDetails(block),
        occurredAt: now,
      });
      return block;
    });
  } catch (error) {
    // A Slot in the range is already claimed — by a Booking, or by another
    // Block. Either way the range is refused whole.
    if (isSlotTaken(error)) {
      throw new BlockError("slot_taken", 409);
    }
    throw error;
  }
}

export async function removeBlock(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<Block> {
  const blockId = parseRemoveInput(rawInput);
  const now = clock.now();

  return runInTransaction(async (client) => {
    const result = await client.query<RemovableBlockRow>(
      `select blocks.court_id,
              blocks.starts_at,
              blocks.slot_count,
              courts.name as court_name
         from blocks
         join courts on courts.id = blocks.court_id
        where blocks.id = $1
          and blocks.removed_at is null
        for update of blocks`,
      [blockId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new BlockError("block_not_found", 404);
    }

    await client.query("update blocks set removed_at = $2 where id = $1", [
      blockId,
      now,
    ]);
    await releaseSlots(client, "block", blockId);

    const block = blockOf(blockId, row.court_name, {
      courtId: row.court_id,
      startsAt: row.starts_at,
      slotCount: row.slot_count,
    });
    await recordStaffAction(client, {
      staff,
      action: "block_removed",
      bookingId: null,
      blockId,
      subjectPlayerId: null,
      details: auditDetails(block),
      occurredAt: now,
    });
    return block;
  });
}
