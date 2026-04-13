-- ============================================================
-- FASE 5 ETAPA 3 — Habilitar shadow mode
-- Execute APÓS o deploy do frontend e da Edge Function
-- ============================================================

-- Habilita o shadow mode
UPDATE feature_flags
   SET habilitado     = true,
       atualizado_em  = now(),
       atualizado_por = 'admin'
 WHERE flag = 'vector_similarity_shadow';

-- Confirmação
SELECT flag, habilitado, config->>'modelo' AS modelo, config->>'dims' AS dims
FROM feature_flags
WHERE flag = 'vector_similarity_shadow';
