import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/actions — List actions (filtered by company, playbook run, or installed playbook)
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const installedPlaybookId = url.searchParams.get("installed_playbook_id");
  const playbookRunId = url.searchParams.get("playbook_run_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  if (!companyId) {
    return apiError("validation_error", "company_id query parameter is required");
  }

  const supabase = getServiceClient();

  // Verify company belongs to workspace
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (!company) {
    return apiError("not_found", "Company not found in this workspace", 404);
  }

  let query = supabase
    .from("actions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (installedPlaybookId) {
    query = query.eq("installed_playbook_id", installedPlaybookId);
  }

  if (playbookRunId) {
    query = query.contains("evidence", { playbook_run_id: playbookRunId });
  }

  const { data: actions, error } = await query;

  if (error) {
    return apiError("internal_error", "Failed to fetch actions", 500);
  }

  return apiSuccess({ actions: actions || [], total: actions?.length || 0 });
}
