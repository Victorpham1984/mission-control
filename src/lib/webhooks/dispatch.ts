import { getServiceClient } from "@/lib/api/auth";
import { WebhookEventType, WebhookPayload } from "./types";

/**
 * Sign a payload with HMAC-SHA256.
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

/**
 * Dispatch webhook event to all active webhooks for a workspace.
 * Fire-and-forget with 5s timeout per request.
 */
export async function dispatchWebhookEvent(
  workspaceId: string,
  event: WebhookEventType,
  taskData: WebhookPayload["data"]
): Promise<void> {
  const supabase = getServiceClient();

  // Query active webhooks matching this event
  const { data: webhooks, error } = await supabase
    .from("webhooks")
    .select("id, url, secret, events")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (error || !webhooks || webhooks.length === 0) return;

  // Filter webhooks that subscribe to this event
  const matching = webhooks.filter(
    (w: { events: string[] }) => w.events.includes(event) || w.events.includes("*")
  );
  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data: taskData,
  };

  const body = JSON.stringify(payload);

  // Fire-and-forget all webhook deliveries
  const deliveries = matching.map(async (webhook: { id: string; url: string; secret: string | null }) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-CommandMate-Event": event,
      };

      if (webhook.secret) {
        headers["X-CommandMate-Signature"] = await signPayload(body, webhook.secret);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Log delivery (best-effort)
      await supabase.from("webhook_logs").insert({
        webhook_id: webhook.id,
        event,
        payload: payload,
        status_code: response.status,
        success: response.ok,
      }).then();
    } catch (err) {
      // Log failure (best-effort)
      await supabase.from("webhook_logs").insert({
        webhook_id: webhook.id,
        event,
        payload: payload,
        status_code: null,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }).then();
    }
  });

  // Don't await — fire and forget
  Promise.allSettled(deliveries).catch(() => {});
}
