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
  const [especSalva, setEspecSalva] = useState<EspecificacaoSalva | null>(null)
  const [resultado, setResultado] = useState<ResultadoEspecificacao | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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
      if (cRes.data?.length) setConsumiveis(cRes.data)
    }
    load()
  }, [])

  // Carregar especificação existente do orçamento
  useEffect(() => {
    if (!orcamentoId) return
    async function loadEspec() {
      const { data } = await supabaseAdmin
        .from('orcamento_especificacoes')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        setEspecSalva(data)
        // Carregar itens
        const { data: itens } = await supabaseAdmin
          .from('orcamento_especificacao_itens')
          .select('nome, quantidade, unidade, tipo')
          .eq('especificacao_id', data.id)
          .order('criado_em')
        if (itens) setEspecSalva(prev => prev ? { ...prev, itens } : prev)
      }
    }
    loadEspec()
  }, [orcamentoId])

  const calcular = useCallback((input: EspecificacaoInput) => {
    setErro(null)
    if (input.area_total_m2 <= 0) { setErro('Área deve ser maior que zero.'); return null }
    if (input.largura_cm <= 0 || input.altura_cm <= 0) { setErro('Dimensões devem ser maiores que zero.'); return null }

    const res = calcularEspecificacao(input, regras, consumiveis)
    setResultado(res)
    return res
  }, [regras, consumiveis])

  const salvar = useCallback(async (input: EspecificacaoInput, res: ResultadoEspecificacao) => {
    if (!orcamentoId) { setErro('Salve o orçamento antes.'); return null }
    setLoading(true)
    setErro(null)

    try {
      // Upsert especificação
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
      if (especSalva?.id) {
        const { error } = await supabaseAdmin
          .from('orcamento_especificacoes')
          .update(payload)
          .eq('id', especSalva.id)
        if (error) throw error
        especId = especSalva.id
        // Limpar itens antigos
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

      setEspecSalva({ ...payload, id: especId, criado_em: new Date().toISOString(), itens: res.itens } as EspecificacaoSalva)
      return especId
    } catch (err) {
      setErro((err as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [orcamentoId, especSalva])

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
        ? `⚠️ Revisão técnica: ${res.revisao_motivos.join('; ')}`
        : undefined,
    }))

    onItensAdded?.(novosItens)
    return novosItens
  }, [onItensAdded])

  return {
    modelos,
    regras,
    consumiveis,
    resultado,
    especSalva,
    loading,
    erro,
    calcular,
    salvar,
    adicionarAoOrcamento,
    setResultado,
    setErro,
  }
}
