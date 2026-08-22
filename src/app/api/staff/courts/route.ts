import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { staffErrorResponse } from "@/lib/staff/http";
import { addCourt, readManagedCourts, updateCourt } from "@/lib/staff/venue-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await readStaffSession(request);
    return NextResponse.json({ courts: await readManagedCourts() });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const court = await addCourt(staff, await request.json());
    return NextResponse.json({ court }, { status: 201 });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    return NextResponse.json({ court: await updateCourt(staff, await request.json()) });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
