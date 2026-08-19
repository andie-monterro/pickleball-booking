import { NextResponse } from "next/server";
import { readPlayerSession } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const player = await readPlayerSession(request);
  if (!player) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ player });
}
