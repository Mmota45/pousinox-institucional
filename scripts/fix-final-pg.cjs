const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const CONNECTION = 'postgresql://postgres:pPfksHLvSBwWXFMO@db.vcektwtpofypsgdgdjlx.supabase.co:5432/postgres'

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'fix-final2.sql'), 'utf8')
  const statements = sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'))
    .join('\n').split(';').map(s => s.trim()).filter(Boolean)

  const client = new Client({ connectionString: CONNECTION })
  await client.connect()
  console.log('✅ Conectado\n')

  for (const stmt of statements) {
    const res = await client.query(stmt)
    const firstLine = stmt.split('\n')[0].slice(0, 60)
    console.log(`   ${res.rowCount} linhas — ${firstLine}`)
  }

  await client.end()
  console.log('\n✅ Concluído!')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
