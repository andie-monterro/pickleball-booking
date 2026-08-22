import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { staffErrorResponse } from "@/lib/staff/http";
import { readOpeningHours, setOpeningHours } from "@/lib/staff/venue-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await readStaffSession(request);
    return NextResponse.json({ openingHours: await readOpeningHours() });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const openingHours = await setOpeningHours(staff, await request.json());
    return NextResponse.json({ openingHours });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
