import { NextResponse } from "next/server";
import { readPlayerSession } from "@/lib/auth/auth";
import {
  BookingError,
  cancelBooking,
  createBooking,
  readUpcomingBookings,
} from "@/lib/bookings";

export const dynamic = "force-dynamic";

function bookingErrorBody(error: BookingError): Record<string, unknown> {
  if (error.code === "cancellation_reclassified") {
    return { error: error.code, cancellationKind: "late_cancel" };
  }
  if (error.code === "booking_banned") {
    return { error: error.code, banEndsAt: error.banEndsAt };
  }
  return { error: error.code };
}

function bookingErrorResponse(error: unknown): Response {
  if (error instanceof BookingError) {
    return NextResponse.json(bookingErrorBody(error), { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  throw error;
}

export async function GET(request: Request): Promise<Response> {
  const player = await readPlayerSession(request);
  if (!player) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ bookings: await readUpcomingBookings(player.id) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const player = await readPlayerSession(request);
    if (!player) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const booking = await createBooking(player.id, await request.json());
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const player = await readPlayerSession(request);
    if (!player) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      await cancelBooking(player.id, await request.json()),
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
