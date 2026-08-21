// Player lookup for the desk: Staff pick an existing Player before booking for
// them, so a walk-in who already has a record never gets a second one.

import type { QueryResultRow } from "pg";
import { getPool } from "@/lib/db";

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
