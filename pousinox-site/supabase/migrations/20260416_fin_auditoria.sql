-- ============================================================
-- Fase 3 — fin_movimentacoes_log: auditoria completa
-- Módulo Fluxo de Caixa v2
-- ============================================================

-- ── 1. Tabela de log ──────────────────────────────────────────

CREATE TABLE fin_movimentacoes_log (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movimentacao_id  BIGINT      NOT NULL,   -- sem FK — preserva histórico mesmo após DELETE
  operacao         TEXT        NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  dados_antes      JSONB,                  -- NULL em INSERT
  dados_depois     JSONB,                  -- NULL em DELETE
  usuario          TEXT,                   -- auth.uid() ou identificador de sessão
  em               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fin_movimentacoes_log IS
  'Auditoria imutável de fin_movimentacoes. '
  'Sem FK em movimentacao_id para preservar histórico mesmo se a movimentação for deletada.';

COMMENT ON COLUMN fin_movimentacoes_log.dados_antes  IS 'Estado anterior da linha (UPDATE/DELETE). NULL em INSERT.';
COMMENT ON COLUMN fin_movimentacoes_log.dados_depois IS 'Estado novo da linha (INSERT/UPDATE). NULL em DELETE.';

-- ── 2. Índices ────────────────────────────────────────────────

CREATE INDEX idx_fin_mov_log_movimentacao ON fin_movimentacoes_log (movimentacao_id);
CREATE INDEX idx_fin_mov_log_em           ON fin_movimentacoes_log (em DESC);
CREATE INDEX idx_fin_mov_log_operacao     ON fin_movimentacoes_log (operacao);

-- ── 3. RLS — somente leitura via service_role; escrita só via trigger ──

ALTER TABLE fin_movimentacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_mov_log_leitura ON fin_movimentacoes_log
  FOR SELECT USING (auth.role() = 'service_role');

-- Sem policy de INSERT/UPDATE/DELETE para usuários — apenas o trigger escreve

-- ── 4. Função de trigger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_fin_movimentacoes_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO fin_movimentacoes_log (movimentacao_id, operacao, dados_antes, dados_depois, usuario)
    VALUES (NEW.id, 'INSERT', NULL, to_jsonb(NEW), current_user);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Só loga se houve mudança real (evita logs de updated_at puro)
    IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      INSERT INTO fin_movimentacoes_log (movimentacao_id, operacao, dados_antes, dados_depois, usuario)
      VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO fin_movimentacoes_log (movimentacao_id, operacao, dados_antes, dados_depois, usuario)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NULL, current_user);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION fn_fin_movimentacoes_audit IS
  'Trigger de auditoria para fin_movimentacoes. '
  'Em UPDATE, só grava se houve mudança real (ignora refreshes de updated_at).';

-- ── 5. Trigger ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_fin_movimentacoes_audit ON fin_movimentacoes;

CREATE TRIGGER trg_fin_movimentacoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON fin_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_fin_movimentacoes_audit();

-- ── 6. View: histórico de uma movimentação ────────────────────

CREATE OR REPLACE VIEW vw_fin_movimentacoes_historico AS
SELECT
  l.id,
  l.movimentacao_id,
  l.operacao,
  l.em,
  l.usuario,
  l.dados_antes  ->> 'valor'  AS valor_antes,
  l.dados_depois ->> 'valor'  AS valor_depois,
  l.dados_antes  ->> 'status' AS status_antes,
  l.dados_depois ->> 'status' AS status_depois,
  l.dados_antes  ->> 'conciliado' AS conciliado_antes,
  l.dados_depois ->> 'conciliado' AS conciliado_depois,
  l.dados_antes,
  l.dados_depois
FROM fin_movimentacoes_log l
ORDER BY l.em DESC;

COMMENT ON VIEW vw_fin_movimentacoes_historico IS
  'Histórico de alterações de movimentações com campos mais consultados extraídos do JSONB';
