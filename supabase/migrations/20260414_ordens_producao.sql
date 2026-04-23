-- ══════════════════════════════════════════════════════════════════════════════
-- Produção / PCP — ordens de produção (fase base)
-- ══════════════════════════════════════════════════════════════════════════════

-- Sequência dedicada para número da ordem (OP-XXXX)
-- Garante unicidade sem max()+1 e sem colisão em criação simultânea
CREATE SEQUENCE IF NOT EXISTS ordens_producao_numero_seq START 1;

CREATE TABLE IF NOT EXISTS ordens_producao (
  id                bigserial PRIMARY KEY,
  numero            text NOT NULL UNIQUE
                      DEFAULT 'OP-' || LPAD(nextval('ordens_producao_numero_seq')::text, 4, '0'),
  titulo            text NOT NULL,
  projeto_id        bigint REFERENCES projetos(id) ON DELETE SET NULL,
  produto_descricao text,
  quantidade        numeric(12,3) NOT NULL DEFAULT 1,
  unidade           text NOT NULL DEFAULT 'un',
  status            text NOT NULL DEFAULT 'planejada'
                      CHECK (status IN ('planejada','liberada','em_producao','concluida','cancelada')),
  data_planejada    date,
  data_inicio       date,
  data_conclusao    date,
  responsavel       text,
  observacao        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ordens_producao_updated_at
  BEFORE UPDATE ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ordens_status     ON ordens_producao(status);
CREATE INDEX IF NOT EXISTS idx_ordens_projeto     ON ordens_producao(projeto_id) WHERE projeto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ordens_data        ON ordens_producao(data_planejada);

ALTER TABLE ordens_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON ordens_producao
  FOR ALL USING (auth.role() = 'service_role');
