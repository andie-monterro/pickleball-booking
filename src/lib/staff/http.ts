import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { BookingError } from "@/lib/bookings";
import { BlockError } from "@/lib/staff/blocks";

// Staff endpoints are a superset of player endpoints, so they answer with both
// families of error: the session guard's (unauthorized, staff_only, an invalid
// phone or name for a light Player record) and the Booking or Block policy's.
export function staffErrorResponse(error: unknown): Response {
  if (error instanceof BookingError || error instanceof BlockError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  return authErrorResponse(error);
}
