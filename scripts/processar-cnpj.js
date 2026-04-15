/**
 * processar-cnpj.js
 * Filtra a base pública de CNPJs da Receita Federal e gera um CSV
 * com prospects qualificados para a Pousinox.
 *
 * Uso:
 *   node processar-cnpj.js <pasta-com-arquivos-descompactados>
 *
 * Exemplo:
 *   node processar-cnpj.js C:\Users\marco\Downloads\cnpj\2026-03
 *
 * Os arquivos devem estar descompactados (.zip extraído) na pasta informada.
 * O CSV de saída será gerado na mesma pasta: prospects_pousinox.csv
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

// ─── Configuração ──────────────────────────────────────────────────────────

const PASTA = process.argv[2]
if (!PASTA) {
  console.error('Uso: node processar-cnpj.js <pasta-com-arquivos>')
  process.exit(1)
}

const OUTPUT = path.join(PASTA, 'prospects_pousinox.csv')

// CNAEs → Equipamentos Inox (Brasil todo)
const CNAES_INOX = new Set([
  '5611201', // Restaurantes e similares
  '5611203', // Lanchonetes e casas de sucos
  '5611202', // Bares
  '5612100', // Serviços ambulantes de alimentação
  '1091102', // Padaria artesanal
  '4721102', // Padaria com revenda
  '1091101', // Panificação industrial
  '4711301', // Hipermercados
  '4711302', // Supermercados
  '4712100', // Minimercados e mercearias
  '4722901', // Açougues
  '4722902', // Peixarias
  '8610101', // Hospitais
  '8610102', // Pronto-socorros
  '8630501', // Clínicas com cirurgia
  '8630502', // Clínicas com exames
  '8640202', // Laboratórios clínicos
  '8640201', // Laboratórios de anatomia patológica
  '2121101', // Fabricação de medicamentos humanos
  '7500100', // Clínicas e hospitais veterinários
  '5510801', // Hotéis
  '5510802', // Apart-hotéis
])

// CNAEs → Fixador de Porcelanato (filtro: Brasil todo)
const CNAES_FIXADOR = new Set([
  '4120400', // Construtoras de edifícios
  '4399103', // Serviços de alvenaria e revestimento
  '4330405', // Aplicação de revestimentos
  '7111100', // Arquitetura
])

const TODOS_CNAES = new Set([...CNAES_INOX, ...CNAES_FIXADOR])

// Segmento por CNAE
const SEGMENTO = {
  '5611201': 'Restaurantes', '5611203': 'Restaurantes', '5611202': 'Restaurantes', '5612100': 'Restaurantes',
  '1091102': 'Panificação',  '4721102': 'Panificação',  '1091101': 'Panificação',
  '4711301': 'Supermercados','4711302': 'Supermercados','4712100': 'Supermercados',
  '4722901': 'Açougues',     '4722902': 'Peixarias',
  '8610101': 'Hospitalar',   '8610102': 'Hospitalar',   '8630501': 'Hospitalar',   '8630502': 'Hospitalar',
  '8640202': 'Laboratórios', '8640201': 'Laboratórios', '2121101': 'Laboratórios',
  '7500100': 'Veterinária',
  '5510801': 'Hotelaria',    '5510802': 'Hotelaria',
  '4120400': 'Construtoras', '4399103': 'Revestimentos','4330405': 'Revestimentos','7111100': 'Arquitetura',
}

// Produto por CNAE
const PRODUTO = {
  '5611201': 'Equipamentos Inox', '5611203': 'Equipamentos Inox', '5611202': 'Equipamentos Inox', '5612100': 'Equipamentos Inox',
  '1091102': 'Equipamentos Inox', '4721102': 'Equipamentos Inox', '1091101': 'Equipamentos Inox',
  '4711301': 'Equipamentos Inox', '4711302': 'Equipamentos Inox', '4712100': 'Equipamentos Inox',
  '4722901': 'Equipamentos Inox', '4722902': 'Equipamentos Inox',
  '8610101': 'Equipamentos Inox', '8610102': 'Equipamentos Inox', '8630501': 'Equipamentos Inox', '8630502': 'Equipamentos Inox',
  '8640202': 'Equipamentos Inox', '8640201': 'Equipamentos Inox', '2121101': 'Equipamentos Inox',
  '7500100': 'Equipamentos Inox',
  '5510801': 'Equipamentos Inox', '5510802': 'Equipamentos Inox',
  '4120400': 'Fixador Porcelanato', '4399103': 'Fixador Porcelanato', '4330405': 'Fixador Porcelanato', '7111100': 'Fixador Porcelanato',
}

const PORTE = {
  '00': 'Não informado', '01': 'Micro Empresa', '03': 'Pequeno Porte', '05': 'Médio/Grande'
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function csvField(v) {
  if (!v) return ''
  const s = String(v).trim()
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function streamLines(filePath, onLine) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    rl.on('line', onLine)
    rl.on('close', resolve)
    rl.on('error', reject)
    stream.on('error', reject)
  })
}

function findFiles(prefix) {
  return fs.readdirSync(PASTA)
    .filter(f => f.toLowerCase().startsWith(prefix.toLowerCase()) && !f.endsWith('.zip'))
    .map(f => path.join(PASTA, f))
    .sort()
}

function decodeLatin1(buf) {
  return buf.toString('latin1')
}

// ─── Passo 1: Carregar municípios ─────────────────────────────────────────

async function carregarMunicipios() {
  const municipios = new Map()
  const files = findFiles('Municipios')
  if (files.length === 0) {
    console.warn('⚠  Arquivo Municipios não encontrado — código do município será mantido')
    return municipios
  }
  console.log('📍 Carregando municípios...')
  await streamLines(files[0], line => {
    const cols = decodeLatin1(Buffer.from(line, 'latin1')).split(';')
    if (cols.length >= 2) municipios.set(cols[0].trim(), cols[1].trim())
  })
  console.log(`   ${municipios.size} municípios carregados`)
  return municipios
}

// ─── Passo 2: Processar Estabelecimentos ──────────────────────────────────

async function processarEstabelecimentos(municipios) {
  const prospects = new Map() // cnpj_basico → dados
  const files = findFiles('Estabelecimentos')

  if (files.length === 0) {
    console.error('❌ Nenhum arquivo Estabelecimentos encontrado em:', PASTA)
    process.exit(1)
  }

  console.log(`\n🏢 Processando ${files.length} arquivo(s) de Estabelecimentos...`)
  let total = 0, encontrados = 0

  for (const file of files) {
    console.log(`   → ${path.basename(file)}`)
    await streamLines(file, line => {
      total++
      const raw = decodeLatin1(Buffer.from(line, 'latin1'))
      const cols = raw.split(';')
      if (cols.length < 22) return

      const cnpjBasico     = cols[0].trim()
      const cnpjOrdem      = cols[1].trim()
      const cnpjDv         = cols[2].trim()
      const nomeFantasia   = cols[4].trim()
      const situacao       = cols[5].trim()
      const cnae           = cols[11].trim()
      const logradouro     = cols[14].trim()
      const numero         = cols[15].trim()
      const complemento    = cols[16].trim()
      const bairro         = cols[17].trim()
      const cep            = cols[18].trim()
      const uf             = cols[19].trim()
      const codMunicipio   = cols[20].trim()
      const ddd1           = cols[21].trim()
      const tel1           = cols[22]?.trim() || ''
      const ddd2           = cols[23]?.trim() || ''
      const tel2           = cols[24]?.trim() || ''
      const email          = cols[27]?.trim() || ''

      // Apenas ativos
      if (situacao !== '02') return

      // Verifica CNAE
      if (!TODOS_CNAES.has(cnae)) return


      const cnpj = cnpjBasico + cnpjOrdem + cnpjDv
      const cidade = municipios.get(codMunicipio) || codMunicipio
      const telefone1 = ddd1 && tel1 ? `(${ddd1}) ${tel1}` : ''
      const telefone2 = ddd2 && tel2 ? `(${ddd2}) ${tel2}` : ''
      const endereco = [logradouro, numero, complemento].filter(Boolean).join(', ')

      prospects.set(cnpjBasico, {
        cnpj,
        cnpj_basico: cnpjBasico,
        nome_fantasia: nomeFantasia,
        razao_social: '',   // preenchido no passo 3
        porte: '',          // preenchido no passo 3
        segmento: SEGMENTO[cnae] || 'Outros',
        produto: PRODUTO[cnae] || '',
        cnae,
        uf,
        cidade,
        bairro,
        endereco,
        cep,
        telefone1,
        telefone2,
        email,
      })
      encontrados++
    })
  }

  console.log(`   ✓ ${encontrados.toLocaleString()} prospects encontrados de ${total.toLocaleString()} registros`)
  return prospects
}

// ─── Passo 3: Enriquecer com dados das Empresas ──────────────────────────

async function enriquecerEmpresas(prospects) {
  const files = findFiles('Empresas')
  if (files.length === 0) {
    console.warn('⚠  Arquivos Empresas não encontrados — razão social não disponível')
    return
  }

  console.log(`\n📋 Lendo ${files.length} arquivo(s) de Empresas...`)
  let enriquecidos = 0

  for (const file of files) {
    console.log(`   → ${path.basename(file)}`)
    await streamLines(file, line => {
      const raw = decodeLatin1(Buffer.from(line, 'latin1'))
      const cols = raw.split(';')
      if (cols.length < 6) return

      const cnpjBasico  = cols[0].trim()
      const razaoSocial = cols[1].trim()
      const porte       = cols[5].trim()

      if (prospects.has(cnpjBasico)) {
        const p = prospects.get(cnpjBasico)
        p.razao_social = razaoSocial
        p.porte = PORTE[porte] || porte
        enriquecidos++
      }
    })
  }

  console.log(`   ✓ ${enriquecidos.toLocaleString()} registros enriquecidos`)
}

// ─── Passo 4: Gerar CSV ───────────────────────────────────────────────────

function gerarCSV(prospects) {
  console.log(`\n💾 Gerando CSV em: ${OUTPUT}`)

  const header = [
    'cnpj', 'razao_social', 'nome_fantasia', 'porte',
    'segmento', 'produto', 'cnae',
    'uf', 'cidade', 'bairro', 'endereco', 'cep',
    'telefone1', 'telefone2', 'email'
  ].join(';')

  const linhas = [header]

  for (const p of prospects.values()) {
    linhas.push([
      csvField(p.cnpj),
      csvField(p.razao_social),
      csvField(p.nome_fantasia),
      csvField(p.porte),
      csvField(p.segmento),
      csvField(p.produto),
      csvField(p.cnae),
      csvField(p.uf),
      csvField(p.cidade),
      csvField(p.bairro),
      csvField(p.endereco),
      csvField(p.cep),
      csvField(p.telefone1),
      csvField(p.telefone2),
      csvField(p.email),
    ].join(';'))
  }

  fs.writeFileSync(OUTPUT, linhas.join('\n'), { encoding: 'utf8' })
  console.log(`   ✓ ${(prospects.size).toLocaleString()} prospects exportados`)
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Pousinox — Processador CNPJ        ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`\nPasta: ${PASTA}\n`)

  const t0 = Date.now()

  const municipios = await carregarMunicipios()
  const prospects  = await processarEstabelecimentos(municipios)
  await enriquecerEmpresas(prospects)
  gerarCSV(prospects)

  const seg = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n✅ Concluído em ${seg}s`)
  console.log(`📄 Arquivo gerado: ${OUTPUT}`)
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
