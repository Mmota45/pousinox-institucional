// Edge Function: alertas-anomalia
// Cron: 0 1 * * * (1h da manhã, diário)
// Compara métricas atuais com média móvel 30 dias

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface AnomaliaCheck {
  tipo: string
  mensagem: string
  severidade: string
  dados: Record<string, any>
}

Deno.serve(async () => {
  const anomalias: AnomaliaCheck[] = []
  const agora = new Date()
  const dia30atras = new Date(agora.getTime() - 30 * 86400000).toISOString()
  const dia7atras = new Date(agora.getTime() - 7 * 86400000).toISOString()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

  // 1. Faturamento: comparar mês atual (projetado) vs média dos últimos 3 meses
  const [vendasMes, vendasHist] = await Promise.allSettled([
    supabase.from('vendas').select('valor_recebido').gte('data_venda', inicioMes),
    supabase.from('vendas').select('valor_recebido, data_venda').gte('data_venda', new Date(agora.getFullYear(), agora.getMonth() - 3, 1).toISOString()).lt('data_venda', inicioMes),
  ])

  if (vendasMes.status === 'fulfilled' && vendasHist.status === 'fulfilled') {
    const fatMes = (vendasMes.value.data ?? []).reduce((s: number, v: any) => s + Number(v.valor_recebido || 0), 0)
    const fatHist = (vendasHist.value.data ?? []).reduce((s: number, v: any) => s + Number(v.valor_recebido || 0), 0)
    const mediaHistMes = fatHist / 3

    if (mediaHistMes > 0) {
      const variacao = ((fatMes - mediaHistMes) / mediaHistMes) * 100
      if (variacao < -20) {
        anomalias.push({
          tipo: 'faturamento_queda',
          mensagem: `Faturamento ${Math.abs(variacao).toFixed(0)}% abaixo da média — R$ ${fatMes.toFixed(0)} vs média R$ ${mediaHistMes.toFixed(0)}`,
          severidade: variacao < -40 ? 'critica' : 'alta',
          dados: { fatMes, mediaHistMes, variacao },
        })
      }
    }
  }

  // 2. Leads: comparar última semana vs média semanal 30 dias
  const [leadsSemana, leadsHist] = await Promise.allSettled([
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', dia7atras),
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', dia30atras).lt('created_at', dia7atras),
  ])

  if (leadsSemana.status === 'fulfilled' && leadsHist.status === 'fulfilled') {
    const countSemana = leadsSemana.value.count ?? 0
    const countHist = leadsHist.value.count ?? 0
    const mediaSemanal = countHist / 3.3 // ~23 dias / 7

    if (mediaSemanal > 2) {
      const variacao = ((countSemana - mediaSemanal) / mediaSemanal) * 100
      if (Math.abs(variacao) > 50) {
        anomalias.push({
          tipo: variacao > 0 ? 'leads_pico' : 'leads_queda',
          mensagem: variacao > 0
            ? `Pico de leads: ${countSemana} na semana (+${variacao.toFixed(0)}% vs média)`
            : `Queda de leads: ${countSemana} na semana (${variacao.toFixed(0)}% vs média)`,
          severidade: 'media',
          dados: { countSemana, mediaSemanal, variacao },
        })
      }
    }
  }

  // 3. Clientes top inativos (30+ dias sem compra entre os top 20 por faturamento)
  const { data: topClientes } = await supabase
    .from('clientes')
    .select('id, razao_social, rfm_recencia')
    .not('rfm_recencia', 'is', null)
    .order('rfm_valor', { ascending: false })
    .limit(20)

  if (topClientes) {
    const inativos = topClientes.filter((c: any) => c.rfm_recencia && c.rfm_recencia > 60)
    if (inativos.length > 0) {
      anomalias.push({
        tipo: 'cliente_top_inativo',
        mensagem: `${inativos.length} clientes top inativos há 60+ dias: ${inativos.slice(0, 3).map((c: any) => c.razao_social).join(', ')}`,
        severidade: 'alta',
        dados: { clientes: inativos.map((c: any) => ({ id: c.id, nome: c.razao_social, dias: c.rfm_recencia })) },
      })
    }
  }

  // Inserir alertas (evitar duplicatas do mesmo dia)
  const hoje = agora.toISOString().split('T')[0]
  for (const a of anomalias) {
    const { data: existe } = await supabase
      .from('alertas')
      .select('id')
      .eq('tipo', a.tipo)
      .gte('criado_em', hoje + 'T00:00:00')
      .limit(1)
      .single()

    if (!existe) {
      await supabase.from('alertas').insert({
        tipo: a.tipo,
        severidade: a.severidade,
        mensagem: a.mensagem,
        dados: a.dados,
      })
    }
  }

  return new Response(JSON.stringify({ ok: true, anomalias: anomalias.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
