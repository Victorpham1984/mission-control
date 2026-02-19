import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/approvals/:taskId/approve
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const { taskId } = await params;
  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  const supabase = getServiceClient();

  // TODO Week 3: Full approval with notifications
  const now = new Date().toISOString();
  await supabase
    .from("task_queue")
    .update({
      status: "completed",
      approval_status: "approved",
      approval_rating: body.rating || null,
      approval_feedback: body.comment || null,
      approved_at: now,
    })
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId);

  return apiSuccess({ task_id: taskId, status: "completed", approved_at: now });
}
