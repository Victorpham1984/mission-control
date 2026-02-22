import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/v1/workspace/documents/:id/embed — Generate embeddings
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return apiError("config_error", "OPENAI_API_KEY not configured", 500);
  }

  const supabase = getServiceClient();

  const { data: doc, error } = await supabase
    .from("workspace_documents")
    .select("id, content")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (error || !doc) {
    return apiError("not_found", "Document not found", 404);
  }

  // Generate embedding
  const embRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: doc.content.slice(0, 8000),
    }),
  });

  if (!embRes.ok) {
    const errText = await embRes.text().catch(() => "");
    return apiError("embedding_error", `Failed to generate embedding: ${errText.slice(0, 200)}`, 502);
  }

  const embData = await embRes.json();
  const embedding = embData.data?.[0]?.embedding;

  if (!embedding) {
    return apiError("embedding_error", "No embedding returned", 500);
  }

  // Store embedding
  const { error: updateError } = await supabase
    .from("workspace_documents")
    .update({ embeddings: embedding })
    .eq("id", id);

  if (updateError) {
    return apiError("internal_error", "Failed to store embedding: " + updateError.message, 500);
  }

  return apiSuccess({ success: true, document_id: id, dimensions: embedding.length });
}
