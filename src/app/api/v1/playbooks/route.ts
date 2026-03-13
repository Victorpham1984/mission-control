import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/playbooks — List public playbooks (marketplace browse)
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  let query = supabase
    .from("playbooks")
    .select("*")
    .eq("is_public", true)
    .order("install_count", { ascending: false })
    .order("name")
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data: playbooks, error } = await query;

  if (error) {
    return apiError("internal_error", "Failed to list playbooks", 500);
  }

  return apiSuccess({ playbooks: playbooks || [], total: playbooks?.length || 0 });
}
