import { NextResponse } from "next/server";

export function apiError(
  error: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json({ error, message, ...(details && { details }) }, { status });
}

export function apiSuccess(data: Record<string, unknown>, status: number = 200) {
  return NextResponse.json(data, { status });
}
