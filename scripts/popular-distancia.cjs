/**
 * popular-distancia.cjs
 * Popula distancia_km na tabela prospeccao a partir de ibge_municipios.
 *
 * Uso: node popular-distancia.cjs
 */

const https = require('https')

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

function normalize(s) {
  return String(s).toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('JSON parse error: ' + data.slice(0, 200))) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function getAllMunicipios() {
  const all = []
  const pageSize = 1000
  let offset = 0
  while (true) {
    const page = await get(`/rest/v1/ibge_municipios?select=uf,nome,distancia_km&limit=${pageSize}&offset=${offset}`)
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  return all
}

function patch(uf, cidade, distancia_km) {
  return new Promise((resolve, reject) => {
    const filtro = `uf=eq.${encodeURIComponent(uf)}&cidade=eq.${encodeURIComponent(cidade)}`
    const body   = JSON.stringify({ distancia_km })
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
  console.log('║  Popular distancia_km → prospeccao       ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // Busca todos os municípios com distancia_km (paginado)
  console.log('📥 Buscando ibge_municipios...')
  const municipios = await getAllMunicipios()
  console.log(`   ${municipios.length} municípios carregados\n`)

  // Ordena: MG primeiro
  municipios.sort((a, b) => {
    if (a.uf === 'MG' && b.uf !== 'MG') return -1
    if (b.uf === 'MG' && a.uf !== 'MG') return 1
    return a.uf.localeCompare(b.uf)
  })

  let ok = 0, erros = 0
  const total = municipios.length

  for (const m of municipios) {
    if (m.distancia_km == null) { erros++; continue }

    // Tenta nome exato (uppercase) e nome normalizado (sem acento)
    const cidadeExata = m.nome.toUpperCase()
    const cidadeNorm  = normalize(m.nome)

    try {
      await patch(m.uf, cidadeExata, m.distancia_km)
      ok++
      // Se nome tem acento, atualiza também a versão sem acento
      if (cidadeNorm !== cidadeExata) {
        await patch(m.uf, cidadeNorm, m.distancia_km)
      }
    } catch (err) {
      erros++
    }
    process.stdout.write(`\r   ${ok + erros}/${total} — ${m.uf} / ${m.nome}`.padEnd(80))
  }

  console.log(`\n\n✅ Concluído! ${ok} municípios processados${erros ? `, ${erros} erros` : ''}.`)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
