import { NextResponse } from "next/server";
import { sessionCookieValue, verifyOtp } from "@/lib/auth/auth";
import { authErrorResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const { player, sessionToken } = await verifyOtp(await request.json());
    return NextResponse.json(
      { player },
      {
        headers: { "set-cookie": sessionCookieValue(sessionToken) },
      },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
