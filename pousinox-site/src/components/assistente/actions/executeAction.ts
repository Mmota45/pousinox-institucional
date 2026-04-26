import { supabaseAdmin } from '../../../lib/supabase'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

// Descrições legíveis das ações
export const ACTION_LABELS: Record<string, string> = {
  criar_orcamento: 'Criar Orçamento',
  mover_deal: 'Mover Deal no Pipeline',
  criar_ordem_producao: 'Criar Ordem de Produção',
  registrar_lancamento: 'Registrar Lançamento Financeiro',
  consultar_dados: 'Consultar Dados',
}

export async function executeAction(tool: ToolCall): Promise<ActionResult> {
  const inp = tool.input

  switch (tool.name) {
    case 'criar_orcamento': {
      const { data, error } = await supabaseAdmin.from('orcamentos').insert({
        cliente_nome: inp.cliente_nome,
        cliente_cnpj: inp.cliente_cnpj || null,
        observacoes: inp.observacoes || null,
        status: 'rascunho',
        itens: inp.itens || [],
      }).select('id').single()
      if (error) return { success: false, message: `Erro ao criar orçamento: ${error.message}` }
      return { success: true, message: `Orçamento #${data.id} criado com sucesso.`, data }
    }

    case 'mover_deal': {
      const { error } = await supabaseAdmin.from('pipeline_deals')
        .update({ estagio: inp.novo_estagio, motivo_perda: inp.motivo || null })
        .eq('id', inp.deal_id)
      if (error) return { success: false, message: `Erro ao mover deal: ${error.message}` }
      return { success: true, message: `Deal #${inp.deal_id} movido para "${inp.novo_estagio}".` }
    }

    case 'criar_ordem_producao': {
      const { data, error } = await supabaseAdmin.from('ordens_producao').insert({
        descricao: inp.descricao,
        projeto_id: inp.projeto_id || null,
        prioridade: inp.prioridade || 'media',
        observacoes: inp.observacoes || null,
        status: 'planejada',
      }).select('id, numero').single()
      if (error) return { success: false, message: `Erro ao criar OP: ${error.message}` }
      return { success: true, message: `OP ${data.numero || '#' + data.id} criada.`, data }
    }

    case 'registrar_lancamento': {
      const { data, error } = await supabaseAdmin.from('fin_lancamentos').insert({
        tipo: inp.tipo,
        descricao: inp.descricao,
        valor: inp.valor,
        data_vencimento: inp.data_vencimento || new Date().toISOString().slice(0, 10),
        categoria_id: inp.categoria_id || null,
        status: 'pendente',
        origem: 'manual',
      }).select('id').single()
      if (error) return { success: false, message: `Erro ao registrar lançamento: ${error.message}` }
      return { success: true, message: `Lançamento #${data.id} registrado (${inp.tipo}).`, data }
    }

    case 'consultar_dados': {
      const tabela = inp.tabela as string
      const limite = (inp.limite as number) || 20
      const allowed = ['clientes', 'pipeline_deals', 'orcamentos', 'ordens_producao', 'estoque_itens', 'fin_lancamentos', 'prospeccao', 'market_keywords']
      if (!allowed.includes(tabela)) return { success: false, message: `Tabela "${tabela}" não permitida.` }
      const { data, error } = await supabaseAdmin.from(tabela).select('*').limit(limite)
      if (error) return { success: false, message: `Erro ao consultar ${tabela}: ${error.message}` }
      return { success: true, message: `${data.length} registros de ${tabela}.`, data }
    }

    default:
      return { success: false, message: `Ação desconhecida: ${tool.name}` }
  }
}

// Formata parâmetros de uma ação para exibição legível
export function formatActionParams(tool: ToolCall): string[] {
  const lines: string[] = []
  const inp = tool.input
  for (const [k, v] of Object.entries(inp)) {
    if (v === null || v === undefined) continue
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    if (Array.isArray(v)) {
      lines.push(`${label}: ${v.length} item(ns)`)
    } else if (typeof v === 'number') {
      lines.push(`${label}: ${k.includes('valor') ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : v}`)
    } else {
      lines.push(`${label}: ${v}`)
    }
  }
  return lines
}
