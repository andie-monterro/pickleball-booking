import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { StrikeError, readPlayerStrikes } from "@/lib/staff/strikes";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const playerId = new URL(request.url).searchParams.get("playerId");
  try {
    await readStaffSession(request);
    if (!playerId) {
      throw new StrikeError("invalid_request", 400);
    }
    return NextResponse.json({ strikes: await readPlayerStrikes(playerId) });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
