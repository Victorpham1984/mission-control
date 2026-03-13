import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { updateCompanySchema } from "@/lib/validations/bizmate";

type RouteParams = { params: Promise<{ companyId: string }> };

// GET /api/v1/companies/:companyId — Get company detail
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { companyId } = await params;
  const supabase = getServiceClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .single();

  if (error || !company) {
    return apiError("not_found", "Company not found", 404);
  }

  return apiSuccess({ company });
}

// PATCH /api/v1/companies/:companyId — Update company
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { companyId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  const { data: company, error } = await supabase
    .from("companies")
    .update(parsed.data)
    .eq("id", companyId)
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error || !company) {
    return apiError("not_found", "Company not found or update failed", 404);
  }

  return apiSuccess({ company });
}

// DELETE /api/v1/companies/:companyId — Soft delete
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { companyId } = await params;
  const supabase = getServiceClient();

  const { data: company, error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", companyId)
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error || !company) {
    return apiError("not_found", "Company not found", 404);
  }

  return apiSuccess({ deleted: true, company_id: company.id });
}
