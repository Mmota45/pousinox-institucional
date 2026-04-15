/**
 * fix-mesorregiao-restantes.cjs
 * Corrige os últimos registros com mesorregiao NULL:
 * - Cidades com nomes divergentes do IBGE (mapeamento manual)
 * - Cidades grandes que deram timeout (lotes menores)
 *
 * Uso: node fix-mesorregiao-restantes.cjs
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const CONNECTION = 'postgresql://postgres:pPfksHLvSBwWXFMO@db.vcektwtpofypsgdgdjlx.supabase.co:5432/postgres'
const csvPath   = path.join(__dirname, 'ibge_municipios.csv')
const LOTE      = 500

// Mapeamento: nome_no_banco → nome_no_csv_ibge
const MAPA_NOMES = {
  'PARATI':                    'PARATY',
  'BALNEARIO DE PICARRAS':     'BALNEÁRIO PIÇARRAS',
  'SANTA ISABEL DO PARA':      'SANTA ISABEL DO PARÁ',
  'BIRITIBA-MIRIM':            'BIRITIBA MIRIM',
  'SANTO ANTONIO DO LEVERGER': 'SANTO ANTÔNIO DO LEVERGER',
  'ELDORADO DOS CARAJAS':      'ELDORADO DO CARAJÁS',
  'PINDARE MIRIM':             'PINDARÉ-MIRIM',
  'ENTRE IJUIS':               'ENTRE-IJUÍS',
  'ARES':                      'ARÊS',
  'SANTA TERESINHA':           'SANTA TERESINHA',
  'GRAO PARA':                 'GRÃO-PARÁ',
  'MUQUEM DE SAO FRANCISCO':   'MUQUÉM DE SÃO FRANCISCO',
  'BOA SAUDE':                 'BOA SAÚDE',
  'COUTO DE MAGALHAES':        'COUTO DE MAGALHÃES',
  'SAO LUIZ':                  'SÃO LUIZ',
  'SAO VALERIO DA NATIVIDADE': 'SÃO VALÉRIO DA NATIVIDADE',
  'FORTALEZA DO TABOCAO':      'FORTALEZA DO TABOCÃO',
  'SANTANA DO LIVRAMENTO':     'SANTANA DO LIVRAMENTO',
}

function normalize(s) {
  return String(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur); cur = '' }
      else cur += ch
    }
    vals.push(cur)
    const obj = {}
    headers.forEach((h, i) => obj[h] = (vals[i] ?? '').trim())
    return obj
  })
}

async function updateLotes(client, uf, cidade, mesorregiao, microrregiao) {
  let total = 0
  while (true) {
    const res = await client.query(
      `UPDATE prospeccao SET mesorregiao = $1, microrregiao = $2
       WHERE id IN (
         SELECT id FROM prospeccao
         WHERE uf = $3 AND cidade = $4 AND mesorregiao IS NULL
         LIMIT ${LOTE}
       )`,
      [mesorregiao, microrregiao, uf, cidade]
    )
    total += res.rowCount
    if (res.rowCount < LOTE) break
  }
  return total
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Fix Mesorregiões — Casos Restantes          ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  const municipios = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  const idx = new Map()
  for (const m of municipios) {
    idx.set(`${m.uf}|${m.nome.toUpperCase()}`, m)
    idx.set(`${m.uf}|${normalize(m.nome)}`, m)
  }

  const client = new Client({ connectionString: CONNECTION })
  await client.connect()
  console.log('✅ Conectado ao Postgres\n')

  const { rows } = await client.query(`
    SELECT DISTINCT uf, cidade FROM prospeccao
    WHERE mesorregiao IS NULL AND uf IS NOT NULL AND cidade IS NOT NULL
    ORDER BY uf, cidade
  `)
  console.log(`🔍 ${rows.length} cidades a processar\n`)

  let ok = 0, semMatch = 0

  for (let i = 0; i < rows.length; i++) {
    const { uf, cidade } = rows[i]

    // Tenta match direto, depois normalizado, depois via mapeamento manual
    const nomeIbge = MAPA_NOMES[cidade] ?? cidade
    const info = idx.get(`${uf}|${nomeIbge.toUpperCase()}`)
           || idx.get(`${uf}|${normalize(nomeIbge)}`)
           || idx.get(`${uf}|${normalize(cidade)}`)

    if (!info) { semMatch++; continue }

    try {
      const linhas = await updateLotes(client, uf, cidade, info.mesorregiao, info.microrregiao)
      ok++
      process.stdout.write(`\r   ${i + 1}/${rows.length} — ${uf}/${cidade} (${linhas} linhas)`.padEnd(80))
    } catch (err) {
      console.error(`\n   ⚠  ${uf}/${cidade}: ${err.message}`)
    }
  }

  await client.end()
  console.log(`\n\n✅ Concluído! ${ok} cidades atualizadas${semMatch ? `, ${semMatch} sem match` : ''}.`)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
