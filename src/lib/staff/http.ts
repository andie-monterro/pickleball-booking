import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { BookingError } from "@/lib/bookings";
import { StaffAccountError } from "@/lib/staff/accounts";

// Staff endpoints are a superset of player endpoints, so they answer with three
// families of error: the session guard's (unauthorized, staff_only, an invalid
// phone or name for a Player or Staff account record), the Booking policy's, and
// staff account management's.
export function staffErrorResponse(error: unknown): Response {
  if (error instanceof BookingError || error instanceof StaffAccountError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return authErrorResponse(error);
}
