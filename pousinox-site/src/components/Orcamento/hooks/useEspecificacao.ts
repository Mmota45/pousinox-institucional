import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../../../lib/supabase'
import { calcularEspecificacao, REGRAS_PADRAO, CONSUMIVEIS_PADRAO } from '../../../lib/calcularEspecificacao'
import type {
  FixadorModelo,
  RegraCalculo,
  Consumivel,
  EspecificacaoInput,
  ResultadoEspecificacao,
  EspecificacaoSalva,
  ItemCalculado,
} from '../especificacaoTypes'
import type { Item } from '../types'

interface UseEspecificacaoOpts {
  orcamentoId: number | null
  onItensAdded?: (novosItens: Item[]) => void
}

export function useEspecificacao({ orcamentoId, onItensAdded }: UseEspecificacaoOpts) {
  const [modelos, setModelos] = useState<FixadorModelo[]>([])
  const [regras, setRegras] = useState<RegraCalculo[]>(REGRAS_PADRAO)
  const [consumiveis, setConsumiveis] = useState<Consumivel[]>(CONSUMIVEIS_PADRAO)
  const [especsSalvas, setEspecsSalvas] = useState<EspecificacaoSalva[]>([])
  const [resultado, setResultado] = useState<ResultadoEspecificacao | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Compat: single especSalva (última editada ou null)
  const especSalva = especsSalvas.length > 0 ? especsSalvas[especsSalvas.length - 1] : null

  // Carregar dados de referência
  useEffect(() => {
    async function load() {
      const [mRes, rRes, cRes] = await Promise.all([
        supabaseAdmin.from('fixador_modelos').select('*').eq('ativo', true).order('nome'),
        supabaseAdmin.from('fixador_regras_calculo').select('*').eq('ativo', true).order('prioridade'),
        supabaseAdmin.from('fixador_consumiveis').select('*').eq('ativo', true).order('ordem'),
      ])
      if (mRes.data) setModelos(mRes.data)
      if (rRes.data?.length) setRegras(rRes.data)
      if (cRes.data?.length) {
        // Deduplicar por tipo base (ex: "Bucha prego 6x38" e "Bucha" → manter só o primeiro)
        const seen = new Set<string>()
        setConsumiveis(cRes.data.filter(c => {
          const base = c.nome.toLowerCase().split(/[\s(]/)[0] // primeira palavra: "bucha", "adesivo", "disco", "broca", "fixador", "parafuso"
          if (seen.has(c.nome)) return false
          if (seen.has(base) && c.tipo === 'consumivel') return false
          seen.add(c.nome)
          seen.add(base)
          return true
        }))
      }
    }
    load()
  }, [])

  // Carregar todas as especificações do orçamento
  useEffect(() => {
    if (!orcamentoId) return
    async function loadEspecs() {
      const { data } = await supabaseAdmin
        .from('orcamento_especificacoes')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('criado_em', { ascending: true })
      if (data && data.length > 0) {
        // Carregar itens de todas as especificações
        const ids = data.map(d => d.id)
        const { data: todosItens } = await supabaseAdmin
          .from('orcamento_especificacao_itens')
          .select('especificacao_id, nome, quantidade, unidade, tipo')
          .in('especificacao_id', ids)
          .order('criado_em')
        const especsCompletas = data.map(d => ({
          ...d,
          itens: (todosItens || []).filter(it => it.especificacao_id === d.id),
        }))
        setEspecsSalvas(especsCompletas)
      }
    }
    loadEspecs()
  }, [orcamentoId])

  const calcular = useCallback((input: EspecificacaoInput) => {
    setErro(null)
    if (input.area_total_m2 <= 0) { setErro('Área deve ser maior que zero.'); return null }
    if (input.largura_cm <= 0 || input.altura_cm <= 0) { setErro('Dimensões devem ser maiores que zero.'); return null }

    const res = calcularEspecificacao(input, regras, consumiveis)
    setResultado(res)
    return res
  }, [regras, consumiveis])

  const salvar = useCallback(async (input: EspecificacaoInput, res: ResultadoEspecificacao, editId?: number) => {
    if (!orcamentoId) { setErro('Salve o orçamento antes.'); return null }
    setLoading(true)
    setErro(null)

    try {
      const payload = {
        orcamento_id: orcamentoId,
        modelo_id: input.modelo_id || null,
        area_total_m2: input.area_total_m2,
        largura_cm: input.largura_cm,
        altura_cm: input.altura_cm,
        peso_peca_kg: input.peso_peca_kg || null,
        peso_m2_kg: input.peso_m2_kg || null,
        espessura_mm: input.espessura_mm || null,
        perda_pct: input.perda_pct,
        qtd_pecas: res.qtd_pecas,
        fixadores_por_peca: res.fixadores_por_peca,
        total_fixadores: res.total_fixadores,
        revisao_tecnica: res.revisao_tecnica,
        revisao_motivos: res.revisao_motivos,
        obs: input.obs || null,
      }

      let especId: number
      if (editId) {
        const { error } = await supabaseAdmin
          .from('orcamento_especificacoes')
          .update(payload)
          .eq('id', editId)
        if (error) throw error
        especId = editId
        await supabaseAdmin.from('orcamento_especificacao_itens').delete().eq('especificacao_id', especId)
      } else {
        const { data, error } = await supabaseAdmin
          .from('orcamento_especificacoes')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        especId = data.id
      }

      // Inserir itens
      const itensPayload = res.itens.map(it => ({
        especificacao_id: especId,
        nome: it.nome,
        quantidade: it.quantidade,
        unidade: it.unidade,
        tipo: it.tipo,
      }))
      await supabaseAdmin.from('orcamento_especificacao_itens').insert(itensPayload)

      const novaEspec = { ...payload, id: especId, criado_em: new Date().toISOString(), itens: res.itens } as EspecificacaoSalva
      setEspecsSalvas(prev => {
        const idx = prev.findIndex(e => e.id === especId)
        if (idx >= 0) return prev.map((e, i) => i === idx ? novaEspec : e)
        return [...prev, novaEspec]
      })
      return especId
    } catch (err) {
      setErro((err as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [orcamentoId])

  const adicionarAoOrcamento = useCallback((res: ResultadoEspecificacao, modelo?: FixadorModelo) => {
    const novosItens: Item[] = res.itens.map(it => ({
      produto_id: null,
      descricao: modelo
        ? `${it.nome} — ${modelo.nome} (${modelo.material} ${modelo.espessura_mm || ''}mm)`
        : it.nome,
      qtd: String(it.quantidade),
      unidade: it.unidade,
      valorUnit: '',
      obs_tecnica: it.tipo === 'fixador' && res.revisao_tecnica
        ? `Revisão técnica: ${res.revisao_motivos.join('; ')}`
        : undefined,
    }))

    onItensAdded?.(novosItens)
    return novosItens
  }, [onItensAdded])

  const removerEspec = useCallback(async (especId: number) => {
    setLoading(true)
    try {
      await supabaseAdmin.from('orcamento_especificacao_itens').delete().eq('especificacao_id', especId)
      await supabaseAdmin.from('orcamento_especificacoes').delete().eq('id', especId)
      setEspecsSalvas(prev => prev.filter(e => e.id !== especId))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    modelos,
    regras,
    consumiveis,
    resultado,
    especSalva,
    especsSalvas,
    loading,
    erro,
    calcular,
    salvar,
    removerEspec,
    adicionarAoOrcamento,
    setResultado,
    setErro,
  }
}
