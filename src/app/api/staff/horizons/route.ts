import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { staffErrorResponse } from "@/lib/staff/http";
import { readHorizonSettings, setHorizonSettings } from "@/lib/staff/venue-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await readStaffSession(request);
    return NextResponse.json({ horizons: await readHorizonSettings() });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const horizons = await setHorizonSettings(staff, await request.json());
    return NextResponse.json({ horizons });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
