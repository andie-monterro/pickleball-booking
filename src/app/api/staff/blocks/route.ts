import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { placeBlock, removeBlock } from "@/lib/staff/blocks";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const block = await placeBlock(staff, await request.json());
    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    return NextResponse.json({ block: await removeBlock(staff, await request.json()) });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
