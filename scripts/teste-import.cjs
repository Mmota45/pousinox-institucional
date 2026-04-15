const https    = require('https')
const fs       = require('fs')
const readline = require('readline')

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'
const CSV      = process.argv[2]

function parseLinha(linha, headers) {
  const vals = []
  let cur = '', inQ = false
  for (const ch of linha) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ';' && !inQ) { vals.push(cur); cur = '' }
    else cur += ch
  }
  vals.push(cur)
  const obj = {}
  headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() || null })
  return obj
}

async function main() {
  let headers = null
  const rows = []

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const linha of rl) {
    if (!linha.trim()) continue
    if (!headers) { headers = linha.split(';').map(h => h.trim()); continue }
    rows.push(parseLinha(linha, headers))
    if (rows.length >= 5) break
  }

  rl.close()

  console.log('Linhas lidas:', rows.length)
  console.log('Exemplo:', JSON.stringify(rows[0], null, 2))

  const body = Buffer.from(JSON.stringify(rows), 'utf8')
  const opts = {
    hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
    path: '/rest/v1/prospeccao?on_conflict=cnpj',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length,
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'resolution=ignore-duplicates,return=minimal',
    },
  }

  const req = https.request(opts, res => {
    let data = ''
    res.on('data', d => { data += d })
    res.on('end', () => {
      console.log('\nStatus HTTP:', res.statusCode)
      console.log('Resposta:', data || '(vazia — sucesso)')
    })
  })
  req.on('error', e => console.error('Erro:', e.message))
  req.write(body)
  req.end()
}

main()
