/**
 * importar-prospects.cjs
 * Importa o CSV prospects_pousinox.csv para o Supabase em lotes via REST API.
 * Usa upsert com ignoreDuplicates=true — registros existentes não são sobrescritos
 * (preserva contatado, status_contato, observacao, etc.)
 *
 * Uso:
 *   node importar-prospects.cjs <caminho-do-csv>
 *
 * Exemplo:
 *   node importar-prospects.cjs "C:\Users\marco\Downloads\cnpj\prospects_pousinox.csv"
 */

const https  = require('https')
const fs     = require('fs')
const path   = require('path')
const readline = require('readline')

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'
const LOTE   = 500
const CSV    = process.argv[2]

if (!CSV) {
  console.error('Uso: node importar-prospects.cjs <caminho-do-csv>')
  process.exit(1)
}

if (!fs.existsSync(CSV)) {
  console.error('❌ Arquivo não encontrado:', CSV)
  process.exit(1)
}

function upsertLote(rows) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(rows), 'utf8')
    const opts = {
      hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
      path: '/rest/v1/prospeccao?on_conflict=cnpj',
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': body.length,
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer':        'resolution=ignore-duplicates,return=minimal',
      },
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

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
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Pousinox — Importar Prospects      ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`\nArquivo: ${CSV}\n`)

  const t0 = Date.now()
  let headers = null
  let lote = []
  let total = 0
  let erros = 0

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  for await (const linha of rl) {
    if (!linha.trim()) continue

    if (!headers) {
      headers = linha.split(';').map(h => h.trim())
      continue
    }

    lote.push(parseLinha(linha, headers))

    if (lote.length >= LOTE) {
      try {
        await upsertLote(lote)
        total += lote.length
      } catch (e) {
        erros += lote.length
        if (erros <= LOTE) console.error(`   ⚠  Primeiro erro (linha ~${total}):`, e.message)
      }
      lote = []

      if (total % 50000 === 0) {
        const seg = ((Date.now() - t0) / 1000).toFixed(0)
        console.log(`   ${total.toLocaleString()} registros importados... (${seg}s)`)
      }
    }
  }

  // Último lote
  if (lote.length > 0) {
    try {
      await upsertLote(lote)
      total += lote.length
    } catch (e) {
      erros += lote.length
      console.error(`   ⚠  Erro no lote final:`, e.message)
    }
  }

  const seg = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n✅ Concluído em ${seg}s`)
  console.log(`   ✓ ${total.toLocaleString()} registros importados`)
  if (erros > 0) console.log(`   ⚠  ${erros.toLocaleString()} registros com erro`)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
