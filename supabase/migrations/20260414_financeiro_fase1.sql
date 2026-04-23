-- ══════════════════════════════════════════════════════════════════════════════
-- FINANCEIRO — Fase 1
-- Migration: 20260414_financeiro_fase1.sql
--
-- O que cria:
--   fin_categorias       — plano de contas simplificado
--   fin_centros_custo    — centros de custo
--   fin_lancamentos      — documento financeiro (contas a pagar / receber)
--   fin_parcelas         — parcelas de um lançamento
--   fin_movimentacoes    — extrato operacional (caixa real)
--
-- O que altera (sem recriar):
--   clientes             — + rfm_score, rfm_segmento, rfm_calculado_em
--   projetos             — + fin_lancamento_id (FK opcional)
--   vendas               — + fin_lancamento_id (FK opcional, se coluna não existir)
--
-- Preparado para:
--   - multiempresa (campo empresa_id reservado, NULL na fase atual)
--   - auditoria (created_at, updated_at, created_by em todas as tabelas financeiras)
--   - idempotência com NF (nf_chave text — chave de acesso da NF, sem FK forçada)
--   - fin_movimentacoes representa CAIXA REAL / extrato operacional:
--     cada linha = um evento de entrada ou saída de dinheiro efetivamente ocorrido.
--     Lançamentos pendentes NÃO aparecem aqui — só o que foi liquidado.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Extensão para updated_at automático ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fin_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. fin_categorias — plano de contas simplificado
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fin_categorias (
  id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nome        text        NOT NULL,
  tipo        text        NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  grupo       text,                     -- ex: "Vendas", "Matéria-Prima", "Operacional"
  cor         text,                     -- ex: "#16a34a"
  ativo       boolean     NOT NULL DEFAULT true,

  -- multiempresa (reservado, NULL na fase atual)
  empresa_id  bigint,

  -- auditoria
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TRIGGER fin_categorias_updated_at
  BEFORE UPDATE ON fin_categorias
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at();

-- Categorias iniciais
INSERT INTO fin_categorias (nome, tipo, grupo, cor) VALUES
  ('Venda de Produto',      'receita', 'Vendas',        '#16a34a'),
  ('Serviço / Projeto',     'receita', 'Vendas',        '#22c55e'),
  ('Outros Recebimentos',   'receita', 'Outros',        '#86efac'),
  ('Matéria-Prima',         'despesa', 'Produção',      '#dc2626'),
  ('Embalagem / Insumos',   'despesa', 'Produção',      '#ef4444'),
  ('Frete',                 'despesa', 'Logística',     '#f97316'),
  ('Mão de Obra',           'despesa', 'Pessoal',       '#a855f7'),
  ('Encargos / Impostos',   'despesa', 'Fiscal',        '#7c3aed'),
  ('Aluguel / Utilidades',  'despesa', 'Operacional',   '#3b82f6'),
  ('Marketing',             'despesa', 'Operacional',   '#06b6d4'),
  ('Manutenção',            'despesa', 'Operacional',   '#64748b'),
  ('Outras Despesas',       'despesa', 'Outros',        '#94a3b8')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. fin_centros_custo
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fin_centros_custo (
  id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nome        text        NOT NULL,
  descricao   text,
  ativo       boolean     NOT NULL DEFAULT true,

  empresa_id  bigint,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TRIGGER fin_centros_custo_updated_at
  BEFORE UPDATE ON fin_centros_custo
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at();

INSERT INTO fin_centros_custo (nome, descricao) VALUES
  ('Produção',    'Custos diretos de fabricação'),
  ('Comercial',   'Vendas, marketing e prospecção'),
  ('Administrativo', 'Gestão geral e overhead'),
  ('Logística',   'Frete, transporte e entrega')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. fin_lancamentos — documento financeiro principal
--    Representa uma obrigação: contas a receber (receita) ou a pagar (despesa).
--    Pode ser parcelado (fin_parcelas) ou simples (quitado direto em fin_movimentacoes).
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fin_lancamentos (
  id                  bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tipo                text        NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  descricao           text        NOT NULL,
  valor               numeric(12,2) NOT NULL CHECK (valor > 0),

  -- Datas
  data_competencia    date        NOT NULL,   -- período de competência (quando o fato ocorreu)
  data_vencimento     date        NOT NULL,   -- quando deve ser pago/recebido
  data_pagamento      date,                   -- quando foi efetivamente quitado (null = pendente)

  -- Status
  status              text        NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'pago', 'cancelado', 'parcial')),

  -- Pagamento
  forma_pagamento     text        CHECK (forma_pagamento IN (
                        'dinheiro', 'pix', 'boleto', 'transferencia',
                        'cartao_credito', 'cartao_debito', 'cheque', 'outro'
                      )),
  condicao_pagamento  text        CHECK (condicao_pagamento IN (
                        'a_vista', 'parcelado', '7d', '14d', '21d',
                        '28d', '30d', '45d', '60d', '90d'
                      )),
  numero_parcelas     int         DEFAULT 1 CHECK (numero_parcelas >= 1),

  -- Classificação
  categoria_id        bigint      REFERENCES fin_categorias(id) ON DELETE SET NULL,
  centro_custo_id     bigint      REFERENCES fin_centros_custo(id) ON DELETE SET NULL,

  -- Vínculos com módulos existentes (todos opcionais)
  cliente_id          bigint      REFERENCES clientes(id) ON DELETE SET NULL,
  fornecedor_id       bigint      REFERENCES fornecedores(id) ON DELETE SET NULL,
  projeto_id          bigint      REFERENCES projetos(id) ON DELETE SET NULL,
  venda_ref           text,       -- referência livre à venda (evita FK frágil)
  nf_chave            text,       -- chave de acesso da NF-e (44 dígitos) — idempotência
                                  -- sem FK para não forçar importação prévia da NF

  -- Multiempresa (reservado)
  empresa_id          bigint,

  observacao          text,

  -- Auditoria
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TRIGGER fin_lancamentos_updated_at
  BEFORE UPDATE ON fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at();

-- Índices operacionais
CREATE INDEX IF NOT EXISTS idx_fin_lanc_status          ON fin_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_tipo            ON fin_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_vencimento      ON fin_lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_competencia     ON fin_lancamentos(data_competencia);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_cliente         ON fin_lancamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_fornecedor      ON fin_lancamentos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_projeto         ON fin_lancamentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_nf_chave        ON fin_lancamentos(nf_chave);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_empresa         ON fin_lancamentos(empresa_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. fin_parcelas — parcelas de um lançamento parcelado
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fin_parcelas (
  id              bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lancamento_id   bigint      NOT NULL REFERENCES fin_lancamentos(id) ON DELETE CASCADE,
  numero          int         NOT NULL CHECK (numero >= 1),
  valor           numeric(12,2) NOT NULL CHECK (valor > 0),
  vencimento      date        NOT NULL,
  pago_em         date,
  status          text        NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'pago', 'cancelado')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (lancamento_id, numero)
);

CREATE TRIGGER fin_parcelas_updated_at
  BEFORE UPDATE ON fin_parcelas
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fin_parcelas_lancamento  ON fin_parcelas(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_parcelas_vencimento  ON fin_parcelas(vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_parcelas_status      ON fin_parcelas(status);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. fin_movimentacoes — EXTRATO OPERACIONAL / CAIXA REAL
--
--    Cada linha = um evento de entrada ou saída de dinheiro EFETIVAMENTE ocorrido.
--    Lançamentos com status 'pendente' NÃO geram movimentação.
--    Quando um lançamento é marcado como 'pago', cria-se uma movimentação aqui.
--    Pode existir movimentação sem lancamento_id (ex: transferência entre contas,
--    sangria de caixa, ajuste manual).
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fin_movimentacoes (
  id              bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lancamento_id   bigint      REFERENCES fin_lancamentos(id) ON DELETE SET NULL,
  parcela_id      bigint      REFERENCES fin_parcelas(id) ON DELETE SET NULL,

  tipo            text        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor           numeric(12,2) NOT NULL CHECK (valor > 0),
  data            date        NOT NULL,
  conta           text        NOT NULL DEFAULT 'banco'
                    CHECK (conta IN ('caixa', 'banco', 'pix', 'cartao')),
  descricao       text,

  empresa_id      bigint,

  -- Auditoria
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TRIGGER fin_movimentacoes_updated_at
  BEFORE UPDATE ON fin_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fin_mov_data             ON fin_movimentacoes(data);
CREATE INDEX IF NOT EXISTS idx_fin_mov_tipo             ON fin_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_fin_mov_lancamento       ON fin_movimentacoes(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_mov_conta            ON fin_movimentacoes(conta);
CREATE INDEX IF NOT EXISTS idx_fin_mov_empresa          ON fin_movimentacoes(empresa_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. RLS — todas as tabelas financeiras: acesso restrito ao service_role
--    (mesmo padrão das tabelas de projetos e componentes)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE fin_categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_lancamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_parcelas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON fin_categorias
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all" ON fin_centros_custo
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all" ON fin_lancamentos
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all" ON fin_parcelas
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all" ON fin_movimentacoes
  USING (auth.role() = 'service_role');


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. Extensões nas tabelas existentes (sem recriar)
-- ══════════════════════════════════════════════════════════════════════════════

-- Clientes — campos RFM (Fase 2 usará esses campos para calcular segmentação)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rfm_score         int,            -- 1–5 composto
  ADD COLUMN IF NOT EXISTS rfm_recencia      int,            -- score 1–5 (dias desde última compra)
  ADD COLUMN IF NOT EXISTS rfm_frequencia    int,            -- score 1–5 (total de NFs)
  ADD COLUMN IF NOT EXISTS rfm_valor         int,            -- score 1–5 (total gasto)
  ADD COLUMN IF NOT EXISTS rfm_segmento      text,           -- VIP, Recorrente, Em Risco, Inativo, Novo
  ADD COLUMN IF NOT EXISTS rfm_calculado_em  timestamptz;    -- quando foi calculado

-- Projetos — vínculo opcional com lançamento financeiro
ALTER TABLE projetos
  ADD COLUMN IF NOT EXISTS fin_lancamento_id bigint
    REFERENCES fin_lancamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projetos_fin_lancamento
  ON projetos(fin_lancamento_id)
  WHERE fin_lancamento_id IS NOT NULL;

-- Vendas — vínculo opcional com lançamento financeiro
-- (só adiciona se a coluna ainda não existir — idempotente)
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS fin_lancamento_id bigint
    REFERENCES fin_lancamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendas_fin_lancamento
  ON vendas(fin_lancamento_id)
  WHERE fin_lancamento_id IS NOT NULL;


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. VIEW auxiliar — saldo do mês corrente (usada no painel financeiro)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_fin_saldo_mes AS
SELECT
  DATE_TRUNC('month', data_competencia)::date AS mes,
  SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END)           AS total_receitas,
  SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END)           AS total_despesas,
  SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END)      AS saldo,
  COUNT(*) FILTER (WHERE status = 'pendente')                     AS pendentes,
  SUM(valor) FILTER (WHERE status = 'pendente' AND tipo = 'receita'
                       AND data_vencimento < CURRENT_DATE)        AS vencidos_receber,
  SUM(valor) FILTER (WHERE status = 'pendente' AND tipo = 'despesa'
                       AND data_vencimento < CURRENT_DATE)        AS vencidos_pagar
FROM fin_lancamentos
WHERE status != 'cancelado'
GROUP BY DATE_TRUNC('month', data_competencia)
ORDER BY mes DESC;
