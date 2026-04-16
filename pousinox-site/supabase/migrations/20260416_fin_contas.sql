-- ============================================================
-- Fase 0 — fin_contas: contas bancárias e carteiras
-- Módulo Fluxo de Caixa v2
-- ============================================================

-- ── 1. Tabela principal ───────────────────────────────────────

CREATE TABLE fin_contas (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Identificação
  nome              TEXT        NOT NULL,                        -- "Bradesco PJ", "Caixa Carteira"
  banco             TEXT,                                        -- Nome do banco (livre)
  agencia           TEXT,
  conta             TEXT,                                        -- Número da conta (mascarado na UI)

  -- Classificação
  tipo              TEXT        NOT NULL
                    CHECK (tipo IN ('corrente','poupanca','carteira','cartao','investimento')),
  negocio           TEXT        NOT NULL
                    CHECK (negocio IN ('pousinox','mp','pouso_inox')),

  -- Saldo de abertura (base para cálculo do saldo atual)
  saldo_inicial     NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_inicial_em  DATE          NOT NULL DEFAULT CURRENT_DATE,

  -- Controle
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  fin_contas IS 'Contas bancárias, carteiras e caixas — referência para fin_movimentacoes';
COMMENT ON COLUMN fin_contas.saldo_inicial    IS 'Saldo na data saldo_inicial_em; saldo atual = saldo_inicial + Σ movimentações realizadas após essa data';
COMMENT ON COLUMN fin_contas.saldo_inicial_em IS 'Data de corte do saldo inicial; movimentações anteriores a essa data são ignoradas no cálculo';
COMMENT ON COLUMN fin_contas.negocio          IS 'Empresa proprietária da conta: pousinox | mp | pouso_inox';

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE TRIGGER fin_contas_updated_at
  BEFORE UPDATE ON fin_contas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Índices ────────────────────────────────────────────────

CREATE INDEX idx_fin_contas_negocio ON fin_contas (negocio);
CREATE INDEX idx_fin_contas_ativo   ON fin_contas (ativo) WHERE ativo = true;

-- ── 4. RLS ───────────────────────────────────────────────────

ALTER TABLE fin_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_contas_admin ON fin_contas
  USING (auth.role() = 'service_role');

-- ── 5. View: saldo atual por conta ───────────────────────────
-- Depende de fin_movimentacoes ter colunas conta_id e status.
-- Criada aqui como stub (sem dados reais até Fase 1).
-- Recriar após Fase 1 se necessário.

-- View stub — join com fin_movimentacoes só será possível após Fase 1
-- (quando conta_id for adicionado a fin_movimentacoes).
-- Recriada com cálculo real na migration 20260416_fin_movimentacoes_v2.sql.
CREATE OR REPLACE VIEW vw_fin_saldo_conta AS
SELECT
  id         AS conta_id,
  nome,
  banco,
  tipo,
  negocio,
  saldo_inicial,
  saldo_inicial_em,
  saldo_inicial AS saldo_atual,   -- provisório até Fase 1
  ativo
FROM fin_contas;

COMMENT ON VIEW vw_fin_saldo_conta IS
  'Saldo por conta — stub Fase 0. Recriada com cálculo real na Fase 1 (20260416_fin_movimentacoes_v2.sql)';

-- ── 6. Dados iniciais sugeridos (ajustar conforme realidade) ──
-- Remover ou editar antes de rodar em produção.

INSERT INTO fin_contas (nome, banco, tipo, negocio, saldo_inicial, saldo_inicial_em) VALUES
  ('Bradesco PJ — Pousinox',  'Bradesco',  'corrente',  'pousinox',  0, CURRENT_DATE),
  ('Caixa Físico — Pousinox', NULL,        'carteira',  'pousinox',  0, CURRENT_DATE),
  ('Bradesco PJ — Pouso Inox','Bradesco',  'corrente',  'pouso_inox',0, CURRENT_DATE),
  ('Caixa Físico — MP',       NULL,        'carteira',  'mp',        0, CURRENT_DATE)
ON CONFLICT DO NOTHING;
