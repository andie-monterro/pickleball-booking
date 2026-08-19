import { NextResponse } from "next/server";
import { requestSignInCode } from "@/lib/auth/auth";
import { authErrorResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return NextResponse.json(await requestSignInCode(await request.json()), {
      status: 202,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
