import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import {
  createStaffAccount,
  deactivateStaffAccount,
  readStaffAccounts,
} from "@/lib/staff/accounts";
import { staffErrorResponse } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await readStaffSession(request);
    return NextResponse.json({ accounts: await readStaffAccounts() });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const account = await createStaffAccount(staff, await request.json());
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return staffErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const staff = await readStaffSession(request);
    const account = await deactivateStaffAccount(staff, await request.json());
    return NextResponse.json({ account });
  } catch (error) {
    return staffErrorResponse(error);
  }
}
