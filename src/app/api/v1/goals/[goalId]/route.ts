import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { updateGoalSchema } from "@/lib/validations/bizmate";

type RouteParams = { params: Promise<{ goalId: string }> };

// GET /api/v1/goals/:goalId — Get goal detail
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { goalId } = await params;
  const supabase = getServiceClient();

  // Join through companies to verify workspace ownership
  const { data: goal, error } = await supabase
    .from("goals")
    .select("*, companies!inner(workspace_id)")
    .eq("id", goalId)
    .eq("companies.workspace_id", auth.workspaceId)
    .eq("companies.deleted_at", null)
    .single();

  if (error || !goal) {
    return apiError("not_found", "Goal not found", 404);
  }

  // Remove join artifact
  const { companies: _, ...goalData } = goal;
  return apiSuccess({ goal: goalData });
}

// PATCH /api/v1/goals/:goalId — Update goal
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { goalId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  // Verify ownership via company join
  const { data: existing } = await supabase
    .from("goals")
    .select("id, companies!inner(workspace_id)")
    .eq("id", goalId)
    .eq("companies.workspace_id", auth.workspaceId)
    .single();

  if (!existing) {
    return apiError("not_found", "Goal not found", 404);
  }

  const { data: goal, error } = await supabase
    .from("goals")
    .update(parsed.data)
    .eq("id", goalId)
    .select()
    .single();

  if (error || !goal) {
    return apiError("internal_error", "Failed to update goal", 500);
  }

  return apiSuccess({ goal });
}

// DELETE /api/v1/goals/:goalId — Hard delete (goals don't use soft delete)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { goalId } = await params;
  const supabase = getServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("goals")
    .select("id, companies!inner(workspace_id)")
    .eq("id", goalId)
    .eq("companies.workspace_id", auth.workspaceId)
    .single();

  if (!existing) {
    return apiError("not_found", "Goal not found", 404);
  }

  const { error } = await supabase.from("goals").delete().eq("id", goalId);

  if (error) {
    return apiError("internal_error", "Failed to delete goal", 500);
  }

  return apiSuccess({ deleted: true, goal_id: goalId });
}
