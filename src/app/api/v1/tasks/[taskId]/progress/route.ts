import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/tasks/:taskId/progress
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

  // TODO Week 2: Validate agent owns this task
  await supabase
    .from("task_queue")
    .update({
      progress_percent: body.progress_percent ?? 0,
      status_message: body.status_message || null,
    })
    .eq("id", taskId)
    .eq("workspace_id", auth.workspaceId);

  return apiSuccess({ ack: true });
}
