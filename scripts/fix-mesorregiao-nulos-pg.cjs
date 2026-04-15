/**
 * fix-mesorregiao-nulos-pg.cjs
 * Atualiza mesorregiao/microrregiao de todos os registros com NULL
 * via conexão direta ao Postgres, em lotes de 2000 por cidade.
 *
 * Uso: node fix-mesorregiao-nulos-pg.cjs
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const CONNECTION = 'postgresql://postgres:pPfksHLvSBwWXFMO@db.vcektwtpofypsgdgdjlx.supabase.co:5432/postgres'
const csvPath   = path.join(__dirname, 'ibge_municipios.csv')
const LOTE      = 2000

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

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Fix Mesorregiões Nulos — PG Direto          ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  // Monta índice do CSV: uf|cidade_normalizada → mesorregiao/microrregiao
  const municipios = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  const idx = new Map()
  for (const m of municipios) {
    // Indexa pelo nome original em maiúsculas
    idx.set(`${m.uf}|${m.nome.toUpperCase()}`, m)
    // Indexa pela versão normalizada (sem acento)
    idx.set(`${m.uf}|${normalize(m.nome)}`, m)
  }
  console.log(`📄 ${municipios.length} municípios carregados\n`)

  const client = new Client({ connectionString: CONNECTION })
  await client.connect()
  console.log('✅ Conectado ao Postgres\n')

  // Busca cidades distintas com mesorregiao NULL
  const { rows: cidades } = await client.query(`
    SELECT DISTINCT uf, cidade, count(*) as total
    FROM prospeccao
    WHERE mesorregiao IS NULL AND cidade IS NOT NULL
    GROUP BY uf, cidade
    ORDER BY uf, cidade
  `)
  console.log(`🔍 ${cidades.length} cidades com mesorregiao NULL\n`)

  let ok = 0, semMatch = 0, erros = 0

  for (let i = 0; i < cidades.length; i++) {
    const { uf, cidade } = cidades[i]

    const info = idx.get(`${uf}|${cidade}`) || idx.get(`${uf}|${normalize(cidade)}`)
    if (!info) {
      semMatch++
      continue
    }

    const { mesorregiao, microrregiao } = info
    let totalLinhas = 0

    while (true) {
      try {
        const res = await client.query(
          `UPDATE prospeccao SET mesorregiao = $1, microrregiao = $2
           WHERE id IN (
             SELECT id FROM prospeccao
             WHERE uf = $3 AND cidade = $4 AND mesorregiao IS NULL
             LIMIT ${LOTE}
           )`,
          [mesorregiao, microrregiao, uf, cidade]
        )
        totalLinhas += res.rowCount
        if (res.rowCount < LOTE) break
      } catch (err) {
        erros++
        console.error(`\n   ⚠  ${uf}/${cidade}: ${err.message}`)
        break
      }
    }

    ok++
    process.stdout.write(`\r   ${i + 1}/${cidades.length} — ${uf}/${cidade} (${totalLinhas} linhas)`.padEnd(80))
  }

  await client.end()

  console.log(`\n\n✅ Concluído!`)
  console.log(`   ✓ ${ok} cidades atualizadas`)
  if (semMatch) console.log(`   ⚠  ${semMatch} cidades sem correspondência no CSV`)
  if (erros)    console.log(`   ⚠  ${erros} erros`)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
