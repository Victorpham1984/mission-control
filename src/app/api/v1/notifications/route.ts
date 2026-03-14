import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/notifications — List notification log entries for workspace owner
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  const supabase = getServiceClient();

  // Get workspace owner
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", auth.workspaceId)
    .single();

  if (!workspace) {
    return apiError("not_found", "Workspace not found", 404);
  }

  const { data: notifications, error } = await supabase
    .from("notification_log")
    .select("*")
    .eq("user_id", workspace.owner_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return apiError("internal_error", "Failed to fetch notifications", 500);
  }

  return apiSuccess({ notifications: notifications || [], total: notifications?.length || 0 });
}
