-- ============================================================
-- Fase 2 — fin_transferencias: transferências internas entre contas
-- Módulo Fluxo de Caixa v2
-- ============================================================

-- ── 1. Tabela de transferências ───────────────────────────────

CREATE TABLE fin_transferencias (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  conta_origem_id     BIGINT      NOT NULL REFERENCES fin_contas(id) ON DELETE RESTRICT,
  conta_destino_id    BIGINT      NOT NULL REFERENCES fin_contas(id) ON DELETE RESTRICT,

  valor               NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data_transferencia  DATE          NOT NULL DEFAULT CURRENT_DATE,
  descricao           TEXT,

  -- Movimentações geradas (preenchidas após INSERT das movimentações)
  mov_saida_id        BIGINT      REFERENCES fin_movimentacoes(id) ON DELETE SET NULL,
  mov_entrada_id      BIGINT      REFERENCES fin_movimentacoes(id) ON DELETE SET NULL,

  criado_por          TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT transferencia_contas_distintas
    CHECK (conta_origem_id <> conta_destino_id)
);

COMMENT ON TABLE fin_transferencias IS
  'Transferências internas entre contas. Gera par de movimentações (saída + entrada) '
  'com conciliado=true e transferencia_id preenchido em ambas.';

COMMENT ON COLUMN fin_transferencias.mov_saida_id   IS 'Movimentação tipo=saida gerada na conta de origem';
COMMENT ON COLUMN fin_transferencias.mov_entrada_id IS 'Movimentação tipo=entrada gerada na conta de destino';

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE TRIGGER fin_transferencias_updated_at
  BEFORE UPDATE ON fin_transferencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Índices ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fin_transf_origem  ON fin_transferencias (conta_origem_id);
CREATE INDEX IF NOT EXISTS idx_fin_transf_destino ON fin_transferencias (conta_destino_id);
CREATE INDEX IF NOT EXISTS idx_fin_transf_data    ON fin_transferencias (data_transferencia);

-- ── 4. RLS ───────────────────────────────────────────────────

ALTER TABLE fin_transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_transferencias_admin ON fin_transferencias
  USING (auth.role() = 'service_role');

-- ── 5. FK transferencia_id em fin_movimentacoes ───────────────
-- Adicionada agora que fin_transferencias existe

ALTER TABLE fin_movimentacoes
  ADD CONSTRAINT fk_fin_mov_transferencia
    FOREIGN KEY (transferencia_id)
    REFERENCES fin_transferencias(id)
    ON DELETE SET NULL;

-- ── 6. Função: criar transferência + par de movimentações ─────
-- Chamada pelo frontend via RPC para garantir atomicidade.
-- Retorna o id da transferência criada.

CREATE OR REPLACE FUNCTION fn_criar_transferencia(
  p_conta_origem_id    BIGINT,
  p_conta_destino_id   BIGINT,
  p_valor              NUMERIC(14,2),
  p_data               DATE,
  p_descricao          TEXT DEFAULT NULL,
  p_negocio            TEXT DEFAULT 'pousinox',
  p_criado_por         TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transf_id   BIGINT;
  v_mov_saida   BIGINT;
  v_mov_entrada BIGINT;
  v_desc        TEXT;
BEGIN
  v_desc := COALESCE(p_descricao, 'Transferência interna');

  -- 1. Cria registro da transferência (sem movimentações ainda)
  INSERT INTO fin_transferencias (
    conta_origem_id, conta_destino_id, valor,
    data_transferencia, descricao, criado_por
  ) VALUES (
    p_conta_origem_id, p_conta_destino_id, p_valor,
    p_data, v_desc, p_criado_por
  )
  RETURNING id INTO v_transf_id;

  -- 2. Movimentação de saída (origem)
  INSERT INTO fin_movimentacoes (
    tipo, valor, data, descricao,
    conta_id, negocio, status,
    conciliado, conciliado_em,
    transferencia_id, origem_tipo, criado_por
  ) VALUES (
    'saida', p_valor, p_data, v_desc,
    p_conta_origem_id, p_negocio, 'realizado',
    true, now(),
    v_transf_id, 'sistema', p_criado_por
  )
  RETURNING id INTO v_mov_saida;

  -- 3. Movimentação de entrada (destino)
  INSERT INTO fin_movimentacoes (
    tipo, valor, data, descricao,
    conta_id, negocio, status,
    conciliado, conciliado_em,
    transferencia_id, origem_tipo, criado_por
  ) VALUES (
    'entrada', p_valor, p_data, v_desc,
    p_conta_destino_id, p_negocio, 'realizado',
    true, now(),
    v_transf_id, 'sistema', p_criado_por
  )
  RETURNING id INTO v_mov_entrada;

  -- 4. Atualiza transferência com os IDs das movimentações
  UPDATE fin_transferencias
  SET mov_saida_id   = v_mov_saida,
      mov_entrada_id = v_mov_entrada
  WHERE id = v_transf_id;

  RETURN v_transf_id;
END;
$$;

COMMENT ON FUNCTION fn_criar_transferencia IS
  'Cria transferência interna de forma atômica: '
  'insere fin_transferencias + par de fin_movimentacoes (saída+entrada) já conciliadas. '
  'Chamar via supabaseAdmin.rpc(''fn_criar_transferencia'', { ... })';
