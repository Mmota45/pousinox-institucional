-- Adiciona coluna atualizado_em nas tabelas financeiras que usam set_updated_at()
-- mas foram criadas com updated_at (incompatibilidade com a função do banco)

ALTER TABLE fin_lancamentos    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fin_movimentacoes  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fin_parcelas       ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Recria os triggers para disparar set_updated_at() corretamente
DROP TRIGGER IF EXISTS fin_lancamentos_updated_at   ON fin_lancamentos;
DROP TRIGGER IF EXISTS fin_movimentacoes_updated_at ON fin_movimentacoes;
DROP TRIGGER IF EXISTS fin_parcelas_updated_at      ON fin_parcelas;

CREATE TRIGGER fin_lancamentos_updated_at
  BEFORE UPDATE ON fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fin_movimentacoes_updated_at
  BEFORE UPDATE ON fin_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fin_parcelas_updated_at
  BEFORE UPDATE ON fin_parcelas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
