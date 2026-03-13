import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/installed-playbooks — List installed playbooks for a company
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  if (!companyId) {
    return apiError("validation_error", "company_id query parameter is required");
  }

  // Verify company belongs to this workspace
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .single();

  if (!company) {
    return apiError("not_found", "Company not found in this workspace", 404);
  }

  const { data: installed, error } = await supabase
    .from("installed_playbooks")
    .select("*, playbooks(id, name, category, description)")
    .eq("company_id", companyId)
    .order("installed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return apiError("internal_error", "Failed to list installed playbooks", 500);
  }

  return apiSuccess({ installed_playbooks: installed || [], total: installed?.length || 0 });
}
