import { NextResponse } from "next/server";
import { clock } from "@/lib/clock";
import { getPool } from "@/lib/db";

export async function GET(_request: Request): Promise<Response> {
  const time = clock.now().toISOString();
  try {
    await getPool().query("select 1");
    return NextResponse.json({ status: "ok", db: "ok", time });
  } catch {
    return NextResponse.json(
      { status: "error", db: "error", time },
      { status: 503 },
    );
  }
}
