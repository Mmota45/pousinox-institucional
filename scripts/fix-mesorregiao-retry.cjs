/**
 * fix-mesorregiao-retry.cjs
 * Reprocessa as cidades que falharam por timeout em fix-mesorregiao-nulos.cjs.
 * Usa timeout de 120s para suportar cidades com muitos registros.
 *
 * Uso: node fix-mesorregiao-retry.cjs
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'
const csvPath   = path.join(__dirname, 'ibge_municipios.csv')
const errosPath = path.join(__dirname, 'fix-erros.json')

if (!fs.existsSync(errosPath)) {
  console.error('❌ fix-erros.json não encontrado. Rode fix-mesorregiao-nulos.cjs primeiro.')
  process.exit(1)
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

function normalize(s) {
  return String(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function patch(uf, cidadeNorm, mesorregiao, microrregiao) {
  return new Promise((resolve, reject) => {
    const filtro = `uf=eq.${encodeURIComponent(uf)}&cidade=eq.${encodeURIComponent(cidadeNorm)}`
    const body   = JSON.stringify({ mesorregiao, microrregiao })
    const req = https.request({
      hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
      path: `/rest/v1/prospeccao?${filtro}`,
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
    req.setTimeout(120000, () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Fix Mesorregiões — Retry (timeout 120s) ║')
  console.log('╚══════════════════════════════════════════╝\n')

  const falhas = JSON.parse(fs.readFileSync(errosPath, 'utf8'))
  console.log(`📄 ${falhas.length} cidades a reprocessar\n`)

  // Monta índice mesorregiao/microrregiao por uf+nome_normalizado
  const municipios = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  const idx = new Map()
  for (const m of municipios) {
    idx.set(`${m.uf}|${normalize(m.nome)}`, { mesorregiao: m.mesorregiao, microrregiao: m.microrregiao })
  }

  let ok = 0, erros = 0
  const novasFalhas = []

  for (const f of falhas) {
    const info = idx.get(`${f.uf}|${f.cidade}`)
    if (!info) { erros++; novasFalhas.push({ ...f, erro: 'não encontrado no CSV' }); continue }

    try {
      await patch(f.uf, f.cidade, info.mesorregiao, info.microrregiao)
      ok++
      process.stdout.write(`\r   ${ok + erros}/${falhas.length} — ${f.uf} / ${f.cidade}`.padEnd(80))
    } catch (err) {
      erros++
      novasFalhas.push({ ...f, erro: err.message })
    }
  }

  console.log(`\n\n✅ Concluído! ${ok} atualizados${erros ? `, ${erros} erros` : ''}.`)

  if (novasFalhas.length > 0) {
    novasFalhas.slice(0, 10).forEach(f => console.log(`   ⚠  ${f.uf} / ${f.cidade} → ${f.erro}`))
    fs.writeFileSync(errosPath, JSON.stringify(novasFalhas, null, 2))
    console.log(`\n📄 Erros restantes salvos em fix-erros.json`)
  } else {
    fs.unlinkSync(errosPath)
    console.log('🗑️  fix-erros.json removido (tudo resolvido)')
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
