import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { tool, action, args } = await req.json();
    const gwUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
    const gwToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";

    const res = await fetch(`${gwUrl}/tools/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gwToken}`,
      },
      body: JSON.stringify({ tool, action, args }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
