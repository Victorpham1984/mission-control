import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { installPlaybookSchema } from "@/lib/validations/bizmate";

type RouteParams = { params: Promise<{ playbookId: string }> };

// POST /api/v1/playbooks/:playbookId/install — Install playbook to a company
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { playbookId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = installPlaybookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  // Verify playbook exists and is public
  const { data: playbook } = await supabase
    .from("playbooks")
    .select("id")
    .eq("id", playbookId)
    .eq("is_public", true)
    .single();

  if (!playbook) {
    return apiError("not_found", "Playbook not found", 404);
  }

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

  // Install playbook (UNIQUE constraint prevents duplicates)
  const { data: installed, error } = await supabase
    .from("installed_playbooks")
    .insert({
      company_id: parsed.data.company_id,
      playbook_id: playbookId,
      customization: parsed.data.customization,
      schedule: parsed.data.schedule,
      active: parsed.data.active,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return apiError("conflict", "Playbook already installed for this company", 409);
    }
    return apiError("internal_error", "Failed to install playbook: " + error.message, 500);
  }

  return apiSuccess({ installed_playbook: installed }, 201);
}
