import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { waiveStrike } from "@/lib/staff/strikes";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    return NextResponse.json(await waiveStrike(staff, await request.json()), {
      status: 201,
    });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
