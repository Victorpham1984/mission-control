import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { apiError } from "./errors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Create a Supabase client that reads cookies from the NextRequest.
 * This properly handles @supabase/ssr cookie formats (chunked, base64, etc.)
 */
function createRequestClient(req: NextRequest) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // API routes don't need to set cookies
      },
    },
  });
}

export interface AuthContext {
  workspaceId: string;
  apiKeyId?: string;
  userId?: string;
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

/**
 * Authenticate either via API key OR user session.
 * Supports both agents (API key) and humans (browser session).
 * Returns workspace context or an error Response.
 */
export async function authenticateUserOrApiKey(
  req: NextRequest
): Promise<AuthContext | Response> {
  const supabase = getServiceClient();
  
  // First, try API key auth (for agents)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    if (apiKey) {
      // Hash and lookup API key
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: keyRow, error } = await supabase
        .from("workspace_api_keys")
        .select("id, workspace_id, is_active")
        .eq("key_hash", keyHash)
        .single();

      if (!error && keyRow && keyRow.is_active) {
        // Valid API key
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
    }
  }

  // If API key failed/missing, try user session (for UI)
  // Use @supabase/ssr to properly read session from cookies
  const requestClient = createRequestClient(req);
  
  const { data: { user }, error: userError } = await requestClient.auth.getUser();
  if (userError || !user) {
    return apiError("unauthorized", "Invalid or expired session", 401);
  }

  // Get workspace from user's profile (use service client for RLS bypass)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();

  if (!workspace) {
    return apiError("unauthorized", "No workspace found for user", 404);
  }

  return {
    workspaceId: workspace.id,
    userId: user.id,
  };
}
