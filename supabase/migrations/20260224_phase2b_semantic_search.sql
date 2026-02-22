-- Phase 2B Week 9: Semantic Search (pgvector)
-- Created: 2026-02-22 by Thép ⚙️

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embeddings column to workspace_documents
ALTER TABLE public.workspace_documents
  ADD COLUMN IF NOT EXISTS embeddings VECTOR(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_workspace_docs_embeddings
  ON public.workspace_documents
  USING hnsw (embeddings vector_cosine_ops);

-- Similarity search function
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3,
  p_workspace_id UUID DEFAULT NULL,
  p_doc_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  type TEXT,
  content TEXT,
  relevance_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wd.id,
    wd.title,
    wd.type,
    wd.content,
    (1 - (wd.embeddings <=> query_embedding))::FLOAT AS relevance_score
  FROM public.workspace_documents wd
  WHERE wd.embeddings IS NOT NULL
    AND (p_workspace_id IS NULL OR wd.workspace_id = p_workspace_id)
    AND (p_doc_type IS NULL OR wd.type = p_doc_type)
    AND 1 - (wd.embeddings <=> query_embedding) > match_threshold
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$;
