import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { readStaffSchedule } from "@/lib/staff/schedule";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  try {
    await readStaffSession(request);
    return NextResponse.json(await readStaffSchedule(date));
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return staffErrorResponse(error);
  }
}
