-- Módulo Cartões Digitais
-- Etapa 1: Estrutura de dados

CREATE TABLE IF NOT EXISTS cartoes_digitais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  empresa TEXT,
  segmento TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  site TEXT,
  endereco TEXT,
  cidade TEXT,
  uf CHAR(2),
  cep TEXT,
  foto_url TEXT,
  logo_url TEXT,
  cor_primaria TEXT DEFAULT '#1e3f6e',
  cor_fundo TEXT DEFAULT '#ffffff',
  linkedin TEXT,
  instagram TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','pausado','arquivado')),
  visualizacoes INTEGER NOT NULL DEFAULT 0,
  downloads_vcard INTEGER NOT NULL DEFAULT 0,
  criado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoes_acessos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cartao_id UUID NOT NULL REFERENCES cartoes_digitais(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'visualizacao',
    'clique_whatsapp',
    'clique_telefone',
    'clique_email',
    'clique_site',
    'clique_linkedin',
    'clique_instagram',
    'download_vcard',
    'compartilhamento',
    'clique_qr',
    'clique_maps'
  )),
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cartoes_digitais_slug ON cartoes_digitais(slug);
CREATE INDEX IF NOT EXISTS idx_cartoes_digitais_status ON cartoes_digitais(status);
CREATE INDEX IF NOT EXISTS idx_cartoes_acessos_cartao_id ON cartoes_acessos(cartao_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_acessos_tipo ON cartoes_acessos(tipo);
CREATE INDEX IF NOT EXISTS idx_cartoes_acessos_criado_em ON cartoes_acessos(criado_em DESC);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_cartoes_digitais
  BEFORE UPDATE ON cartoes_digitais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE cartoes_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes_acessos ENABLE ROW LEVEL SECURITY;

-- Admin: service_role acesso total
CREATE POLICY "cartoes_admin" ON cartoes_digitais
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "cartoes_acessos_admin" ON cartoes_acessos
  FOR ALL USING (auth.role() = 'service_role');

-- Público: ler cartão publicado por slug
CREATE POLICY "cartoes_public_read" ON cartoes_digitais
  FOR SELECT USING (status = 'publicado');

-- Público: registrar acesso
CREATE POLICY "cartoes_acessos_public_insert" ON cartoes_acessos
  FOR INSERT WITH CHECK (true);

-- Permissão nos perfis admin
UPDATE admin_perfis SET permissoes = permissoes || '{cartoes}' WHERE NOT permissoes @> '{cartoes}';
