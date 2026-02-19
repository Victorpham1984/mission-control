import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { apiError } from "./errors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface AuthContext {
  workspaceId: string;
  apiKeyId: string;
}

/**
 * Validate API key from Authorization header.
 * Returns workspace context or an error Response.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return apiError("unauthorized", "Missing or invalid Authorization header", 401);
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return apiError("unauthorized", "API key is required", 401);
  }

  // Hash the key and look it up
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const supabase = getServiceClient();
  const { data: keyRow, error } = await supabase
    .from("workspace_api_keys")
    .select("id, workspace_id, is_active")
    .eq("key_hash", keyHash)
    .single();

  if (error || !keyRow) {
    return apiError("unauthorized", "Invalid API key", 401);
  }

  if (!keyRow.is_active) {
    return apiError("unauthorized", "API key is deactivated", 401);
  }

  // Update last_used_at (fire and forget)
  supabase
    .from("workspace_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then();

  return {
    workspaceId: keyRow.workspace_id,
    apiKeyId: keyRow.id,
  };
}
