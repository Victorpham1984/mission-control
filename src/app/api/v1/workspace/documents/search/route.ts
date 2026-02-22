import { NextRequest } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/errors";

// POST /api/v1/workspace/documents/search — Semantic search
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError("validation_error", "Invalid JSON body");
  }

  const { query, limit = 3, type } = body;

  if (!query || typeof query !== "string") {
    return apiError("validation_error", "query is required");
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    // Fallback to keyword search if no OpenAI key
    return keywordSearch(auth.workspaceId, query, limit, type);
  }

  try {
    // Generate query embedding
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!embRes.ok) {
      // Fallback to keyword search
      console.error("Embedding generation failed, falling back to keyword search");
      return keywordSearch(auth.workspaceId, query, limit, type);
    }

    const embData = await embRes.json();
    const queryEmbedding = embData.data?.[0]?.embedding;

    if (!queryEmbedding) {
      return keywordSearch(auth.workspaceId, query, limit, type);
    }

    // Vector similarity search
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      p_workspace_id: auth.workspaceId,
      p_doc_type: type || null,
    });

    if (error) {
      console.error("Vector search failed:", error.message);
      return keywordSearch(auth.workspaceId, query, limit, type);
    }

    return apiSuccess({
      results: (data || []).map((d: Record<string, unknown>) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        content_preview: (d.content as string).slice(0, 500),
        relevance_score: d.relevance_score,
      })),
      method: "semantic",
    });
  } catch (e) {
    console.error("Semantic search error:", e);
    return keywordSearch(auth.workspaceId, query, limit, type);
  }
}

// Fallback keyword search (Week 7-8 compatible)
async function keywordSearch(
  workspaceId: string,
  query: string,
  limit: number,
  type?: string
) {
  const supabase = getServiceClient();
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let q = supabase
    .from("workspace_documents")
    .select("id, title, type, content")
    .eq("workspace_id", workspaceId)
    .limit(limit * 3); // fetch more, filter client-side

  if (type) q = q.eq("type", type);

  const { data, error } = await q;

  if (error) {
    return apiError("internal_error", "Search failed: " + error.message, 500);
  }

  // Score by keyword matches
  const scored = (data || [])
    .map((doc) => {
      const text = `${doc.title} ${doc.content}`.toLowerCase();
      const matches = keywords.filter((kw) => text.includes(kw)).length;
      return { ...doc, score: matches / Math.max(keywords.length, 1) };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return apiSuccess({
    results: scored.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      content_preview: d.content.slice(0, 500),
      relevance_score: d.score,
    })),
    method: "keyword",
  });
}
