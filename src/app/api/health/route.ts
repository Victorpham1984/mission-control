import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, string> = {};

  // Check Supabase connectivity
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    // Simple query to verify DB is reachable
    const { error } = await supabase.from("tasks").select("id").limit(1);
    checks.database = error ? `error: ${error.message}` : "ok";
  } catch (e) {
    checks.database = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  const responseTimeMs = Date.now() - start;
  const allOk = Object.values(checks).every((v) => v === "ok");

  const body = {
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    responseTimeMs,
    checks,
  };

  return NextResponse.json(body, {
    status: allOk && responseTimeMs < 2000 ? 200 : 503,
  });
}
