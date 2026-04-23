-- Adiciona campo origem em fin_lancamentos
-- Distingue lançamentos automáticos (vindos de vendas, NFs, projetos)
-- de lançamentos manuais (fallback operacional).
--
-- Executar APÓS 20260414_financeiro_fase1.sql

ALTER TABLE fin_lancamentos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'venda', 'nf', 'projeto', 'sistema'));

CREATE INDEX IF NOT EXISTS idx_fin_lanc_origem ON fin_lancamentos(origem);

COMMENT ON COLUMN fin_lancamentos.origem IS
  'manual = fallback operacional | venda = gerado por AdminVendas | nf = gerado por importação NFSTok | projeto = gerado por AdminProjetos | sistema = gerado por automação interna';
