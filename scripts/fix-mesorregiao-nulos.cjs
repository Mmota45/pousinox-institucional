/**
 * fix-mesorregiao-nulos.cjs
 * Corrige cidades com mesorregiao=NULL que falharam por diferença de acentos.
 * Normaliza o nome (remove acentos/cedilha) antes de filtrar.
 *
 * Uso:  node fix-mesorregiao-nulos.cjs
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

const csvPath = path.join(__dirname, 'ibge_municipios.csv')
if (!fs.existsSync(csvPath)) {
  console.error('❌ ibge_municipios.csv não encontrado.')
  process.exit(1)
}

// Remove acentos e cedilha, converte para maiúsculas
function normalize(s) {
  return String(s).toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Fix Mesorregiões Nulos (sem acentos)    ║')
  console.log('╚══════════════════════════════════════════╝\n')

  const municipios = parseCSV(fs.readFileSync(csvPath, 'utf8'))

  // Filtra só cidades cujo nome normalizado difere do original (têm acento/cedilha)
  const comAcento = municipios.filter(m => normalize(m.nome) !== m.nome.toUpperCase())
  console.log(`📄 ${comAcento.length} cidades com acento/cedilha a corrigir\n`)

  // MG primeiro
  const ordenados = [...comAcento].sort((a, b) => {
    if (a.uf === 'MG' && b.uf !== 'MG') return -1
    if (b.uf === 'MG' && a.uf !== 'MG') return 1
    return a.uf.localeCompare(b.uf)
  })

  let ok = 0, erros = 0
  const total = ordenados.length

  const falhas = []

  for (const m of ordenados) {
    const cidadeNorm = normalize(m.nome)
    try {
      await patch(m.uf, cidadeNorm, m.mesorregiao, m.microrregiao)
      ok++
      process.stdout.write(`\r   ${ok + erros}/${total} — ${m.uf} / ${cidadeNorm}`.padEnd(80))
    } catch (err) {
      erros++
      falhas.push({ uf: m.uf, cidade: cidadeNorm, erro: err.message })
    }
  }

  console.log(`\n\n✅ Concluído! ${ok} atualizados${erros ? `, ${erros} erros` : ''}.`)

  if (falhas.length > 0) {
    console.log(`\n⚠️  Primeiros 20 erros:`)
    falhas.slice(0, 20).forEach(f => {
      console.log(`   ${f.uf} / ${f.cidade} → ${f.erro}`)
    })
    const logPath = path.join(__dirname, 'fix-erros.json')
    fs.writeFileSync(logPath, JSON.stringify(falhas, null, 2))
    console.log(`\n📄 Log completo salvo em: ${logPath}`)
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
