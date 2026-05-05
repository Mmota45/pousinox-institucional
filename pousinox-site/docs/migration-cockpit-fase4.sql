-- ══════════════════════════════════════════════════════════════════════════
-- Cockpit Fase 4 — Automações inteligentes
-- Executar no Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

-- Notícias do setor (radar)
CREATE TABLE IF NOT EXISTS noticias_radar (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  resumo TEXT,
  url TEXT,
  fonte TEXT,
  relevancia SMALLINT DEFAULT 5 CHECK (relevancia BETWEEN 0 AND 10),
  lida BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Alertas de anomalia
CREATE TABLE IF NOT EXISTS alertas (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  severidade TEXT DEFAULT 'media' CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
  mensagem TEXT NOT NULL,
  dados JSONB,
  lido BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Regras de automação (When X → Do Y)
CREATE TABLE IF NOT EXISTS event_rules (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  trigger_tipo TEXT NOT NULL,
  condicao JSONB NOT NULL,
  acao JSONB NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback IA (migrar de localStorage)
CREATE TABLE IF NOT EXISTS ia_feedback (
  id BIGSERIAL PRIMARY KEY,
  etapa TEXT,
  modelo TEXT,
  prompt_resumo TEXT,
  rating TEXT CHECK (rating IN ('up', 'down')),
  usuario UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Insights cruzados
CREATE TABLE IF NOT EXISTS insights (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB,
  acionado BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Inteligência competitiva
CREATE TABLE IF NOT EXISTS competitive_intel (
  id BIGSERIAL PRIMARY KEY,
  concorrente TEXT NOT NULL,
  tipo_mudanca TEXT,
  resumo TEXT,
  url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Briefings diários
CREATE TABLE IF NOT EXISTS briefings (
  id BIGSERIAL PRIMARY KEY,
  data DATE UNIQUE NOT NULL,
  conteudo JSONB NOT NULL,
  enviado_em TIMESTAMPTZ,
  canal TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas(lido) WHERE NOT lido;
CREATE INDEX IF NOT EXISTS idx_alertas_criado ON alertas(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_noticias_relevancia ON noticias_radar(relevancia DESC) WHERE NOT lida;
CREATE INDEX IF NOT EXISTS idx_noticias_criado ON noticias_radar(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_insights_tipo ON insights(tipo);
CREATE INDEX IF NOT EXISTS idx_briefings_data ON briefings(data DESC);
CREATE INDEX IF NOT EXISTS idx_event_rules_ativo ON event_rules(ativo) WHERE ativo;

-- RLS
ALTER TABLE noticias_radar ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

-- Policies (service_role only)
CREATE POLICY sr_noticias ON noticias_radar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sr_alertas ON alertas FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sr_event_rules ON event_rules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sr_ia_feedback ON ia_feedback FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sr_insights ON insights FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sr_competitive_intel ON competitive_intel FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sr_briefings ON briefings FOR ALL USING (auth.role() = 'service_role');

-- Regras de automação padrão
INSERT INTO event_rules (nome, trigger_tipo, condicao, acao) VALUES
  ('NF vencida 3+ dias', 'nf_vencida', '{"dias_atraso": 3}', '{"tipo": "whatsapp", "template": "cobranca"}'),
  ('Lead score alto', 'lead_score', '{"score_min": 80}', '{"tipo": "notificacao", "destino": "vendas"}'),
  ('Estoque abaixo mínimo', 'estoque_baixo', '{"abaixo_minimo": true}', '{"tipo": "solicitacao_compra"}'),
  ('Deal parado 10+ dias', 'deal_parado', '{"dias_sem_movimento": 10}', '{"tipo": "alerta", "sugestao_ia": true}'),
  ('Cliente inativo 60+ dias', 'cliente_inativo', '{"dias_inativo": 60}', '{"tipo": "campanha_reativacao"}'),
  ('Inspeção reprovada', 'inspecao_reprovada', '{}', '{"tipo": "criar_nc", "alerta_qualidade": true}'),
  ('Proposta visualizada', 'proposta_aberta', '{"cliente_clicou": true}', '{"tipo": "acelerar_followup", "dias": 1}')
ON CONFLICT DO NOTHING;
