import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

const VALID_TYPES = ["brand_guideline", "product_catalog", "style_guide", "other"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// GET /api/v1/workspace/documents — List documents
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const supabase = getServiceClient();

  let query = supabase
    .from("workspace_documents")
    .select("id, title, type, file_size_bytes, mime_type, tags, created_at, updated_at", {
      count: "exact",
    })
    .eq("workspace_id", auth.workspaceId)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (type && VALID_TYPES.includes(type)) {
    query = query.eq("type", type);
  }

  const { data, error, count } = await query;

  if (error) {
    return apiError("internal_error", "Failed to list documents: " + error.message, 500);
  }

  return apiSuccess({ documents: data || [], total: count || 0 });
}

// POST /api/v1/workspace/documents — Upload document (JSON body)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  if (!body.title || !body.type || !body.content) {
    return apiError("validation_error", "title, type, and content are required");
  }

  if (!VALID_TYPES.includes(body.type)) {
    return apiError("validation_error", `type must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const contentBytes = new TextEncoder().encode(body.content).length;
  if (contentBytes > MAX_FILE_SIZE) {
    return apiError("validation_error", "Content too large (max 10MB)");
  }

  // Check workspace doc count limit (max 50)
  const supabase = getServiceClient();
  const { count } = await supabase
    .from("workspace_documents")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId);

  if ((count || 0) >= 50) {
    return apiError("limit_exceeded", "Maximum 50 documents per workspace", 429);
  }

  const { data, error } = await supabase
    .from("workspace_documents")
    .insert({
      workspace_id: auth.workspaceId,
      title: body.title,
      type: body.type,
      content: body.content,
      file_size_bytes: contentBytes,
      mime_type: body.mime_type || "text/plain",
      tags: body.tags || [],
      uploaded_by: auth.userId || null,
    })
    .select()
    .single();

  if (error) {
    return apiError("internal_error", "Failed to upload: " + error.message, 500);
  }

  return apiSuccess({ document: data }, 201);
}
