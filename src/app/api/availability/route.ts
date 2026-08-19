import { NextResponse } from "next/server";
import { readAvailability } from "@/lib/availability";
import { readPlayerSession } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;

  try {
    // Public read: a signed-in Player sees their own Booking Horizon, and the
    // response still carries occupancy only — never who booked a Slot.
    const player = await readPlayerSession(request);
    return NextResponse.json(await readAvailability(date, player?.id));
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
