import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { createGoalSchema } from "@/lib/validations/bizmate";

// POST /api/v1/goals — Create goal for a company
export async function POST(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  // Verify company belongs to this workspace
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", parsed.data.company_id)
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .single();

  if (!company) {
    return apiError("not_found", "Company not found in this workspace", 404);
  }

  const { data: goal, error } = await supabase
    .from("goals")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return apiError("internal_error", "Failed to create goal: " + error.message, 500);
  }

  return apiSuccess({ goal }, 201);
}

// GET /api/v1/goals — List goals for a company
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

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

  let query = supabase
    .from("goals")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: goals, error } = await query;

  if (error) {
    return apiError("internal_error", "Failed to list goals", 500);
  }

  return apiSuccess({ goals: goals || [], total: goals?.length || 0 });
}
