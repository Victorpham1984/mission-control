import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { NotificationService, NotificationEvent } from "@/lib/notifications";

const VALID_EVENTS: NotificationEvent[] = ["completed", "pending_approval", "failed_permanent"];

// POST /api/v1/notifications/send
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  if (!body.task_id) {
    return apiError("validation_error", "task_id is required");
  }
  if (!body.event || !VALID_EVENTS.includes(body.event)) {
    return apiError("validation_error", `event must be one of: ${VALID_EVENTS.join(", ")}`);
  }

  const supabase = getServiceClient();
  const service = new NotificationService(supabase);
  const result = await service.notifyTaskEvent(body.task_id, body.event, auth.workspaceId);

  if (!result.success) {
    return apiError("notification_failed", result.error || "Failed to send notification", 500);
  }

  return apiSuccess({
    notification_sent: true,
    external_id: result.externalId || null,
  });
}
