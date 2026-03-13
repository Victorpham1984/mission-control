import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { createCompanySchema } from "@/lib/validations/bizmate";

// POST /api/v1/companies — Create company (1:1 per workspace)
export async function POST(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  // Check if workspace already has a company (1:1 constraint)
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .single();

  if (existing) {
    return apiError(
      "conflict",
      "Workspace already has a company. Use PATCH to update.",
      409
    );
  }

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      workspace_id: auth.workspaceId,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) {
    return apiError("internal_error", "Failed to create company: " + error.message, 500);
  }

  return apiSuccess({ company }, 201);
}

// GET /api/v1/companies — Get company for current workspace
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .is("deleted_at", null)
    .single();

  if (error || !company) {
    return apiError("not_found", "No company found for this workspace", 404);
  }

  return apiSuccess({ company });
}
