import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  throw error;
}
