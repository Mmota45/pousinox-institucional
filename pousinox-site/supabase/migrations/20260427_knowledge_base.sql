-- Base de conhecimento para RAG (catálogos, normas, manuais)
-- Requer extensão pgvector já habilitada (usada por projeto_embeddings)

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  source_file TEXT NOT NULL,
  storage_path TEXT,
  chunk_index INT DEFAULT 0,
  content     TEXT NOT NULL,
  embedding   vector(768),
  metadata    JSONB DEFAULT '{}'
);

CREATE INDEX idx_kc_source ON knowledge_chunks (source_file);
CREATE INDEX idx_kc_emb ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY kc_srv ON knowledge_chunks FOR ALL USING (auth.role() = 'service_role');

-- RPC para busca semântica
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (id BIGINT, content TEXT, source_file TEXT, similarity FLOAT)
LANGUAGE sql STABLE
AS $$
  SELECT id, content, source_file,
         1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
