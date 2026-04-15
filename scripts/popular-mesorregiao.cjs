/**
 * popular-mesorregiao.cjs
 * Atualiza a coluna mesorregiao/microrregiao na tabela prospeccao
 * em lotes pequenos via Supabase API (sem timeout).
 *
 * Uso:
 *   node popular-mesorregiao.cjs
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const SUPABASE_URL = 'https://vcektwtpofypsgdgdjlx.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZWt0d3Rwb2Z5cHNnZGdkamx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2NTgyNSwiZXhwIjoyMDg5OTQxODI1fQ.uuTk39oZ1JZW2BfsHytiwhO6f0kHk92AWX5WqKewulg'

// Lê o CSV gerado pelo script anterior
const csvPath = path.join(__dirname, 'ibge_municipios.csv')
if (!fs.existsSync(csvPath)) {
  console.error('❌ ibge_municipios.csv não encontrado. Rode gerar-mesorregiao.cjs primeiro.')
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

function rpcRequest(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql })
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`)
    // Usa endpoint de SQL direto via service role
    const opts = {
      hostname: `vcektwtpofypsgdgdjlx.supabase.co`,
      path: `/rest/v1/`,
      method: 'POST',
    }
    // Usa fetch via https
    const postBody = JSON.stringify({ query: sql })
    const req = https.request({
      hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Length': Buffer.byteLength(postBody),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(postBody)
    req.end()
  })
}

// Faz UPDATE direto via API REST do Supabase (tabela prospeccao)
function updateLote(cidades, uf, mesorregiao, microrregiao) {
  return new Promise((resolve, reject) => {
    // Monta query string para filtrar por UF e cidades
    const cidadesUpper = cidades.map(c => c.toUpperCase())
    const filtro = `uf=eq.${encodeURIComponent(uf)}&cidade=in.(${cidadesUpper.map(c => encodeURIComponent(c)).join(',')})`
    const postBody = JSON.stringify({ mesorregiao, microrregiao })

    const req = https.request({
      hostname: 'vcektwtpofypsgdgdjlx.supabase.co',
      path: `/rest/v1/prospeccao?${filtro}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(postBody),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve()
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    req.write(postBody)
    req.end()
  })
}

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  Pousinox — Popular Mesorregiões     ║')
  console.log('╚══════════════════════════════════════╝\n')

  const municipios = parseCSV(fs.readFileSync(csvPath, 'utf8'))
  console.log(`📄 ${municipios.length} municípios carregados do CSV\n`)

  // Ordena: MG primeiro, depois alfabético por UF
  const ordenados = [...municipios].sort((a, b) => {
    if (a.uf === 'MG' && b.uf !== 'MG') return -1
    if (b.uf === 'MG' && a.uf !== 'MG') return 1
    return a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome)
  })

  const total = ordenados.length
  let atual = 0, erros = 0, pulados = 0

  console.log(`🔄 Atualizando ${total} municípios um a um...\n`)

  for (const m of ordenados) {
    atual++
    try {
      await updateLote([m.nome.toUpperCase()], m.uf, m.mesorregiao, m.microrregiao)
      process.stdout.write(`\r   ${atual}/${total} — ${m.uf} / ${m.nome}`.padEnd(80))
    } catch (err) {
      if (err.message.includes('timeout')) {
        // Retry uma vez após 2s
        await new Promise(r => setTimeout(r, 2000))
        try {
          await updateLote([m.nome.toUpperCase()], m.uf, m.mesorregiao, m.microrregiao)
        } catch {
          erros++
        }
      } else {
        erros++
      }
    }
  }

  console.log(`\n\n✅ Concluído! ${total - erros - pulados} atualizados${erros ? `, ${erros} erros` : ''}.`)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
