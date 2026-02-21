import { NextRequest } from "next/server";
import { authenticateUserOrApiKey, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

const VALID_CHANNELS = ["dashboard", "telegram", "zalo", "email"];

// GET /api/v1/users/preferences
export async function GET(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  if (!auth.userId) {
    return apiError("unauthorized", "User session required for preferences", 401);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_channel, telegram_chat_id, notification_settings")
    .eq("id", auth.userId)
    .single();

  if (error || !data) {
    return apiError("not_found", "User profile not found", 404);
  }

  return apiSuccess({
    preferred_channel: data.preferred_channel || "dashboard",
    telegram_chat_id: data.telegram_chat_id || null,
    notification_settings: data.notification_settings || {
      task_completed: true,
      task_approval_needed: true,
      task_failed: true,
    },
  });
}

// PATCH /api/v1/users/preferences
export async function PATCH(req: NextRequest) {
  const auth = await authenticateUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  if (!auth.userId) {
    return apiError("unauthorized", "User session required for preferences", 401);
  }

  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  const updateData: Record<string, unknown> = {};

  if (body.preferred_channel !== undefined) {
    if (!VALID_CHANNELS.includes(body.preferred_channel)) {
      return apiError("validation_error", `preferred_channel must be one of: ${VALID_CHANNELS.join(", ")}`);
    }
    updateData.preferred_channel = body.preferred_channel;
  }

  if (body.telegram_chat_id !== undefined) {
    updateData.telegram_chat_id = body.telegram_chat_id;
  }

  if (body.notification_settings !== undefined) {
    if (typeof body.notification_settings !== "object") {
      return apiError("validation_error", "notification_settings must be a JSON object");
    }
    updateData.notification_settings = body.notification_settings;
  }

  if (Object.keys(updateData).length === 0) {
    return apiError("validation_error", "No valid fields to update");
  }

  updateData.updated_at = new Date().toISOString();

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", auth.userId);

  if (error) {
    return apiError("update_failed", error.message, 500);
  }

  return apiSuccess({ updated: true, ...updateData });
}
