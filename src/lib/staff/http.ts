import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { BookingError } from "@/lib/bookings";
import { StaffAccountError } from "@/lib/staff/accounts";
import { BlockError } from "@/lib/staff/blocks";
import { DeskPlayerError } from "@/lib/staff/players";
import { StrikeError } from "@/lib/staff/strikes";
import { VenueSettingsError } from "@/lib/staff/venue-settings";

// Staff endpoints are a superset of player endpoints, so they answer with three
// families of error: the session guard's (unauthorized, staff_only, an invalid
// phone or name for a Player or Staff account record), and the policy errors of
// Bookings, Blocks, staff account management, Strikes, Player records, and
// venue settings.
export function staffErrorResponse(error: unknown): Response {
  if (
    error instanceof BookingError ||
    error instanceof BlockError ||
    error instanceof StaffAccountError ||
    error instanceof DeskPlayerError ||
    error instanceof StrikeError ||
    error instanceof VenueSettingsError
  ) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return authErrorResponse(error);
}
