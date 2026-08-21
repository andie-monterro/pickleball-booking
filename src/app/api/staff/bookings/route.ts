import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { createBookingForPlayer } from "@/lib/bookings";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const deskBooking = await createBookingForPlayer(staff, await request.json());
    return NextResponse.json(deskBooking, { status: 201 });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
