// The desk's view of a Player record: finding one before booking for them, so a
// walk-in who already has a record never gets a second one, and setting the
// "member until" date, because memberships are sold at the venue and the app
// only recognizes them.

import type { QueryResultRow } from "pg";
import { recordStaffAction, type StaffIdentity } from "@/lib/audit-log";
import { clock } from "@/lib/clock";
import { getPool, runInTransaction } from "@/lib/db";
import { parseVenueDate } from "@/lib/venue-date";

const LOOKUP_LIMIT = 100;

export interface DeskPlayer {
  id: string;
  displayName: string;
  phone: string;
  // The staff-set last venue date of membership, so the desk can see why a day
  // is inside or outside this Player's horizon. Null means a casual player.
  memberUntil: string | null;
}

interface DeskPlayerRow extends QueryResultRow {
  id: string;
  display_name: string;
  phone: string;
  member_until: string | null;
}

export async function readDeskPlayers(search?: string): Promise<DeskPlayer[]> {
  const term = search?.trim();
  const result = await getPool().query<DeskPlayerRow>(
    `select id, display_name, phone,
            to_char(member_until, 'YYYY-MM-DD') as member_until
       from players
      where $1::text is null
         or display_name ilike '%' || $1 || '%'
         or phone like '%' || $1 || '%'
      order by display_name, id
      limit $2`,
    [term && term.length > 0 ? term : null, LOOKUP_LIMIT],
  );
  return result.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
    memberUntil: row.member_until,
  }));
}

export class DeskPlayerError extends Error {
  constructor(
    readonly code: "invalid_request" | "player_not_found",
    readonly status: number,
  ) {
    super(code);
  }
}

interface MembershipInput {
  playerId: string;
  memberUntil: string | null;
}

function parseMembershipInput(input: unknown): MembershipInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DeskPlayerError("invalid_request", 400);
  }
  const record: Record<string, unknown> = { ...input };
  const { playerId, memberUntil } = record;
  if (typeof playerId !== "string" || playerId.length === 0) {
    throw new DeskPlayerError("invalid_request", 400);
  }
  // Null clears the membership, which is how a Player becomes a casual player
  // again. Any other value has to be a real venue date.
  if (memberUntil === null) {
    return { playerId, memberUntil: null };
  }
  if (typeof memberUntil !== "string") {
    throw new DeskPlayerError("invalid_request", 400);
  }
  try {
    return { playerId, memberUntil: parseVenueDate(memberUntil).key };
  } catch {
    throw new DeskPlayerError("invalid_request", 400);
  }
}

// The date is the last venue day of membership: the Player is a Member for the
// whole of that day and a casual player from the next one. Nothing here judges
// standing — every read derives it from this date against its own clock, so a
// membership starts and ends without anything having to run at midnight.
export async function setMemberUntil(
  staff: StaffIdentity,
  rawInput: unknown,
): Promise<DeskPlayer> {
  const input = parseMembershipInput(rawInput);
  const now = clock.now();

  return runInTransaction(async (client) => {
    const found = await client.query<DeskPlayerRow>(
      `select id, display_name, phone,
              to_char(member_until, 'YYYY-MM-DD') as member_until
         from players
        where id = $1
          for update`,
      [input.playerId],
    );
    const existing = found.rows[0];
    if (!existing) {
      throw new DeskPlayerError("player_not_found", 404);
    }

    await client.query("update players set member_until = $2 where id = $1", [
      input.playerId,
      input.memberUntil,
    ]);
    await recordStaffAction(client, {
      staff,
      action: "membership_changed",
      bookingId: null,
      blockId: null,
      subjectPlayerId: input.playerId,
      details: {
        playerName: existing.display_name,
        playerPhone: existing.phone,
        memberUntil: input.memberUntil,
        previousMemberUntil: existing.member_until,
      },
      occurredAt: now,
    });

    return {
      id: existing.id,
      displayName: existing.display_name,
      phone: existing.phone,
      memberUntil: input.memberUntil,
    };
  });
}
