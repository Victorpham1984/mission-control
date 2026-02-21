import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// GET /api/v1/webhooks/config — List webhooks for workspace
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const supabase = getServiceClient();
  const { data: webhooks, error } = await supabase
    .from("webhooks")
    .select("id, url, events, is_active, description, created_at, updated_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return apiError("internal_error", "Failed to list webhooks", 500);
  }

  return apiSuccess({ webhooks: webhooks || [] });
}

// POST /api/v1/webhooks/config — Create webhook
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  if (!body.url) {
    return apiError("validation_error", "url is required");
  }
  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return apiError("validation_error", "events array is required and must not be empty");
  }

  // Auto-generate secret if not provided
  const secret = body.secret || crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  const supabase = getServiceClient();
  const { data: webhook, error } = await supabase
    .from("webhooks")
    .insert({
      workspace_id: auth.workspaceId,
      url: body.url,
      secret,
      events: body.events,
      description: body.description || null,
    })
    .select("id, url, events, is_active, description, secret, created_at")
    .single();

  if (error) {
    return apiError("internal_error", "Failed to create webhook: " + error.message, 500);
  }

  return apiSuccess({ webhook }, 201);
}

// PATCH /api/v1/webhooks/config — Update webhook
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  if (!body.id) {
    return apiError("validation_error", "webhook id is required");
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.url !== undefined) updates.url = body.url;
  if (body.events !== undefined) updates.events = body.events;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.description !== undefined) updates.description = body.description;

  const supabase = getServiceClient();
  const { data: webhook, error } = await supabase
    .from("webhooks")
    .update(updates)
    .eq("id", body.id)
    .eq("workspace_id", auth.workspaceId)
    .select("id, url, events, is_active, description, updated_at")
    .single();

  if (error) {
    return apiError("internal_error", "Failed to update webhook: " + error.message, 500);
  }

  return apiSuccess({ webhook });
}

// DELETE /api/v1/webhooks/config — Remove webhook
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return apiError("validation_error", "Invalid JSON body"); }

  if (!body.id) {
    return apiError("validation_error", "webhook id is required");
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", body.id)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return apiError("internal_error", "Failed to delete webhook: " + error.message, 500);
  }

  return apiSuccess({ deleted: true });
}
