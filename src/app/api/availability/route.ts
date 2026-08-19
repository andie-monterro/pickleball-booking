import { NextResponse } from "next/server";
import { readAvailability } from "@/lib/availability";
import { isVenueDate } from "@/lib/venue-time";

// The availability read is public: it needs no session and exposes occupancy
// only, never who booked a Slot.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get("date");
  if (date !== null && !isVenueDate(date)) {
    return NextResponse.json(
      { error: "date must be a venue date, written as YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const availability = await readAvailability({ date: date ?? undefined });
  return NextResponse.json(availability);
}
