/**
 * fix-mesorregiao-pg.cjs
 * Executa o fix-mesorregiao-manual.sql via conexão direta ao Postgres (sem timeout de API).
 *
 * Uso: node fix-mesorregiao-pg.cjs
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const CONNECTION = 'postgresql://postgres:pPfksHLvSBwWXFMO@db.vcektwtpofypsgdgdjlx.supabase.co:5432/postgres'
const SQL_FILE  = path.join(__dirname, 'fix-mesorregiao-manual.sql')

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Fix Mesorregiões — Conexão Direta PG    ║')
  console.log('╚══════════════════════════════════════════╝\n')

  const sql = fs.readFileSync(SQL_FILE, 'utf8')
  const statements = sql.split('\n').map(s => s.trim()).filter(s => s.startsWith('UPDATE'))

  console.log(`📄 ${statements.length} statements a executar\n`)

  const client = new Client({ connectionString: CONNECTION })
  await client.connect()
  await client.query('SET statement_timeout = 0')
  console.log('✅ Conectado ao Postgres (timeout desativado)\n')

  const LOTE = 2000
  let ok = 0, erros = 0

  for (const stmt of statements) {
    // Extrai uf, cidade, mesorregiao, microrregiao do UPDATE original
    const m = stmt.match(/SET mesorregiao = '(.*?)', microrregiao = '(.*?)' WHERE uf = '(.*?)' AND cidade = '(.*?)';/)
    if (!m) { erros++; continue }
    const [, mesorregiao, microrregiao, uf, cidade] = m

    // Roda em mini-lotes para não estourar statement_timeout
    let total = 0
    while (true) {
      try {
        const res = await client.query(
          `UPDATE prospeccao SET mesorregiao = $1, microrregiao = $2
           WHERE id IN (
             SELECT id FROM prospeccao WHERE uf = $3 AND cidade = $4
             AND (mesorregiao IS NULL OR mesorregiao != $1)
             LIMIT ${LOTE}
           )`,
          [mesorregiao, microrregiao, uf, cidade]
        )
        total += res.rowCount
        if (res.rowCount < LOTE) break
      } catch (err) {
        erros++
        console.error(`\n   ⚠  ${uf}/${cidade}: ${err.message}`)
        break
      }
    }
    ok++
    process.stdout.write(`\r   ${ok}/${statements.length} — ${uf}/${cidade} (${total} linhas)`.padEnd(80))
  }

  await client.end()
  console.log(`\n\n✅ Concluído! ${ok} ok${erros ? `, ${erros} erros` : ''}.`)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
