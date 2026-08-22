import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { staffErrorResponse } from "@/lib/staff/http";
import { setMemberUntil } from "@/lib/staff/players";

export const dynamic = "force-dynamic";

export async function PUT(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const player = await setMemberUntil(staff, await request.json());
    return NextResponse.json({ player });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
