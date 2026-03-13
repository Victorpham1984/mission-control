import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { updateInstalledPlaybookSchema } from "@/lib/validations/bizmate";

type RouteParams = { params: Promise<{ installedId: string }> };

// GET /api/v1/installed-playbooks/:installedId — Get installed playbook detail
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { installedId } = await params;
  const supabase = getServiceClient();

  const { data: installed, error } = await supabase
    .from("installed_playbooks")
    .select("*, playbooks(*), companies!inner(workspace_id)")
    .eq("id", installedId)
    .eq("companies.workspace_id", auth.workspaceId)
    .single();

  if (error || !installed) {
    return apiError("not_found", "Installed playbook not found", 404);
  }

  const { companies: _, ...installedData } = installed;
  return apiSuccess({ installed_playbook: installedData });
}

// PATCH /api/v1/installed-playbooks/:installedId — Update installed playbook
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { installedId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const parsed = updateInstalledPlaybookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", parsed.error.issues[0].message, 400, {
      issues: parsed.error.issues,
    });
  }

  const supabase = getServiceClient();

  // Verify ownership via company join
  const { data: existing } = await supabase
    .from("installed_playbooks")
    .select("id, companies!inner(workspace_id)")
    .eq("id", installedId)
    .eq("companies.workspace_id", auth.workspaceId)
    .single();

  if (!existing) {
    return apiError("not_found", "Installed playbook not found", 404);
  }

  const { data: installed, error } = await supabase
    .from("installed_playbooks")
    .update(parsed.data)
    .eq("id", installedId)
    .select()
    .single();

  if (error || !installed) {
    return apiError("internal_error", "Failed to update installed playbook", 500);
  }

  return apiSuccess({ installed_playbook: installed });
}
