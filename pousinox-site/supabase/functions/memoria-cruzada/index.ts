// Edge Function: memoria-cruzada
// Cron: 0 2 * * * (2h da manhã, diário)
// Cruza dados entre módulos para gerar insights acionáveis

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const insights: { tipo: string; mensagem: string; dados: Record<string, any> }[] = []
  const hoje = new Date()

  // 1. Clientes com ciclo de reposição próximo
  // Busca clientes que compraram há ~80% do ciclo médio de reposição
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, razao_social, rfm_recencia, rfm_frequencia, rfm_valor')
    .not('rfm_frequencia', 'is', null)
    .gt('rfm_frequencia', 1)
    .gt('rfm_valor', 0)

  if (clientes) {
    for (const c of clientes) {
      // Ciclo médio estimado: 365 / frequência anual
      const cicloMedio = Math.round(365 / c.rfm_frequencia)
      const diasDesdeUltima = c.rfm_recencia || 0
      const percentualCiclo = diasDesdeUltima / cicloMedio

      // Entre 70-90% do ciclo = momento ideal de contato
      if (percentualCiclo >= 0.7 && percentualCiclo <= 0.9) {
        insights.push({
          tipo: 'reposicao_proxima',
          mensagem: `${c.razao_social} deve precisar de reposição em ~${Math.round(cicloMedio - diasDesdeUltima)} dias (ciclo médio: ${cicloMedio}d)`,
          dados: { cliente_id: c.id, nome: c.razao_social, ciclo_medio: cicloMedio, dias_desde_ultima: diasDesdeUltima },
        })
      }
    }
  }

  // 2. Prospects quentes sem deal
  const { data: prospects } = await supabase
    .rpc('fn_top_prospects', { n: 20, filtro_uf: null })

  if (prospects) {
    for (const p of prospects) {
      // Verificar se já tem deal
      const { data: deal } = await supabase
        .from('pipeline_deals')
        .select('id')
        .eq('prospect_id', p.id)
        .not('estagio', 'in', '("perdido")')
        .limit(1)
        .single()

      if (!deal) {
        insights.push({
          tipo: 'prospect_quente_sem_deal',
          mensagem: `Prospect ${p.razao_social} (score ${p.score_total?.toFixed(1)}) sem deal ativo — considerar abordagem`,
          dados: { prospect_id: p.id, nome: p.razao_social, score: p.score_total, uf: p.uf },
        })
      }
    }
  }

  // 3. Deals parados com proposta visualizada
  const { data: deals } = await supabase
    .from('pipeline_deals')
    .select('id, titulo, estagio, updated_at')
    .eq('estagio', 'proposta')

  if (deals) {
    const limiteParado = new Date(hoje.getTime() - 7 * 86400000).toISOString()
    const parados = deals.filter((d: any) => d.updated_at < limiteParado)
    if (parados.length > 0) {
      insights.push({
        tipo: 'deal_proposta_parado',
        mensagem: `${parados.length} deals em "proposta" há 7+ dias sem movimento — follow-up urgente`,
        dados: { deals: parados.map((d: any) => ({ id: d.id, titulo: d.titulo })) },
      })
    }
  }

  // 4. Concentração de receita
  if (clientes) {
    const sorted = [...clientes].sort((a, b) => (b.rfm_valor || 0) - (a.rfm_valor || 0))
    const totalValor = sorted.reduce((s, c) => s + (c.rfm_valor || 0), 0)
    if (totalValor > 0 && sorted.length >= 5) {
      const top3Valor = sorted.slice(0, 3).reduce((s, c) => s + (c.rfm_valor || 0), 0)
      const concentracao = (top3Valor / totalValor) * 100
      if (concentracao > 50) {
        insights.push({
          tipo: 'concentracao_receita',
          mensagem: `${concentracao.toFixed(0)}% da receita concentrada em 3 clientes — diversificar base`,
          dados: {
            top3: sorted.slice(0, 3).map(c => ({ nome: c.razao_social, valor: c.rfm_valor })),
            concentracao,
          },
        })
      }
    }
  }

  // Inserir insights (evitar duplicatas do dia)
  const hojeFmt = hoje.toISOString().split('T')[0]
  let inseridos = 0
  for (const ins of insights) {
    const { data: existe } = await supabase
      .from('insights')
      .select('id')
      .eq('tipo', ins.tipo)
      .gte('criado_em', hojeFmt + 'T00:00:00')
      .limit(1)
      .single()

    if (!existe) {
      await supabase.from('insights').insert(ins)
      inseridos++
    }
  }

  return new Response(JSON.stringify({ ok: true, gerados: insights.length, inseridos }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
