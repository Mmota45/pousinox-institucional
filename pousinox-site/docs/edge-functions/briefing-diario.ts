// Edge Function: briefing-diario
// Cron: 0 7 * * * (7h diário)
// Deploy: supabase functions deploy briefing-diario
// Configurar cron no Supabase Dashboard → Database → Extensions → pg_cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const hoje = new Date().toISOString().split('T')[0]

  // Verificar se já gerou hoje
  const { data: existe } = await supabase.from('briefings').select('id').eq('data', hoje).single()
  if (existe) return new Response(JSON.stringify({ ok: true, msg: 'Briefing já gerado hoje' }))

  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const ontem = new Date(Date.now() - 86400000).toISOString()

  // Agregar dados em paralelo
  const [vendas, pipeline, followups, vencidos, estoque, ncs] = await Promise.allSettled([
    supabase.from('vendas').select('valor_recebido').gte('data_venda', inicioMes),
    supabase.from('pipeline_deals').select('valor, estagio').not('estagio', 'in', '("ganho","perdido")'),
    supabase.from('followups').select('id').eq('status', 'pendente').lt('data_prevista', hoje),
    supabase.from('fin_lancamentos').select('valor').eq('status', 'pendente').lt('data_vencimento', hoje),
    supabase.from('estoque_itens').select('id, saldo_atual, estoque_minimo').eq('ativo', true).gt('estoque_minimo', 0),
    supabase.from('nao_conformidades').select('id').eq('status', 'aberta'),
  ])

  // Processar KPIs
  const vendasArr = vendas.status === 'fulfilled' ? (vendas.value.data ?? []) : []
  const faturamento = vendasArr.reduce((s: number, v: any) => s + Number(v.valor_recebido || 0), 0)
  const pipelineArr = pipeline.status === 'fulfilled' ? (pipeline.value.data ?? []) : []
  const receitaPipeline = pipelineArr.reduce((s: number, d: any) => s + Number(d.valor || 0), 0)
  const followupsAtrasados = followups.status === 'fulfilled' ? (followups.value.data?.length ?? 0) : 0
  const vencidosArr = vencidos.status === 'fulfilled' ? (vencidos.value.data ?? []) : []
  const totalVencido = vencidosArr.reduce((s: number, v: any) => s + Number(v.valor || 0), 0)
  const estoqueArr = estoque.status === 'fulfilled' ? (estoque.value.data ?? []) : []
  const abaixoMin = estoqueArr.filter((e: any) => e.saldo_atual < e.estoque_minimo).length
  const ncsAbertas = ncs.status === 'fulfilled' ? (ncs.value.data?.length ?? 0) : 0

  const fmt = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Montar briefing
  const alertas: string[] = []
  if (followupsAtrasados > 0) alertas.push(`${followupsAtrasados} follow-ups atrasados`)
  if (totalVencido > 0) alertas.push(`${fmt(totalVencido)} em títulos vencidos`)
  if (abaixoMin > 0) alertas.push(`${abaixoMin} itens abaixo do estoque mínimo`)
  if (ncsAbertas > 0) alertas.push(`${ncsAbertas} NCs abertas`)

  const acoes: string[] = []
  if (followupsAtrasados > 0) acoes.push('Priorizar follow-ups atrasados na Central de Vendas')
  if (totalVencido > 0) acoes.push('Verificar títulos vencidos no Financeiro')
  if (abaixoMin > 0) acoes.push('Gerar solicitações de compra para itens críticos')

  const conteudo = {
    resumo: `Faturamento no mês: ${fmt(faturamento)}. Pipeline ativo: ${fmt(receitaPipeline)} em ${pipelineArr.length} deals.`,
    kpis: [
      { label: 'Faturamento mês', valor: fmt(faturamento) },
      { label: 'Pipeline', valor: fmt(receitaPipeline) },
      { label: 'Deals ativos', valor: String(pipelineArr.length) },
      { label: 'Vendas mês', valor: String(vendasArr.length) },
    ],
    alertas,
    acoes,
  }

  await supabase.from('briefings').insert({ data: hoje, conteudo })

  // Gerar alertas de anomalia se necessário
  if (followupsAtrasados >= 10) {
    await supabase.from('alertas').insert({
      tipo: 'followup_acumulado',
      severidade: 'alta',
      mensagem: `${followupsAtrasados} follow-ups acumulados — risco de perda de oportunidades`,
      dados: { count: followupsAtrasados },
    })
  }
  if (abaixoMin >= 5) {
    await supabase.from('alertas').insert({
      tipo: 'estoque_critico',
      severidade: 'alta',
      mensagem: `${abaixoMin} itens abaixo do estoque mínimo`,
      dados: { count: abaixoMin },
    })
  }

  return new Response(JSON.stringify({ ok: true, briefing: conteudo }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
