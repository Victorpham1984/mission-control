import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { updateKpiSchema } from "@/lib/validations/bizmate";

type RouteParams = { params: Promise<{ kpiId: string }> };

// GET /api/v1/kpis/:kpiId — Get KPI detail
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { kpiId } = await params;
  const supabase = getServiceClient();

  const { data: kpi, error } = await supabase
    .from("kpis")
    .select("*, companies!inner(workspace_id)")
    .eq("id", kpiId)
    .eq("companies.workspace_id", auth.workspaceId)
    .eq("companies.deleted_at", null)
    .single();

  if (error || !kpi) {
    return apiError("not_found", "KPI not found", 404);
  }

  const { companies: _, ...kpiData } = kpi;
  return apiSuccess({ kpi: kpiData });
}

// PATCH /api/v1/kpis/:kpiId — Update KPI values
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { kpiId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = updateKpiSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  // Verify ownership via company join
  const { data: existing } = await supabase
    .from("kpis")
    .select("id, companies!inner(workspace_id)")
    .eq("id", kpiId)
    .eq("companies.workspace_id", auth.workspaceId)
    .single();

  if (!existing) {
    return apiError("not_found", "KPI not found", 404);
  }

  const { data: kpi, error } = await supabase
    .from("kpis")
    .update(parsed.data)
    .eq("id", kpiId)
    .select()
    .single();

  if (error || !kpi) {
    return apiError("internal_error", "Failed to update KPI", 500);
  }

  return apiSuccess({ kpi });
}

// DELETE /api/v1/kpis/:kpiId — Hard delete
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { kpiId } = await params;
  const supabase = getServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("kpis")
    .select("id, companies!inner(workspace_id)")
    .eq("id", kpiId)
    .eq("companies.workspace_id", auth.workspaceId)
    .single();

  if (!existing) {
    return apiError("not_found", "KPI not found", 404);
  }

  const { error } = await supabase.from("kpis").delete().eq("id", kpiId);

  if (error) {
    return apiError("internal_error", "Failed to delete KPI", 500);
  }

  return apiSuccess({ deleted: true, kpi_id: kpiId });
}
