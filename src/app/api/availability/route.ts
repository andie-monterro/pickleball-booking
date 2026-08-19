import { NextResponse } from "next/server";
import { readAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;

  try {
    return NextResponse.json(await readAvailability(date));
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
