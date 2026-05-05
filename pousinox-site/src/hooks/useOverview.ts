import { useState, useEffect, useRef, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'

/* ── Tipos ─────────────────────────────────────────────────────────────── */

export interface OverviewComercial {
  prospects: number
  deals: number
  propostas: number
  followupsAtrasados: number
  receitaPipeline: number
}

export interface OverviewOperacao {
  projetosAtivos: number
  opsEmAndamento: number
  ncsAbertas: number
  manutencoesPendentes: number
}

export interface OverviewFinanceiro {
  receitaMes: number
  despesaMes: number
  saldo: number
  vencidos: number
}

export interface OverviewEstoque {
  alertasMinimo: number
  valorTotal: number
}

export interface OverviewMarketing {
  leadsMes: number
}

export type SectionStatus = 'loading' | 'ok' | 'error'

export interface Overview {
  comercial: OverviewComercial
  operacao: OverviewOperacao
  financeiro: OverviewFinanceiro
  estoque: OverviewEstoque
  marketing: OverviewMarketing
  status: Record<string, SectionStatus>
}

const EMPTY: Overview = {
  comercial: { prospects: 0, deals: 0, propostas: 0, followupsAtrasados: 0, receitaPipeline: 0 },
  operacao: { projetosAtivos: 0, opsEmAndamento: 0, ncsAbertas: 0, manutencoesPendentes: 0 },
  financeiro: { receitaMes: 0, despesaMes: 0, saldo: 0, vencidos: 0 },
  estoque: { alertasMinimo: 0, valorTotal: 0 },
  marketing: { leadsMes: 0 },
  status: { comercial: 'loading', operacao: 'loading', financeiro: 'loading', estoque: 'loading', marketing: 'loading' },
}

const STALE_MS = 30_000

/* ── Hook ──────────────────────────────────────────────────────────────── */

export function useOverview(cnpj?: string) {
  const [data, setData] = useState<Overview>(EMPTY)
  const [loading, setLoading] = useState(true)
  const lastFetch = useRef(0)
  const cacheRef = useRef<Overview>(EMPTY)

  const updateSection = useCallback((section: string, status: SectionStatus, patch?: Partial<Overview>) => {
    setData(prev => {
      const next = { ...prev, ...patch, status: { ...prev.status, [section]: status } }
      cacheRef.current = next
      return next
    })
  }, [])

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFetch.current < STALE_MS) return
    lastFetch.current = now

    setLoading(true)
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
    const hoje = agora.toISOString().slice(0, 10)

    // ── Comercial ──
    ;(async () => {
      try {
        const [prospects, deals, orcs, followups] = await Promise.allSettled([
          supabaseAdmin.from('prospeccao').select('id', { count: 'exact', head: true }),
          supabaseAdmin.from('pipeline_deals').select('valor').neq('estagio', 'ganho').neq('estagio', 'perdido'),
          supabaseAdmin.from('orcamentos').select('id', { count: 'exact', head: true }).eq('status', 'enviado'),
          supabaseAdmin.from('followups').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lt('data_prevista', hoje),
        ])
        const dealsArr = deals.status === 'fulfilled' ? (deals.value.data ?? []) : []
        updateSection('comercial', 'ok', {
          comercial: {
            prospects: prospects.status === 'fulfilled' ? (prospects.value.count ?? 0) : 0,
            deals: dealsArr.length,
            propostas: orcs.status === 'fulfilled' ? (orcs.value.count ?? 0) : 0,
            followupsAtrasados: followups.status === 'fulfilled' ? (followups.value.count ?? 0) : 0,
            receitaPipeline: dealsArr.reduce((s, d) => s + Number(d.valor || 0), 0),
          }
        })
      } catch { updateSection('comercial', 'error') }
    })()

    // ── Operação ──
    ;(async () => {
      try {
        const [projetos, ops, ncs, oms] = await Promise.allSettled([
          supabaseAdmin.from('projetos').select('id', { count: 'exact', head: true }).in('status', ['em_andamento', 'aprovado']),
          supabaseAdmin.from('ordens_producao').select('id', { count: 'exact', head: true }).eq('status', 'em_producao'),
          supabaseAdmin.from('nao_conformidades').select('id', { count: 'exact', head: true }).in('status', ['aberta', 'em_analise']),
          supabaseAdmin.from('ordens_manutencao').select('id', { count: 'exact', head: true }).in('status', ['aberta', 'em_execucao']),
        ])
        updateSection('operacao', 'ok', {
          operacao: {
            projetosAtivos: projetos.status === 'fulfilled' ? (projetos.value.count ?? 0) : 0,
            opsEmAndamento: ops.status === 'fulfilled' ? (ops.value.count ?? 0) : 0,
            ncsAbertas: ncs.status === 'fulfilled' ? (ncs.value.count ?? 0) : 0,
            manutencoesPendentes: oms.status === 'fulfilled' ? (oms.value.count ?? 0) : 0,
          }
        })
      } catch { updateSection('operacao', 'error') }
    })()

    // ── Financeiro ──
    ;(async () => {
      try {
        const [lancMes, vencidos] = await Promise.allSettled([
          supabaseAdmin.from('fin_lancamentos').select('tipo, valor').gte('data_vencimento', inicioMes),
          supabaseAdmin.from('fin_lancamentos').select('valor').eq('status', 'pendente').lt('data_vencimento', agora.toISOString()),
        ])
        const lancs = lancMes.status === 'fulfilled' ? (lancMes.value.data ?? []) : []
        const vencArr = vencidos.status === 'fulfilled' ? (vencidos.value.data ?? []) : []
        const receitas = lancs.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0)
        const despesas = lancs.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0)
        updateSection('financeiro', 'ok', {
          financeiro: {
            receitaMes: receitas,
            despesaMes: despesas,
            saldo: receitas - despesas,
            vencidos: vencArr.reduce((s, l) => s + Number(l.valor), 0),
          }
        })
      } catch { updateSection('financeiro', 'error') }
    })()

    // ── Estoque ──
    ;(async () => {
      try {
        const { data: itens } = await supabaseAdmin.from('estoque_itens').select('saldo_atual, estoque_minimo, custo_medio').eq('ativo', true)
        const arr = itens ?? []
        updateSection('estoque', 'ok', {
          estoque: {
            alertasMinimo: arr.filter(e => e.estoque_minimo > 0 && e.saldo_atual < e.estoque_minimo).length,
            valorTotal: arr.reduce((s, e) => s + (e.saldo_atual * Number(e.custo_medio || 0)), 0),
          }
        })
      } catch { updateSection('estoque', 'error') }
    })()

    // ── Marketing ──
    ;(async () => {
      try {
        const { count } = await supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes)
        updateSection('marketing', 'ok', { marketing: { leadsMes: count ?? 0 } })
      } catch { updateSection('marketing', 'error') }
    })()

    setLoading(false)
  }, [cnpj, updateSection])

  useEffect(() => { fetchData(true) }, [fetchData])

  return { ...data, loading, refetch: () => fetchData(true) }
}
