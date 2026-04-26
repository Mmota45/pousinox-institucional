-- Tabela centralizada de uso de IA (todas as edge functions)
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  function_name TEXT NOT NULL,
  model      TEXT NOT NULL,
  input_tokens  INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  custo_usd  NUMERIC(10,6) DEFAULT 0,
  metadata   JSONB DEFAULT '{}'
);

CREATE INDEX idx_ai_usage_fn    ON ai_usage_log (function_name, created_at);
CREATE INDEX idx_ai_usage_model ON ai_usage_log (model, created_at);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_srv ON ai_usage_log FOR ALL USING (auth.role() = 'service_role');

-- View agregada por dia/função/modelo
CREATE OR REPLACE VIEW vw_ai_usage_diario AS
SELECT
  date_trunc('day', created_at)::date AS dia,
  function_name,
  model,
  count(*)::int AS requests,
  sum(input_tokens)::int AS input_tokens,
  sum(output_tokens)::int AS output_tokens,
  sum(custo_usd)::numeric(10,4) AS custo_usd
FROM ai_usage_log
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;
