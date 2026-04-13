// Teste local: deno run --allow-env --allow-net test.ts
// Requer: ANTHROPIC_API_KEY no ambiente

import { normalizeBudget } from './extractor.ts'

const FIXTURE = `
POUSINOX
Pouso Alegre - MG  (35) 3423-8994  adm@pousinox.com.br  pousinox.com.br

ORÇAMENTO Nº 2026/001
Emissão: 03/02/2026    Validade: 10/02/2026

DESTINATÁRIO
Empresa: —
Responsável: —
CNPJ/CPF: —

ITENS
Nº  Descrição                              Qtd  Un   Vlr Unit.   Total
1   Tampa para caixa de máquina piscina    1    UN   —           —

ESPECIFICAÇÕES TÉCNICAS
material: Aço inox | liga: 304 | acabamento: fosco | superficie: antiderrapante
comprimento: 765 mm | largura: 645 mm | altura: 60 mm | espessura: 3 mm | peso: 2.587 kg

Componentes
Chapa antiderrapante  1
Tubo de dreno         2

Ref.: PRJ-2026-0005 — Tampa para caixa de máquina piscina
Observações: Ref.: PRJ-2026-0005 — Tampa para caixa de máquina piscina

TOTAL: —

Pousinox Indústria e Comércio de Aço Inox · pousinox.com.br · (35) 3423-8994 · adm@pousinox.com.br
Orçamento Nº 2026/001 · Emitido em 03/02/2026 · Válido até 10/02/2026
`

async function run() {
  console.log('▶ Extraindo orçamento...\n')
  const result = await normalizeBudget(FIXTURE)

  if (!result.ok) {
    console.error('✗ Erro:', result.error)
    if (result.raw) console.error('  Raw:', JSON.stringify(result.raw, null, 2))
    Deno.exit(1)
  }

  const d = result.data

  // Asserts básicos
  const assert = (cond: boolean, msg: string) => {
    if (!cond) { console.error(`✗ FALHOU: ${msg}`); Deno.exit(1) }
    console.log(`✓ ${msg}`)
  }

  assert(d.orcamento.numero === '2026/001',         'numero do orçamento')
  assert(d.orcamento.emissao === '2026-02-03',      'data de emissão')
  assert(d.item.descricao?.includes('Tampa') ?? false, 'descrição do item')
  assert(d.produto.liga === '304',                  'liga separada do material')
  assert(d.produto.acabamento === 'fosco',          'acabamento')
  assert(d.produto.superficie === 'antiderrapante', 'superficie')
  assert(d.produto.dimensoes.comprimento_mm === 765,'comprimento')
  assert(d.produto.dimensoes.largura_mm === 645,    'largura')
  assert(d.produto.dimensoes.espessura_mm === 3,    'espessura')
  assert(d.produto.peso_kg === 2.587,               'peso (decimal, não milhar)')
  assert(d.componentes.length >= 2,                 'componentes extraídos')
  assert(d.referencias.codigo?.includes('PRJ') ?? false, 'código de referência')

  console.log('\n✅ Todos os asserts passaram.\n')
  console.log('Issues reportadas:', d.issues.length)
  d.issues.forEach(i => console.log(`  [${i.tipo}] ${i.campo}: ${i.motivo}`))

  console.log('\nJSON completo:')
  console.log(JSON.stringify(d, null, 2))
}

run()
