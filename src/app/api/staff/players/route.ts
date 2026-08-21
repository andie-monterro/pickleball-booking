import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { readDeskPlayers } from "@/lib/staff/players";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const search = new URL(request.url).searchParams.get("search") ?? undefined;
  try {
    await readStaffSession(request);
    return NextResponse.json({ players: await readDeskPlayers(search) });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
