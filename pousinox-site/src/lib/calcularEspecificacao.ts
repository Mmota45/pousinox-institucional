/**
 * Engine de cálculo — Especificação Técnica de Materiais
 * Função pura, sem dependência de React ou Supabase.
 * Reutilizada por AdminOrcamento (interno) e CalculadoraFixador (público).
 */

import type {
  EspecificacaoInput,
  RegraCalculo,
  Consumivel,
  ResultadoEspecificacao,
  ItemCalculado,
} from '../components/Orcamento/especificacaoTypes'

// ── Regras padrão (fallback quando não há banco) ────────────────────────────

export const REGRAS_PADRAO: RegraCalculo[] = [
  { id: 1, modelo_id: null, nome: 'Peça padrão (até 60×60)', lado_max_cm: 60, area_max_cm2: 3600, peso_max_kg: null, fixadores_por_peca: 2, exige_revisao: false, prioridade: 10 },
  { id: 2, modelo_id: null, nome: 'Peça retangular (até 120cm)', lado_max_cm: 120, area_max_cm2: 7200, peso_max_kg: null, fixadores_por_peca: 2, exige_revisao: false, prioridade: 20 },
  { id: 3, modelo_id: null, nome: 'Peça grande (até 150cm)', lado_max_cm: 150, area_max_cm2: 13500, peso_max_kg: null, fixadores_por_peca: 3, exige_revisao: false, prioridade: 30 },
  { id: 4, modelo_id: null, nome: 'Fora da faixa padrão', lado_max_cm: null, area_max_cm2: null, peso_max_kg: null, fixadores_por_peca: 3, exige_revisao: true, prioridade: 99 },
]

export const CONSUMIVEIS_PADRAO: Consumivel[] = [
  { id: 1, nome: 'Fixador / Grampo', tipo: 'fixador', unidade: 'UN', proporcao_por: 1, ordem: 1 },
  { id: 2, nome: 'Parafuso', tipo: 'consumivel', unidade: 'UN', proporcao_por: 1, ordem: 2 },
  { id: 3, nome: 'Bucha', tipo: 'consumivel', unidade: 'UN', proporcao_por: 1, ordem: 3 },
  { id: 4, nome: 'Adesivo PU/MS', tipo: 'consumivel', unidade: 'UN', proporcao_por: 90, ordem: 4 },
  { id: 5, nome: 'Disco de Corte', tipo: 'consumivel', unidade: 'UN', proporcao_por: 90, ordem: 5 },
  { id: 6, nome: 'Broca', tipo: 'consumivel', unidade: 'UN', proporcao_por: 150, ordem: 6 },
]

// ── Engine ───────────────────────────────────────────────────────────────────

export function calcularEspecificacao(
  input: EspecificacaoInput,
  regras: RegraCalculo[] = REGRAS_PADRAO,
  consumiveis: Consumivel[] = CONSUMIVEIS_PADRAO,
): ResultadoEspecificacao {
  const { area_total_m2, largura_cm, altura_cm, perda_pct } = input

  // 1. Área e quantidade de peças
  const area_peca_m2 = (largura_cm / 100) * (altura_cm / 100)
  const qtd_pecas_bruto = Math.ceil(area_total_m2 / area_peca_m2)
  const qtd_pecas = Math.ceil(qtd_pecas_bruto * (1 + perda_pct / 100))

  // 2. Peso da peça (prioridade: direto > kg/m² > estimativa por espessura)
  // Densidade média do porcelanato: ~2.350 kg/m³ (range 2.200–2.500)
  const DENSIDADE_PORCELANATO = 2350 // kg/m³
  let peso_peca_kg = input.peso_peca_kg
  let peso_estimado = false
  if (!peso_peca_kg && input.peso_m2_kg) {
    peso_peca_kg = input.peso_m2_kg * area_peca_m2
  }
  if (!peso_peca_kg && input.espessura_mm) {
    // volume em m³ × densidade
    peso_peca_kg = area_peca_m2 * (input.espessura_mm / 1000) * DENSIDADE_PORCELANATO
    peso_estimado = true
  }

  // 3. Encontrar regra aplicável
  const lado_max = Math.max(largura_cm, altura_cm)
  const area_cm2 = largura_cm * altura_cm
  const revisao_motivos: string[] = []

  // Filtrar regras do modelo ou genéricas, ordenar por prioridade
  const regrasAplicaveis = regras
    .filter(r => r.modelo_id === null || r.modelo_id === input.modelo_id)
    .sort((a, b) => a.prioridade - b.prioridade)

  let regraUsada = regrasAplicaveis[regrasAplicaveis.length - 1] // fallback = última (maior prioridade)

  for (const r of regrasAplicaveis) {
    const dentroLado = r.lado_max_cm === null || lado_max <= r.lado_max_cm
    const dentroArea = r.area_max_cm2 === null || area_cm2 <= r.area_max_cm2
    const dentroPeso = r.peso_max_kg === null || !peso_peca_kg || peso_peca_kg <= r.peso_max_kg

    if (dentroLado && dentroArea && dentroPeso) {
      regraUsada = r
      break
    }
  }

  const fixadores_por_peca = regraUsada.fixadores_por_peca
  const total_fixadores = qtd_pecas * fixadores_por_peca

  // 4. Revisão técnica
  if (regraUsada.exige_revisao) {
    revisao_motivos.push('Peça fora da faixa padrão de cálculo')
  }
  if (peso_peca_kg && peso_peca_kg > 30) {
    revisao_motivos.push(`Peso da peça elevado (${peso_peca_kg.toFixed(1)} kg)`)
  }
  if (lado_max > 150) {
    revisao_motivos.push(`Dimensão acima de 150 cm (${lado_max} cm)`)
  }
  if (!input.espessura_mm && peso_peca_kg && peso_peca_kg > 20) {
    revisao_motivos.push('Espessura não informada para peça pesada')
  }
  if (input.revisao_manual) {
    revisao_motivos.push('Revisão técnica marcada manualmente')
  }
  if (!peso_peca_kg) {
    revisao_motivos.push('Peso não informado — estimativa apenas por geometria')
  } else if (peso_estimado) {
    revisao_motivos.push(`Peso estimado pela espessura (${input.espessura_mm}mm × densidade ~2.350 kg/m³ = ${peso_peca_kg.toFixed(2)} kg)`)
  }

  const revisao_tecnica = revisao_motivos.length > 0

  // 5. Itens derivados
  const itens: ItemCalculado[] = consumiveis
    .filter(c => c.tipo !== 'acessorio')
    .sort((a, b) => a.ordem - b.ordem)
    .map(c => ({
      nome: c.nome,
      quantidade: c.proporcao_por === 1
        ? total_fixadores
        : Math.ceil(total_fixadores / c.proporcao_por),
      unidade: c.unidade,
      tipo: c.tipo,
    }))

  // 6. Status
  const status = revisao_motivos.some(m =>
    m.includes('fora da faixa') || m.includes('manualmente')
  )
    ? 'revisao' as const
    : revisao_tecnica
      ? 'alerta' as const
      : 'padrao' as const

  return {
    area_peca_m2,
    qtd_pecas_bruto,
    qtd_pecas,
    peso_peca_kg,
    peso_estimado,
    fixadores_por_peca,
    total_fixadores,
    regra_aplicada: regraUsada.nome,
    itens,
    revisao_tecnica,
    revisao_motivos,
    status,
  }
}
