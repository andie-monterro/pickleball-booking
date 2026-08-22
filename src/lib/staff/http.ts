import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { BookingError } from "@/lib/bookings";
import { StaffAccountError } from "@/lib/staff/accounts";
import { BlockError } from "@/lib/staff/blocks";
import { StrikeError } from "@/lib/staff/strikes";

// Staff endpoints are a superset of player endpoints, so they answer with three
// families of error: the session guard's (unauthorized, staff_only, an invalid
// phone or name for a Player or Staff account record), and the policy errors of
// Bookings, Blocks, staff account management, and Strikes.
export function staffErrorResponse(error: unknown): Response {
  if (
    error instanceof BookingError ||
    error instanceof BlockError ||
    error instanceof StaffAccountError ||
    error instanceof StrikeError
  ) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return authErrorResponse(error);
}
