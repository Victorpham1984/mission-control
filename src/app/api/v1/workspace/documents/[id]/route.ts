import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/v1/workspace/documents/:id
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("workspace_documents")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (error || !data) {
    return apiError("not_found", "Document not found", 404);
  }

  return apiSuccess(data);
}

// DELETE /api/v1/workspace/documents/:id
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("workspace_documents")
    .delete()
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return apiError("internal_error", "Failed to delete: " + error.message, 500);
  }

  return apiSuccess({ deleted: true });
}
