import { NextResponse } from "next/server";
import { requestSignupCode } from "@/lib/auth/auth";
import { authErrorResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return NextResponse.json(await requestSignupCode(await request.json()), {
      status: 202,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
