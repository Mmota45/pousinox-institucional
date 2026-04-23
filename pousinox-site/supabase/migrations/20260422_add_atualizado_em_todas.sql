-- Adiciona coluna atualizado_em em todas as tabelas que usam set_updated_at()
-- mas foram criadas com updated_at (incompatibilidade com a função do banco).
-- O CASCADE ON DELETE SET NULL em projetos.fin_lancamento_id dispara o trigger —
-- por isso o DELETE de fin_lancamentos falha com "record new has no field atualizado_em".

ALTER TABLE projetos              ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recorrencias          ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE produtos_padrao       ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fin_categorias        ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fin_centros_custo     ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE fin_budget            ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE solicitacoes_compra   ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE docs_fiscais          ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ordens_producao       ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE inspecoes             ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE nao_conformidades     ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ativos                ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ordens_manutencao     ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE bens_frota            ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE estoque_itens         ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE estoque_inventario    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE bens_frota_manutencoes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE cotacoes_compra       ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE pedidos_compra        ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recebimentos_compra   ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
