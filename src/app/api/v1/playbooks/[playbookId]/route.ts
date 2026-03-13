import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ playbookId: string }> };

// GET /api/v1/playbooks/:playbookId — Get playbook detail
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { playbookId } = await params;
  const supabase = getServiceClient();

  const { data: playbook, error } = await supabase
    .from("playbooks")
    .select("*")
    .eq("id", playbookId)
    .eq("is_public", true)
    .single();

  if (error || !playbook) {
    return apiError("not_found", "Playbook not found", 404);
  }

  return apiSuccess({ playbook });
}
