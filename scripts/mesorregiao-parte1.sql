-- ═══════════════════════════════════════════════════════════════
-- Gerado por gerar-mesorregiao.cjs em 08/04/2026, 19:48:51
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabela de referência IBGE
CREATE TABLE IF NOT EXISTS ibge_municipios (
  cod_ibge    text PRIMARY KEY,
  nome        text NOT NULL,
  uf          text NOT NULL,
  mesorregiao text NOT NULL,
  microrregiao text NOT NULL
);

TRUNCATE ibge_municipios;
