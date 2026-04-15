/**
 * gerar-mesorregiao.cjs
 * Busca dados de municípios/mesorregiões da API do IBGE e gera um arquivo SQL
 * que cria a tabela de referência e atualiza a coluna mesorregiao na tabela prospeccao.
 *
 * Uso:
 *   node gerar-mesorregiao.cjs
 *
 * Saída:
 *   mesorregiao.sql  (rode este arquivo no Supabase SQL Editor)
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const OUTPUT = path.join(__dirname, 'mesorregiao.sql')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('JSON inválido: ' + e.message)) }
      })
    }).on('error', reject)
  })
}

function esc(s) {
  return String(s ?? '').replace(/'/g, "''")
}

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  Pousinox — Gerador de Mesorregiões  ║')
  console.log('╚══════════════════════════════════════╝\n')

  console.log('📡 Buscando municípios na API do IBGE...')
  const municipios = await fetchJson(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
  )
  console.log(`   ✓ ${municipios.length} municípios carregados\n`)

  const sql = []

  // ── 1. Tabela de referência ─────────────────────────────────────────────
  sql.push(`-- ═══════════════════════════════════════════════════════════════
-- Gerado por gerar-mesorregiao.cjs em ${new Date().toLocaleString('pt-BR')}
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
`)

  // ── 2. Inserts em lotes de 500 ──────────────────────────────────────────
  // Filtra municípios sem microrregião (Fernando de Noronha e similares retornam null)
  const validos = municipios.filter(m => m.microrregiao?.mesorregiao?.UF?.sigla)
  console.log(`   ✓ ${validos.length} válidos (${municipios.length - validos.length} sem microrregião ignorados)`)

  // Gera CSV para importar via dashboard do Supabase
  const csvLinhas = ['cod_ibge,nome,uf,mesorregiao,microrregiao']
  for (const m of validos) {
    const campos = [
      String(m.id),
      m.nome,
      m.microrregiao.mesorregiao.UF.sigla,
      m.microrregiao.mesorregiao.nome,
      m.microrregiao.nome,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`)
    csvLinhas.push(campos.join(','))
  }
  const csvPath = path.join(__dirname, 'ibge_municipios.csv')
  fs.writeFileSync(csvPath, csvLinhas.join('\n'), 'utf8')
  console.log(`   ✓ CSV gerado: ibge_municipios.csv (${validos.length} linhas)`)

  // ── 3. Adiciona coluna mesorregiao na prospeccao ────────────────────────
  sql.push(`
-- 2. Adiciona coluna na tabela de prospecção
ALTER TABLE prospeccao
  ADD COLUMN IF NOT EXISTS mesorregiao  text,
  ADD COLUMN IF NOT EXISTS microrregiao text;
`)

  // ── 4. UPDATE por UF (evita timeout no Supabase SQL Editor) ──────────
  const ufs = [...new Set(validos.map(m => m.microrregiao.mesorregiao.UF.sigla))].sort()

  sql.push(`-- 3. Popula mesorregiao/microrregiao — um UPDATE por UF para evitar timeout`)
  for (const uf of ufs) {
    sql.push(`UPDATE prospeccao p SET mesorregiao = i.mesorregiao, microrregiao = i.microrregiao FROM ibge_municipios i WHERE upper(p.cidade) = upper(i.nome) AND p.uf = i.uf AND p.uf = '${uf}';`)
  }
  sql.push('')

  // ── 5. RPC para filtro dinâmico no admin ──────────────────────────────
  sql.push(`-- 4. Funções para filtros dinâmicos no admin
CREATE OR REPLACE FUNCTION get_mesorregioes_ufs(p_ufs text[])
RETURNS TABLE(mesorregiao text) LANGUAGE sql AS $$
  SELECT DISTINCT mesorregiao FROM prospeccao
  WHERE uf = ANY(p_ufs) AND mesorregiao IS NOT NULL
  ORDER BY mesorregiao;
$$;

CREATE OR REPLACE FUNCTION get_cidades_ufs(p_ufs text[])
RETURNS TABLE(cidade text) LANGUAGE sql AS $$
  SELECT DISTINCT cidade FROM prospeccao
  WHERE uf = ANY(p_ufs) AND cidade IS NOT NULL
  ORDER BY cidade;
$$;

CREATE OR REPLACE FUNCTION get_cidades_meso(p_ufs text[], p_meso text[])
RETURNS TABLE(cidade text) LANGUAGE sql AS $$
  SELECT DISTINCT cidade FROM prospeccao
  WHERE uf = ANY(p_ufs)
    AND mesorregiao = ANY(p_meso)
    AND cidade IS NOT NULL
  ORDER BY cidade;
$$;
`)

  // Separa em 3 partes
  // Parte 1: CREATE TABLE + INSERTs
  // Parte 2: ALTER TABLE + CREATE FUNCTIONs
  // Parte 3: UPDATEs por UF

  const idxAlter  = sql.findIndex(s => s.includes('ALTER TABLE prospeccao'))
  const idxUpdate = sql.findIndex(s => s.includes('-- 3. Popula'))

  const parte1 = sql.slice(0, idxAlter)   // só CREATE TABLE
  const parte2 = sql.slice(idxAlter, idxUpdate) // ALTER + FUNCTIONs
  const parte3 = sql.slice(idxUpdate)     // 27 UPDATEs

  const out1 = path.join(__dirname, 'mesorregiao-parte1.sql')
  const out2 = path.join(__dirname, 'mesorregiao-parte2.sql')
  const out3 = path.join(__dirname, 'mesorregiao-parte3.sql')

  fs.writeFileSync(out1, parte1.join('\n'))
  fs.writeFileSync(out2, parte2.join('\n'))
  fs.writeFileSync(out3, parte3.join('\n'))

  console.log(`\n✅ Arquivos gerados em: C:\\Users\\marco\\Pousinox_Site\\scripts\\`)
  console.log('   1️⃣  mesorregiao-parte1.sql  → CREATE TABLE (cole no SQL Editor)')
  console.log('   📄  ibge_municipios.csv      → importe pelo dashboard do Supabase')
  console.log('   2️⃣  mesorregiao-parte2.sql  → ALTER TABLE + FUNCTIONS')
  console.log('   3️⃣  mesorregiao-parte3.sql  → 27 UPDATEs por UF')
  console.log('\n📋 Ordem de execução:')
  console.log('   1. SQL Editor → parte1.sql')
  console.log('   2. Table Editor → ibge_municipios → Import CSV → ibge_municipios.csv')
  console.log('   3. SQL Editor → parte2.sql')
  console.log('   4. SQL Editor → parte3.sql')
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
