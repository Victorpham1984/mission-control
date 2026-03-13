import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { createKpiSchema } from "@/lib/validations/bizmate";

// POST /api/v1/kpis — Create KPI for a company
export async function POST(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = createKpiSchema.safeParse(body);
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

  // Verify goal belongs to same company (if provided)
  if (parsed.data.goal_id) {
    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", parsed.data.goal_id)
      .eq("company_id", parsed.data.company_id)
      .single();

    if (!goal) {
      return apiError("not_found", "Goal not found for this company", 404);
    }
  }

  const { data: kpi, error } = await supabase
    .from("kpis")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return apiError("internal_error", "Failed to create KPI: " + error.message, 500);
  }

  return apiSuccess({ kpi }, 201);
}

// GET /api/v1/kpis — List KPIs (filter by company_id, goal_id, category)
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const goalId = url.searchParams.get("goal_id");
  const category = url.searchParams.get("category");
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

  let query = supabase
    .from("kpis")
    .select("*")
    .eq("company_id", companyId)
    .order("category")
    .order("name")
    .limit(limit);

  if (goalId) {
    query = query.eq("goal_id", goalId);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: kpis, error } = await query;

  if (error) {
    return apiError("internal_error", "Failed to list KPIs", 500);
  }

  return apiSuccess({ kpis: kpis || [], total: kpis?.length || 0 });
}
