// Edge Function: event-dispatcher
// Cron: 0 8 * * * (8h diário) — pode também ser acionado por webhooks
// Motor de eventos: avalia regras ativas e dispara ações

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface EventRule {
  id: number
  nome: string
  trigger_tipo: string
  condicao: Record<string, any>
  acao: Record<string, any>
}

Deno.serve(async (req) => {
  // Carregar regras ativas
  const { data: rules } = await supabase
    .from('event_rules')
    .select('*')
    .eq('ativo', true)

  if (!rules || rules.length === 0) {
    return new Response(JSON.stringify({ ok: true, msg: 'Sem regras ativas' }))
  }

  const hoje = new Date().toISOString().split('T')[0]
  const resultados: { regra: string; disparou: boolean; detalhes?: string }[] = []

  for (const rule of rules as EventRule[]) {
    try {
      const result = await avaliarRegra(rule, hoje)
      resultados.push(result)
    } catch (err: any) {
      resultados.push({ regra: rule.nome, disparou: false, detalhes: err.message })
    }
  }

  return new Response(JSON.stringify({ ok: true, resultados }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function avaliarRegra(rule: EventRule, hoje: string): Promise<{ regra: string; disparou: boolean; detalhes?: string }> {
  switch (rule.trigger_tipo) {
    case 'nf_vencida': {
      const dias = rule.condicao.dias_atraso || 3
      const limite = new Date(Date.now() - dias * 86400000).toISOString()
      const { data } = await supabase
        .from('fin_lancamentos')
        .select('id, descricao, valor, data_vencimento')
        .eq('tipo', 'receita')
        .eq('status', 'pendente')
        .lt('data_vencimento', limite)
        .limit(20)
      if (data && data.length > 0) {
        await supabase.from('alertas').insert({
          tipo: 'nf_vencida',
          severidade: 'alta',
          mensagem: `${data.length} receitas vencidas há ${dias}+ dias`,
          dados: { count: data.length, total: data.reduce((s: number, d: any) => s + Number(d.valor || 0), 0) },
        })
        return { regra: rule.nome, disparou: true, detalhes: `${data.length} vencidas` }
      }
      return { regra: rule.nome, disparou: false }
    }

    case 'deal_parado': {
      const dias = rule.condicao.dias_sem_movimento || 10
      const limite = new Date(Date.now() - dias * 86400000).toISOString()
      const { data } = await supabase
        .from('pipeline_deals')
        .select('id, titulo, estagio, updated_at')
        .not('estagio', 'in', '("ganho","perdido")')
        .lt('updated_at', limite)
        .limit(20)
      if (data && data.length > 0) {
        await supabase.from('alertas').insert({
          tipo: 'deal_parado',
          severidade: 'media',
          mensagem: `${data.length} deals parados há ${dias}+ dias`,
          dados: { deals: data.map((d: any) => ({ id: d.id, titulo: d.titulo, estagio: d.estagio })) },
        })
        return { regra: rule.nome, disparou: true, detalhes: `${data.length} deals` }
      }
      return { regra: rule.nome, disparou: false }
    }

    case 'estoque_baixo': {
      const { data } = await supabase
        .from('estoque_itens')
        .select('id, nome, saldo_atual, estoque_minimo')
        .eq('ativo', true)
        .gt('estoque_minimo', 0)
      const abaixo = (data ?? []).filter((e: any) => e.saldo_atual < e.estoque_minimo)
      if (abaixo.length > 0) {
        // Evitar alerta duplicado do dia
        const { data: existe } = await supabase
          .from('alertas')
          .select('id')
          .eq('tipo', 'estoque_baixo')
          .gte('criado_em', hoje + 'T00:00:00')
          .limit(1)
          .single()
        if (!existe) {
          await supabase.from('alertas').insert({
            tipo: 'estoque_baixo',
            severidade: 'media',
            mensagem: `${abaixo.length} itens abaixo do mínimo`,
            dados: { itens: abaixo.slice(0, 10).map((e: any) => ({ nome: e.nome, atual: e.saldo_atual, min: e.estoque_minimo })) },
          })
        }
        return { regra: rule.nome, disparou: true, detalhes: `${abaixo.length} itens` }
      }
      return { regra: rule.nome, disparou: false }
    }

    case 'cliente_inativo': {
      const dias = rule.condicao.dias_inativo || 60
      const { data } = await supabase
        .from('clientes')
        .select('id, razao_social, rfm_recencia')
        .not('rfm_recencia', 'is', null)
        .gt('rfm_recencia', dias)
        .order('rfm_valor', { ascending: false })
        .limit(10)
      if (data && data.length > 0) {
        const { data: existe } = await supabase
          .from('alertas')
          .select('id')
          .eq('tipo', 'cliente_inativo')
          .gte('criado_em', hoje + 'T00:00:00')
          .limit(1)
          .single()
        if (!existe) {
          await supabase.from('alertas').insert({
            tipo: 'cliente_inativo',
            severidade: 'media',
            mensagem: `${data.length} clientes inativos há ${dias}+ dias`,
            dados: { clientes: data.map((c: any) => ({ id: c.id, nome: c.razao_social, dias: c.rfm_recencia })) },
          })
        }
        return { regra: rule.nome, disparou: true, detalhes: `${data.length} clientes` }
      }
      return { regra: rule.nome, disparou: false }
    }

    case 'inspecao_reprovada': {
      const { data } = await supabase
        .from('inspecoes')
        .select('id, origem_label')
        .eq('resultado', 'reprovado')
        .gte('created_at', hoje + 'T00:00:00')
      if (data && data.length > 0) {
        await supabase.from('alertas').insert({
          tipo: 'inspecao_reprovada',
          severidade: 'alta',
          mensagem: `${data.length} inspeções reprovadas hoje`,
          dados: { inspecoes: data },
        })
        return { regra: rule.nome, disparou: true, detalhes: `${data.length} reprovadas` }
      }
      return { regra: rule.nome, disparou: false }
    }

    default:
      return { regra: rule.nome, disparou: false, detalhes: `Trigger "${rule.trigger_tipo}" não implementado` }
  }
}
