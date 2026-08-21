import { NextResponse } from "next/server";
import { readStaffSession } from "@/lib/auth/auth";
import { authErrorResponse } from "@/lib/auth/http";
import { readAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await readStaffSession(request);
    return NextResponse.json({ entries: await readAuditLog() });
  } catch (error) {
    return authErrorResponse(error);
  }
}
