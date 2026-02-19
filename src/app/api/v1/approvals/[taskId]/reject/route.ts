import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/approvals/:taskId/reject
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

  // TODO Week 3: Revise/reassign/cancel logic
  const action = body.action || "revise";
  let newStatus = "queued";
  if (action === "cancel") newStatus = "cancelled";

  await supabase
    .from("task_queue")
    .update({
      status: newStatus,
      approval_status: "rejected",
      approval_feedback: body.feedback || null,
      assigned_agent_id: action === "reassign" ? null : undefined,
    })
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId);

  return apiSuccess({ task_id: taskId, status: newStatus, action });
}
