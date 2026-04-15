/**
 * popular-lat-lng.cjs
 * Popula lat/lng na tabela ibge_municipios a partir do CSV kelvins/municipios-brasileiros.
 *
 * Uso: node popular-lat-lng.cjs
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

// Mapa: codigo_uf (IBGE) → sigla UF
const UF_MAP = {
  11:'RO', 12:'AC', 13:'AM', 14:'RR', 15:'PA', 16:'AP', 17:'TO',
  21:'MA', 22:'PI', 23:'CE', 24:'RN', 25:'PB', 26:'PE', 27:'AL', 28:'SE', 29:'BA',
  31:'MG', 32:'ES', 33:'RJ', 35:'SP',
  41:'PR', 42:'SC', 43:'RS',
  50:'MS', 51:'MT', 52:'GO', 53:'DF',
}

const csvPath = path.join(__dirname, 'municipios.csv')
if (!fs.existsSync(csvPath)) {
  console.error('❌ municipios.csv não encontrado.')
  process.exit(1)
}

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const obj = {}
    headers.forEach((h, i) => obj[h] = (vals[i] ?? '').trim())
    return obj
  })
}

function patch(uf, nome, lat, lng) {
  return new Promise((resolve, reject) => {
    const filtro = `uf=eq.${encodeURIComponent(uf)}&nome=eq.${encodeURIComponent(nome)}`
    const body   = JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng) })
    const req = https.request({
      hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
      path: `/rest/v1/ibge_municipios?${filtro}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve()
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`))
      })
    })
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Popular lat/lng → ibge_municipios       ║')
  console.log('╚══════════════════════════════════════════╝\n')

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  console.log(`📄 ${rows.length} municípios no CSV\n`)

  let ok = 0, erros = 0
  const falhas = []

  for (const m of rows) {
    const uf = UF_MAP[parseInt(m.codigo_uf)]
    if (!uf) { erros++; continue }

    try {
      await patch(uf, m.nome, m.latitude, m.longitude)
      ok++
      process.stdout.write(`\r   ${ok + erros}/${rows.length} — ${uf} / ${m.nome}`.padEnd(80))
    } catch (err) {
      erros++
      falhas.push({ uf, nome: m.nome, erro: err.message })
    }
  }

  console.log(`\n\n✅ Concluído! ${ok} atualizados${erros ? `, ${erros} erros` : ''}.`)

  if (falhas.length > 0) {
    console.log(`\n⚠️  Primeiros 10 erros:`)
    falhas.slice(0, 10).forEach(f => console.log(`   ${f.uf} / ${f.nome} → ${f.erro}`))
    const logPath = path.join(__dirname, 'lat-lng-erros.json')
    fs.writeFileSync(logPath, JSON.stringify(falhas, null, 2))
    console.log(`\n📄 Log completo: ${logPath}`)
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
