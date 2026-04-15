import { useState, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminProspeccao.module.css'
import MapaProspects, { type CidadeMapa } from './MapaProspects'
import HistoricoModal from '../components/HistoricoModal/HistoricoModal'

// ── Badge de status com popup ─────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: '',                  label: '— Sem status',        bg: '#f1f5f9', color: '#64748b' },
  { value: 'Interessado',       label: '🟢 Interessado',       bg: '#dcfce7', color: '#15803d' },
  { value: 'Aguardando',        label: '🟡 Aguardando',        bg: '#fef9c3', color: '#92400e' },
  { value: 'Retornar',          label: '🔵 Retornar',          bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'Orçamento enviado', label: '📄 Orçamento enviado', bg: '#fce7f3', color: '#9d174d' },
  { value: 'Venda fechada',     label: '🏆 Venda fechada',     bg: '#ede9fe', color: '#6d28d9' },
  { value: 'Sem interesse',     label: '⚪ Sem interesse',     bg: '#f1f5f9', color: '#94a3b8' },
]

function StatusBadge({
  prospect,
  onSalvar,
}: {
  prospect: Prospect
  onSalvar: (status: string | null, valorVenda?: number | null) => void
}) {
  const [open, setOpen]   = useState(false)
  const [valor, setValor] = useState<string>(prospect.valor_venda?.toString() ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const atual = STATUS_OPTS.find(o => o.value === (prospect.status_contato ?? '')) ?? STATUS_OPTS[0]

  const [pendaVenda, setPendaVenda] = useState(false)

  function escolher(value: string) {
    if (value === 'Venda fechada') {
      setPendaVenda(true)
    } else {
      onSalvar(value || null)
      setOpen(false)
      setPendaVenda(false)
    }
  }

  function confirmarVenda() {
    onSalvar('Venda fechada', parseFloat(valor) || null)
    setOpen(false)
    setPendaVenda(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); setPendaVenda(false) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontSize: '0.72rem', fontWeight: 700,
          background: atual.bg, color: atual.color,
          whiteSpace: 'nowrap',
        }}
        title="Alterar status"
      >
        {atual.label} ▾
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 150,
          background: '#fff', border: '1px solid var(--color-border)',
          borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 200, padding: '6px 0',
        }}>
          {!pendaVenda ? (
            STATUS_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => escolher(opt.value)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 14px', border: 'none',
                  fontSize: '0.82rem', cursor: 'pointer', color: '#1e293b',
                  fontWeight: opt.value === (prospect.status_contato ?? '') ? 700 : 400,
                  background: opt.value === (prospect.status_contato ?? '') ? '#f8fafc' : 'transparent',
                }}
              >
                {opt.label}
              </button>
            ))
          ) : (
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6d28d9', marginBottom: 6 }}>🏆 Valor da venda</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder="R$ 0,00"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarVenda()}
                  autoFocus
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.83rem' }}
                />
                <button onClick={confirmarVenda} style={{ padding: '5px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>✓</button>
                <button onClick={() => setPendaVenda(false)} style={{ padding: '5px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface Prospect {
  id: number
  cnpj: string
  razao_social: string | null
  nome_fantasia: string | null
  porte: string | null
  segmento: string | null
  produto: string | null
  uf: string | null
  cidade: string | null
  bairro: string | null
  endereco: string | null
  telefone1: string | null
  telefone2: string | null
  email: string | null
  contatado: boolean
  distancia_km: number | null
  status_contato: string | null
  observacao: string | null
  score: number | null
  valor_venda: number | null
  cliente_ativo: boolean
}

interface MultiDropdownProps {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  minWidth?: number
}

function MultiDropdown({ label, options, value, onChange, placeholder = 'Todos', disabled, loading, minWidth = 160 }: MultiDropdownProps) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
  }, [open])

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt])
  }

  function norm(s: string) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  }
  const filtrados = busca.trim()
    ? options.filter(o => norm(o).includes(norm(busca)))
    : options

  const btnLabel = loading
    ? 'Carregando...'
    : disabled
    ? placeholder
    : value.length === 0
    ? placeholder
    : value.length === 1
    ? value[0]
    : `${value.length} selecionados`

  return (
    <div className={styles.filtroGrupo} ref={ref} style={{ position: 'relative' }}>
      <span className={styles.filtroLabel}>{label}</span>
      <button
        className={styles.filtroSelect}
        style={{ textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', minWidth, opacity: disabled ? 0.5 : 1 }}
        onClick={() => !disabled && !loading && setOpen(o => !o)}
        type="button"
      >
        <span style={{ flex: 1 }}>{btnLabel}</span>
        <span style={{ float: 'right', opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div className={styles.segDropdown}>
          {options.length >= 8 && (
            <div className={styles.segSearch}>
              <input
                ref={searchRef}
                type="text"
                placeholder="Filtrar..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onClick={e => e.stopPropagation()}
                className={styles.segSearchInput}
              />
            </div>
          )}
          <label className={styles.segItem}>
            <input type="checkbox" checked={value.length === 0} onChange={() => { onChange([]); setBusca('') }} />
            <span>Todos</span>
          </label>
          {filtrados.map(opt => (
            <label key={opt} className={styles.segItem}>
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
          {filtrados.length === 0 && (
            <div style={{ padding: '8px 14px', fontSize: '0.82rem', color: '#94a3b8' }}>Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SEGMENTOS = [
  'Restaurantes', 'Panificação', 'Supermercados', 'Açougues', 'Peixarias',
  'Hospitalar', 'Laboratórios', 'Veterinária', 'Hotelaria',
  'Construtoras', 'Revestimentos', 'Arquitetura',
]

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const PRODUTOS = ['Equipamentos Inox', 'Fixador Porcelanato']

const PORTES = ['Micro Empresa', 'Pequeno Porte', 'Médio/Grande']

const REGIOES: Record<string, string[]> = {
  'Sul':           ['PR', 'RS', 'SC'],
  'Sudeste':       ['ES', 'MG', 'RJ', 'SP'],
  'Centro-Oeste':  ['DF', 'GO', 'MS', 'MT'],
  'Nordeste':      ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Norte':         ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
}

const POR_PAGINA = 50

function formatarWA(tel: string) {
  return tel.replace(/\D/g, '')
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AdminProspeccao() {
  const [busca, setBusca]           = useState('')
  const [produtos, setProdutos]     = useState<string[]>([])
  const [segmentos, setSegmentos]   = useState<string[]>([])
  const [ufs, setUfs]               = useState<string[]>([])
  const [mesorregioes, setMesorregioes]     = useState<string[]>([])
  const [mesorregioesSel, setMesorregioesSel] = useState<string[]>([])
  const [loadingMeso, setLoadingMeso]       = useState(false)
  const [cidades, setCidades]       = useState<string[]>([])
  const [cidadesSel, setCidadesSel] = useState<string[]>([])
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [portes, setPortes]           = useState<string[]>([])
  const [contatoFiltro, setContatoFiltro] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [tipoFiltro, setTipoFiltro]       = useState<'todos' | 'clientes' | 'novos'>('todos')
  const [temTelefone, setTemTelefone]       = useState(false)
  const [raioKm, setRaioKm]               = useState<string>('')
  const [cidadesRaio, setCidadesRaio]     = useState<string[]>([])
  const [loadingCidadesRaio, setLoadingCidadesRaio] = useState(false)
  const [ordenar, setOrdenar]             = useState<'score' | 'nome'>('score')

  const [prospects, setProspects]   = useState<Prospect[]>([])
  const [total, setTotal]           = useState(0)
  const [totalInox, setTotalInox]         = useState(0)
  const [totalInoxCont, setTotalInoxCont] = useState(0)
  const [totalFixador, setTotalFixador]   = useState(0)
  const [totalFixCont, setTotalFixCont]   = useState(0)
  const [pagina, setPagina]         = useState(0)
  const [loading, setLoading]       = useState(false)
  const [buscado, setBuscado]       = useState(false)
  const [erroQuery, setErroQuery]   = useState<string | null>(null)
  const [vistaAtiva, setVistaAtiva]     = useState<'lista' | 'mapa' | 'calor'>('lista')
  const [dadosMapa, setDadosMapa]       = useState<CidadeMapa[]>([])
  const [loadingMapa, setLoadingMapa]   = useState(false)
  const [historicoProspect, setHistoricoProspect] = useState<{ id: number; nome: string } | null>(null)
  const [emailToast, setEmailToast] = useState<string | null>(null)
  const [prospectDetalhe, setProspectDetalhe] = useState<Prospect | null>(null)
  const [dealToast, setDealToast] = useState<string | null>(null)
  const [clienteNFs, setClienteNFs] = useState<{ numero: string; emissao: string | null; total: number | null }[]>([])
  const [loadingNFs, setLoadingNFs] = useState(false)
  const [nfExpandida, setNfExpandida] = useState<string | null>(null)
  const [nfItensCache, setNfItensCache] = useState<Record<string, { descricao: string | null; quantidade: number | null; valor_unitario: number | null; valor_total: number | null }[]>>({})
  const [clientesCidade, setClientesCidade] = useState<{ cidade: string; uf: string; count: number; lat: number | null; lng: number | null }[]>([])

  // Carregar mesorregiões quando UFs mudam
  useEffect(() => {
    if (ufs.length === 0) { setMesorregioes([]); setMesorregioesSel([]); setCidades([]); setCidadesSel([]); return }
    setLoadingMeso(true)
    setMesorregioesSel([])
    setCidades([])
    setCidadesSel([])
    supabaseAdmin
      .rpc('get_mesorregioes_ufs', { p_ufs: ufs })
      .then(({ data }) => {
        const lista = (data ?? []).map((r: { mesorregiao: string }) => r.mesorregiao).filter(Boolean) as string[]
        setMesorregioes(lista)
        setLoadingMeso(false)
      })
  }, [ufs])

  // Carregar cidades somente após mesorregião selecionada (evita timeout em UFs grandes)
  useEffect(() => {
    if (ufs.length === 0 || mesorregioesSel.length === 0) {
      setCidades([])
      setCidadesSel([])
      return
    }
    let cancelled = false
    setLoadingCidades(true)
    setCidadesSel([])
    supabaseAdmin
      .rpc('get_cidades_meso', { p_ufs: ufs, p_meso: mesorregioesSel })
      .then(({ data }) => {
        if (cancelled) return
        const lista = (data ?? []).map((r: { cidade: string }) => r.cidade).filter(Boolean) as string[]
        setCidades(lista)
        setLoadingCidades(false)
      })
    return () => { cancelled = true }
  }, [ufs, mesorregioesSel])

  // Carrega cidades dentro do raio quando raioKm muda
  useEffect(() => {
    const raio = parseFloat(raioKm)
    if (isNaN(raio) || raio <= 0) { setCidadesRaio([]); setCidadesSel([]); return }
    setLoadingCidadesRaio(true)
    setCidadesSel([])
    supabaseAdmin
      .rpc('get_cidades_raio', { p_raio: raio })
      .then(({ data }) => {
        const lista = (data ?? []).map((r: { cidade: string; uf: string; distancia_km: number }) =>
          `${r.cidade} · ${r.uf} · ${Math.round(r.distancia_km)} km`
        )
        setCidadesRaio(lista)
        setLoadingCidadesRaio(false)
      })
  }, [raioKm])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function aplicarFiltrosBase(q: any) {
    if (busca.trim()) {
      const termo = busca.trim()
      const cnpjLimpo = termo.replace(/\D/g, '')
      if (cnpjLimpo.length >= 4) {
        q = q.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,cnpj.ilike.%${cnpjLimpo}%`)
      } else {
        q = q.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
      }
    }
    if (segmentos.length > 0)        q = q.in('segmento', segmentos)
    if (ufs.length > 0)              q = q.in('uf', ufs)
    // Só filtra mesorregião se não estão TODAS selecionadas (seleção total = sem filtro, evita excluir NULLs)
    if (mesorregioesSel.length > 0 && mesorregioesSel.length < mesorregioes.length)
      q = q.in('mesorregiao', mesorregioesSel)
    if (cidadesSel.length > 0) {
      // Quando raio ativo, cidadesSel tem formato "Cidade · UF · Xkm" — extrai só o nome
      const nomesCidades = cidadesSel.map(s => s.includes(' · ') ? s.split(' · ')[0] : s)
      q = q.in('cidade', nomesCidades)
    }
    if (portes.length > 0)           q = q.in('porte', portes)
    if (temTelefone)                  q = q.not('telefone1', 'is', null)
    if (contatoFiltro === 'sim')      q = q.eq('contatado', true)
    if (contatoFiltro === 'nao')      q = q.eq('contatado', false)
    if (tipoFiltro === 'clientes')    q = q.eq('cliente_ativo', true)
    if (tipoFiltro === 'novos')       q = q.eq('cliente_ativo', false)
    const raio = parseFloat(raioKm)
    if (!isNaN(raio) && raio > 0)    q = q.lte('distancia_km', raio)
    return q
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function aplicarFiltros(q: any) {
    q = aplicarFiltrosBase(q)
    if (produtos.length > 0) q = q.in('produto', produtos)
    return q
  }

  async function buscar(pag = 0) {
    setLoading(true)
    setBuscado(true)
    setErroQuery(null)
    setDadosMapa([])

    const base = () => supabaseAdmin.from('prospeccao')

    const qPag = aplicarFiltros(base().select('*', { count: 'exact' }))
      .order(ordenar === 'score' ? 'score' : 'razao_social', { ascending: ordenar !== 'score' })
      .order('razao_social', { ascending: true })
      .range(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA - 1)

    const qInox     = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Equipamentos Inox')
    const qInoxCont = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Equipamentos Inox').eq('contatado', true)
    const qFix      = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Fixador Porcelanato')
    const qFixCont  = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Fixador Porcelanato').eq('contatado', true)

    // Clientes consolidados por cidade (prospeccao.cliente_ativo = true, mesmos filtros geográficos/segmento)
    let qCli = base().select('cidade,uf').eq('cliente_ativo', true)
    const termoBusca = busca.trim()
    if (termoBusca) {
      const cnpjLimpo = termoBusca.replace(/\D/g, '')
      if (cnpjLimpo.length >= 4) {
        qCli = qCli.or(`razao_social.ilike.%${termoBusca}%,nome_fantasia.ilike.%${termoBusca}%,cnpj.ilike.%${cnpjLimpo}%`)
      } else {
        qCli = qCli.or(`razao_social.ilike.%${termoBusca}%,nome_fantasia.ilike.%${termoBusca}%`)
      }
    }
    if (segmentos.length > 0) qCli = qCli.in('segmento', segmentos)
    if (ufs.length > 0) qCli = qCli.in('uf', ufs)
    if (mesorregioesSel.length > 0 && mesorregioesSel.length < mesorregioes.length) qCli = qCli.in('mesorregiao', mesorregioesSel)
    if (cidadesSel.length > 0) {
      const raio = parseFloat(raioKm)
      const nomeCidades = (!isNaN(raio) && raio > 0)
        ? cidadesSel.map(c => c.split(' · ')[0])
        : cidadesSel
      qCli = qCli.in('cidade', nomeCidades)
    }
    if (produtos.length > 0) qCli = qCli.in('produto', produtos)
    qCli = qCli.limit(500)

    const [res, resInox, resInoxCont, resFix, resFixCont, resCliCidade] = await Promise.all([qPag, qInox, qInoxCont, qFix, qFixCont, qCli])

    if (res.error) {
      setErroQuery('Consulta demorou demais. Refine os filtros (adicione cidade, segmento ou produto).')
      setProspects([])
      setTotal(0)
    } else {
      setProspects(res.data ?? [])
      setTotal(res.count ?? 0)
      setTotalInox(resInox.count ?? 0)
      setTotalInoxCont(resInoxCont.count ?? 0)
      setTotalFixador(resFix.count ?? 0)
      setTotalFixCont(resFixCont.count ?? 0)
      setPagina(pag)

      // Agrupar clientes por cidade (lat/lng null por enquanto — preenchido ao abrir o mapa)
      if (resCliCidade.error) {
        console.error('[qCli] erro:', resCliCidade.error)
      }
      const grouped = new Map<string, { cidade: string; uf: string; count: number; lat: number | null; lng: number | null }>()
      for (const r of (resCliCidade.data ?? []) as { cidade: string | null; uf: string | null }[]) {
        if (!r.cidade) continue
        const key = `${r.cidade}|${r.uf}`
        if (!grouped.has(key)) grouped.set(key, { cidade: r.cidade, uf: r.uf ?? '', count: 0, lat: null, lng: null })
        grouped.get(key)!.count++
      }
      const clientesPorCidade = [...grouped.values()].sort((a, b) => b.count - a.count)
      console.log('[qCli] registros retornados:', resCliCidade.data?.length ?? 0, '| cidades únicas:', clientesPorCidade.length)
      setClientesCidade(clientesPorCidade)
    }
    setLoading(false)
  }

  async function buscarMapa() {
    setLoadingMapa(true)
    const raio = parseFloat(raioKm)
    const params = {
      p_segmentos:    segmentos.length > 0 ? segmentos : null,
      p_ufs:          ufs.length > 0 ? ufs : null,
      p_meso:         (mesorregioesSel.length > 0 && mesorregioesSel.length < mesorregioes.length) ? mesorregioesSel : null,
      p_cidades:      cidadesSel.length > 0 ? cidadesSel : null,
      p_produto:      produtos.length > 0 ? produtos : null,
      p_raio:         !isNaN(raio) && raio > 0 ? raio : null,
      p_tem_telefone: temTelefone,
      p_contatado:    contatoFiltro,
    }

    // 1. Agregação por cidade (sem JOIN — rápido)
    const { data: cidadesData, error } = await supabaseAdmin.rpc('get_mapa_cidades', params)
    if (error) { console.error('get_mapa_cidades error:', JSON.stringify(error)); setLoadingMapa(false); return }
    const cidades = (cidadesData ?? []) as { cidade: string; uf: string; total: number; distancia_km: number }[]
    if (cidades.length === 0) { setDadosMapa([]); setLoadingMapa(false); return }

    // 2. Busca coordenadas para UFs do mapa + UFs dos clientes consolidados (ibge_municipios é pequeno)
    const ufsEnvolvidas = [...new Set([
      ...cidades.map(c => c.uf),
      ...clientesCidade.map(c => c.uf),
    ])]
    const { data: ibge } = await supabaseAdmin
      .from('ibge_municipios')
      .select('nome_norm, uf, lat, lng')
      .in('uf', ufsEnvolvidas)
    const coordIdx = new Map((ibge ?? []).map((r: { nome_norm: string; uf: string; lat: number; lng: number }) => [`${r.uf}|${r.nome_norm}`, { lat: r.lat, lng: r.lng }]))

    // 3. Mescla coordenadas
    const mapa: CidadeMapa[] = cidades
      .map(c => {
        const coord = coordIdx.get(`${c.uf}|${c.cidade}`)
        return coord?.lat != null && coord?.lng != null ? { ...c, lat: coord.lat, lng: coord.lng } : null
      })
      .filter(Boolean) as CidadeMapa[]
    setDadosMapa(mapa)

    // Preencher lat/lng dos clientes consolidados usando ibge (cobre cidades fora do filtro atual)
    setClientesCidade(prev => prev.map(c => {
      if (c.lat != null && c.lng != null) return c
      const coord = coordIdx.get(`${c.uf}|${c.cidade}`)
      return coord?.lat != null ? { ...c, lat: coord.lat, lng: coord.lng } : c
    }))
    setLoadingMapa(false)
  }

  async function toggleContatado(p: Prospect) {
    const novoValor = !p.contatado
    await supabaseAdmin
      .from('prospeccao')
      .update({ contatado: novoValor, contato_em: novoValor ? new Date().toISOString() : null })
      .eq('id', p.id)
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, contatado: novoValor } : x))
  }

  async function salvarStatus(p: Prospect, status: string | null, valorVenda?: number | null) {
    const updates: Record<string, unknown> = {
      status_contato: status,
      contatado: status ? true : p.contatado,
      contato_em: status && !p.contatado ? new Date().toISOString() : undefined,
    }
    if (valorVenda !== undefined) updates.valor_venda = valorVenda
    await supabaseAdmin.from('prospeccao').update(updates).eq('id', p.id)
    setProspects(prev => prev.map(x => x.id === p.id
      ? { ...x, status_contato: status, contatado: status ? true : x.contatado, ...(valorVenda !== undefined ? { valor_venda: valorVenda } : {}) }
      : x
    ))
  }


  function exportarCSV() {
    const header = 'CNPJ;Razão Social;Nome Fantasia;Porte;Segmento;Produto;UF;Cidade;Bairro;Endereço;Telefone 1;Telefone 2;E-mail;Contatado'
    const linhas = prospects.map(p => [
      p.cnpj, p.razao_social, p.nome_fantasia, p.porte,
      p.segmento, p.produto, p.uf, p.cidade, p.bairro, p.endereco,
      p.telefone1, p.telefone2, p.email, p.contatado ? 'Sim' : 'Não',
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(';'))
    const blob = new Blob([header + '\n' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects_pousinox_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function mensagemWA(p: Prospect) {
    return encodeURIComponent(
      `Olá! Sou da Pousinox, fabricante de equipamentos em aço inox de Pouso Alegre/MG.\n\n` +
      `Trabalhamos com soluções para ${p.segmento?.toLowerCase() || 'o seu segmento'} e gostaríamos de apresentar nossos produtos.\n\n` +
      `Podemos conversar?`
    )
  }

  function abrirEmail(p: Prospect) {
    if (!p.email) return
    navigator.clipboard.writeText(p.email).catch(() => {})
    window.open('https://webmail86.redehost.com.br/interface/root#/popout/email/compose/', '_blank', 'noopener,noreferrer')
    setEmailToast(p.email)
    setTimeout(() => setEmailToast(null), 4000)
  }

  useEffect(() => {
    if (!prospectDetalhe?.cliente_ativo) { setClienteNFs([]); return }
    const cnpj = prospectDetalhe.cnpj.replace(/\D/g, '')
    setLoadingNFs(true)
    supabaseAdmin.from('nf_cabecalho')
      .select('numero, emissao, total')
      .eq('cnpj', cnpj)
      .order('emissao', { ascending: false })
      .limit(20)
      .then(({ data }) => { setClienteNFs((data ?? []) as { numero: string; emissao: string | null; total: number | null }[]); setLoadingNFs(false) })
  }, [prospectDetalhe])

  async function expandirNF(numero: string) {
    if (nfExpandida === numero) { setNfExpandida(null); return }
    setNfExpandida(numero)
    if (nfItensCache[numero]) return
    const { data } = await supabaseAdmin.from('nf_itens')
      .select('descricao, quantidade, valor_unitario, valor_total')
      .eq('numero', numero)
      .order('descricao')
    setNfItensCache(c => ({ ...c, [numero]: (data ?? []) as { descricao: string | null; quantidade: number | null; valor_unitario: number | null; valor_total: number | null }[] }))
  }

  async function criarDealDireto(p: Prospect) {
    const titulo = p.razao_social || p.nome_fantasia || p.cnpj
    const { error } = await supabaseAdmin.from('pipeline_deals').insert({
      titulo,
      estagio:    'entrada',
      prospect_id: p.id,
    })
    if (error) { alert('Erro ao criar deal: ' + error.message); return }
    setDealToast(titulo)
    setTimeout(() => setDealToast(null), 5000)
    setProspectDetalhe(null)
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className={styles.wrap}>

      {/* ── Toast e-mail ── */}
      {emailToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', borderRadius: 10,
          padding: '12px 20px', zIndex: 9999, fontSize: '0.88rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
          </svg>
          <span>E-mail copiado: <strong>{emailToast}</strong> — cole no campo <strong>Para:</strong></span>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className={styles.filtros}>

        {/* Busca livre */}
        <div className={styles.filtroGrupo} style={{ flex: 1, minWidth: 200 }}>
          <span className={styles.filtroLabel}>Empresa</span>
          <input
            className={styles.filtroInput}
            style={{ minWidth: 200 }}
            type="text"
            placeholder="Nome ou razão social..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar(0)}
          />
        </div>

        <MultiDropdown
          label="Produto"
          options={PRODUTOS}
          value={produtos}
          onChange={setProdutos}
        />

        <MultiDropdown
          label="Segmento"
          options={SEGMENTOS}
          value={segmentos}
          onChange={setSegmentos}
          minWidth={180}
        />

        {parseFloat(raioKm) > 0 ? (
          <MultiDropdown
            label={`Cidades no raio (${raioKm} km)`}
            options={cidadesRaio}
            value={cidadesSel}
            onChange={setCidadesSel}
            placeholder="Todas no raio"
            loading={loadingCidadesRaio}
            minWidth={220}
          />
        ) : (
          <>
            <MultiDropdown
              label="UF"
              options={UFS}
              value={ufs}
              onChange={setUfs}
              minWidth={80}
            />

            {ufs.length > 0 && (
              <MultiDropdown
                label="Mesorregião"
                options={mesorregioes}
                value={mesorregioesSel}
                onChange={setMesorregioesSel}
                placeholder="Todas"
                loading={loadingMeso}
                minWidth={200}
              />
            )}

            <MultiDropdown
              label="Cidade"
              options={cidades}
              value={cidadesSel}
              onChange={setCidadesSel}
              placeholder={ufs.length === 0 ? 'Selecione uma UF' : mesorregioesSel.length === 0 ? 'Selecione mesorregião' : 'Todas'}
              disabled={ufs.length === 0 || mesorregioesSel.length === 0}
              loading={loadingCidades}
              minWidth={180}
            />
          </>
        )}

        <MultiDropdown
          label="Porte"
          options={PORTES}
          value={portes}
          onChange={setPortes}
        />

        {/* Região */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Região</span>
          <select
            className={styles.filtroSelect}
            style={{ minWidth: 130 }}
            value=""
            onChange={e => {
              const regiao = e.target.value
              if (regiao && REGIOES[regiao]) setUfs(REGIOES[regiao])
            }}
          >
            <option value="">Selecionar região...</option>
            {Object.keys(REGIOES).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Contato */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Contato</span>
          <select
            className={styles.filtroSelect}
            value={contatoFiltro}
            onChange={e => setContatoFiltro(e.target.value as 'todos' | 'sim' | 'nao')}
          >
            <option value="todos">Todos</option>
            <option value="sim">Contatados</option>
            <option value="nao">Não contatados</option>
          </select>
        </div>

        {/* Tipo: cliente ou novo prospect */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Tipo</span>
          <select
            className={styles.filtroSelect}
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value as 'todos' | 'clientes' | 'novos')}
          >
            <option value="todos">Todos</option>
            <option value="clientes">Já clientes</option>
            <option value="novos">Novos prospects</option>
          </select>
        </div>

        {/* Tem telefone */}
        <div className={styles.filtroGrupo} style={{ justifyContent: 'flex-end' }}>
          <span className={styles.filtroLabel}>Telefone</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem', paddingBottom: 2 }}>
            <input
              type="checkbox"
              checked={temTelefone}
              onChange={e => setTemTelefone(e.target.checked)}
              style={{ accentColor: 'var(--color-primary)', width: 15, height: 15, cursor: 'pointer' }}
            />
            Só com telefone
          </label>
        </div>

        {/* Raio */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Raio de Pouso Alegre</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              className={styles.filtroInput}
              style={{ minWidth: 80, maxWidth: 100 }}
              type="number"
              min="0"
              step="50"
              placeholder="km"
              value={raioKm}
              onChange={e => setRaioKm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar(0)}
            />
            {raioKm && (
              <button
                type="button"
                onClick={() => setRaioKm('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', lineHeight: 1 }}
                title="Limpar raio"
              >×</button>
            )}
          </div>
        </div>

        {/* Ordenação */}
        <div className={styles.filtroGrupo}>
          <span className={styles.filtroLabel}>Ordenar por</span>
          <select
            className={styles.filtroSelect}
            style={{ minWidth: 130 }}
            value={ordenar}
            onChange={e => setOrdenar(e.target.value as 'score' | 'nome')}
          >
            <option value="score">⭐ Score (melhor primeiro)</option>
            <option value="nome">A–Z Nome</option>
          </select>
        </div>

        <button className={styles.buscarBtn} onClick={() => buscar(0)} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>

        <span className={styles.infoBase}>
          ✓ Base CNPJ ativa (mar/2026)
        </span>
      </div>

      {/* ── Aviso de filtro insuficiente ── */}
      {ufs.length > 0 && mesorregioesSel.length === 0 && cidadesSel.length === 0 && segmentos.length === 0 && produtos.length === 0 && (
        <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px' }}>
          ⚠ Com apenas UF selecionada, adicione também mesorregião, cidade, segmento ou produto para evitar timeout.
        </div>
      )}

      {/* ── Stats ── */}
      {buscado && !loading && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total encontrado</span>
            <span className={styles.statVal}>{total.toLocaleString('pt-BR')}</span>
          </div>
          {parseFloat(raioKm) > 0 && dadosMapa.length > 0 && (
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Cidades no raio</span>
              <span className={styles.statVal}>{dadosMapa.length.toLocaleString('pt-BR')}</span>
              <span className={styles.statSub} style={{ color: '#3b82f6' }}>dentro de {raioKm} km</span>
            </div>
          )}
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Equipamentos Inox</span>
            <span className={styles.statVal}>{totalInox.toLocaleString('pt-BR')}</span>
            <span className={styles.statSub}>✓ {totalInoxCont.toLocaleString('pt-BR')} contatados</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Fixador Porcelanato</span>
            <span className={styles.statVal}>{totalFixador.toLocaleString('pt-BR')}</span>
            <span className={styles.statSub}>✓ {totalFixCont.toLocaleString('pt-BR')} contatados</span>
          </div>
          <div className={styles.statCard} style={{ borderColor: clientesCidade.length > 0 ? '#bfdbfe' : undefined }}>
            <span className={styles.statLabel}>Clientes consolidados</span>
            <span className={styles.statVal} style={{ color: clientesCidade.length > 0 ? '#1d4ed8' : undefined }}>
              {clientesCidade.reduce((s, c) => s + c.count, 0).toLocaleString('pt-BR')}
            </span>
            <span className={styles.statSub}>
              {clientesCidade.length > 0
                ? `em ${clientesCidade.length} ${clientesCidade.length === 1 ? 'cidade' : 'cidades'}`
                : 'nenhum na região'}
            </span>
          </div>
        </div>
      )}

      {/* ── Clientes consolidados por cidade ── */}
      {buscado && !loading && clientesCidade.length > 0 && (
        <div className={styles.clientesCidadeWrap}>
          <div className={styles.clientesCidadeTitulo}>🏢 Clientes consolidados nessa região</div>
          <div className={styles.clientesCidadeCards}>
            {clientesCidade.map(c => (
              <div key={`${c.cidade}|${c.uf}`} className={styles.clientesCidadeCard}>
                <span className={styles.clientesCidadeNome}>{c.cidade}</span>
                <span className={styles.clientesCidadeUf}>{c.uf}</span>
                <span className={styles.clientesCidadeCount}>{c.count} {c.count === 1 ? 'cliente' : 'clientes'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabela / Mapa ── */}
      {buscado && (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>
              {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} prospects`}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                <button
                  className={styles.exportBtn}
                  style={{ border: 'none', borderRadius: 0, background: vistaAtiva === 'lista' ? '#e2e8f0' : '#f1f5f9' }}
                  onClick={() => setVistaAtiva('lista')}
                >☰ Lista</button>
                <button
                  className={styles.exportBtn}
                  style={{ border: 'none', borderRadius: 0, borderLeft: '1px solid var(--color-border)', background: vistaAtiva === 'mapa' ? '#e2e8f0' : '#f1f5f9' }}
                  onClick={() => { setVistaAtiva('mapa'); if (buscado && dadosMapa.length === 0) buscarMapa() }}
                >⬡ Mapa</button>
                <button
                  className={styles.exportBtn}
                  style={{ border: 'none', borderRadius: 0, borderLeft: '1px solid var(--color-border)', background: vistaAtiva === 'calor' ? '#e2e8f0' : '#f1f5f9' }}
                  onClick={() => { setVistaAtiva('calor'); if (buscado && dadosMapa.length === 0) buscarMapa() }}
                >🔥 Calor</button>
              </div>
              {vistaAtiva === 'lista' && prospects.length > 0 && (
                <button className={styles.exportBtn} onClick={exportarCSV}>↓ Exportar CSV</button>
              )}
            </div>
          </div>

          {vistaAtiva === 'mapa' ? (
            <div style={{ padding: 16 }}>
              <MapaProspects modo="volume" dados={dadosMapa} loading={loadingMapa} raioKm={parseFloat(raioKm) || null} clientesConsolidados={clientesCidade} />
            </div>
          ) : vistaAtiva === 'calor' ? (
            <div style={{ padding: 16 }}>
              <MapaProspects modo="calor" dados={dadosMapa} loading={loadingMapa} raioKm={parseFloat(raioKm) || null} clientesConsolidados={clientesCidade} />
            </div>
          ) : loading ? (
            <div className={styles.loading}>Buscando prospects...</div>
          ) : erroQuery ? (
            <div className={styles.vazio} style={{ color: '#dc2626' }}>⚠ {erroQuery}</div>
          ) : prospects.length === 0 ? (
            <div className={styles.vazio}>Nenhum prospect encontrado com os filtros selecionados.</div>
          ) : (
            <>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Produto</th>
                      <th>Segmento</th>
                      <th>Cidade/UF</th>
                      <th>Contato</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.map(p => {
                      const tel = p.telefone1 || p.telefone2
                      const waNum = tel ? formatarWA(tel) : null
                      const waLink = waNum ? `https://wa.me/55${waNum}?text=${mensagemWA(p)}` : null

                      return (
                        <tr key={p.id} style={{ opacity: p.contatado ? 0.5 : 1 }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div className={styles.nome} style={{ flex: 1 }}>{p.razao_social || '—'}</div>
                              {p.cliente_ativo && (
                                <span title="Já é cliente — CNPJ encontrado nas NFs importadas" style={{
                                  fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
                                  borderRadius: 20, flexShrink: 0,
                                  background: '#dbeafe', color: '#1d4ed8',
                                  letterSpacing: '0.03em',
                                }}>
                                  cliente
                                </span>
                              )}
                              {p.score != null && (
                                <span title={`Score: ${p.score}/11`} style={{
                                  fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px',
                                  borderRadius: 20, flexShrink: 0,
                                  background: p.score >= 9 ? '#dcfce7' : p.score >= 6 ? '#fef9c3' : '#f1f5f9',
                                  color: p.score >= 9 ? '#15803d' : p.score >= 6 ? '#92400e' : '#64748b',
                                }}>
                                  {p.score}/11
                                </span>
                              )}
                            </div>
                            {p.nome_fantasia && p.nome_fantasia !== p.razao_social && (
                              <div className={styles.fantasia}>{p.nome_fantasia}</div>
                            )}
                            <div className={styles.fantasia} style={{ marginTop: 2 }}>
                              {p.porte} · CNPJ {p.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.pill} ${p.produto === 'Equipamentos Inox' ? styles.pillInox : styles.pillFixador}`}>
                              {p.produto === 'Equipamentos Inox' ? 'Inox' : 'Fixador'}
                            </span>
                          </td>
                          <td><span className={styles.pillSegmento}>{p.segmento}</span></td>
                          <td>
                            {p.cidade && <div>{p.cidade}</div>}
                            {p.uf && <div className={styles.fantasia}>{p.uf}{p.distancia_km != null ? ` · ${p.distancia_km} km` : ''}</div>}
                          </td>
                          <td>
                            {p.telefone1 && <div>{p.telefone1}</div>}
                            {p.telefone2 && <div className={styles.fantasia}>{p.telefone2}</div>}
                            {p.email && (
                              <button onClick={() => abrirEmail(p)} className={styles.fantasia} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                                {p.email}
                              </button>
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              prospect={p}
                              onSalvar={(status, valorVenda) => salvarStatus(p, status, valorVenda)}
                            />
                            {p.observacao && (
                              <div style={{ marginTop: 3, fontSize: '0.72rem', color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.observacao}>
                                {p.observacao}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className={styles.acoes}>
                              <div className={styles.acoesBtns}>
                                {waLink ? (
                                  <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.waBtn} title="Abrir WhatsApp">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                                  </a>
                                ) : (
                                  <span className={styles.semTel}>—</span>
                                )}
                                {p.email ? (
                                  <a
                                    href="https://webmail86.redehost.com.br/interface/root#/popout/email/compose/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.emailBtn}
                                    title={`Copiar e-mail e abrir webmail (${p.email})`}
                                    onClick={() => {
                                      navigator.clipboard.writeText(p.email!).catch(() => {})
                                      setEmailToast(p.email!)
                                      setTimeout(() => setEmailToast(null), 4000)
                                    }}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
                                    </svg>
                                  </a>
                                ) : (
                                  <span />
                                )}
                                <button
                                  className={styles.checkBtn}
                                  onClick={() => setProspectDetalhe(p)}
                                  title="Ver detalhes e criar deal no Pipeline"
                                  style={{ color: 'var(--color-primary)' }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                  </svg>
                                </button>
                                <button
                                  className={styles.checkBtn}
                                  onClick={() => setHistoricoProspect({ id: p.id, nome: p.razao_social || p.nome_fantasia || p.cnpj })}
                                  title="Ver histórico de interações"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                  </svg>
                                </button>
                                <button
                                  className={`${styles.checkBtn} ${p.contatado ? styles.checkBtnAtivo : ''}`}
                                  onClick={() => toggleContatado(p)}
                                  title={p.contatado ? 'Desmarcar como contatado' : 'Marcar como contatado'}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className={styles.paginacao}>
                  <span>Página {pagina + 1} de {totalPaginas} · {total.toLocaleString('pt-BR')} resultados</span>
                  <div className={styles.pagBtns}>
                    <button className={styles.pagBtn} disabled={pagina === 0} onClick={() => buscar(pagina - 1)}>← Anterior</button>
                    <button className={styles.pagBtn} disabled={pagina >= totalPaginas - 1} onClick={() => buscar(pagina + 1)}>Próxima →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {dealToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 16px #0001', display: 'flex', alignItems: 'center', gap: 12 }}>
          ✓ Deal criado: {dealToast}
          <a href="/admin/pipeline" style={{ color: '#15803d', textDecoration: 'underline', fontWeight: 700 }}>Ir ao Pipeline →</a>
        </div>
      )}

      {prospectDetalhe && (() => {
        const p = prospectDetalhe
        const cnpjFmt = p.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') ?? p.cnpj
        const fmtTel = (t: string) => t.replace(/\D/g, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
        const waNum = (t: string) => t.replace(/\D/g, '')
        const googleQ = encodeURIComponent(`${p.razao_social ?? ''} ${p.cidade ?? ''} ${p.uf ?? ''} telefone celular site`)
        const cnpjRaw = p.cnpj?.replace(/\D/g, '') ?? ''
        return (
          <>
            <div onClick={() => setProspectDetalhe(null)} style={{ position: 'fixed', inset: 0, background: '#0005', zIndex: 1000 }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: '#fff', zIndex: 1001, overflowY: 'auto', boxShadow: '-4px 0 24px #0002', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3 }}>{p.razao_social || '—'}</div>
                  {p.nome_fantasia && p.nome_fantasia !== p.razao_social && (
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>{p.nome_fantasia}</div>
                  )}
                </div>
                <button onClick={() => setProspectDetalhe(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8', padding: '0 4px' }}>✕</button>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong>CNPJ:</strong> {cnpjFmt}</div>
                <div><strong>Porte:</strong> {p.porte || '—'}</div>
                <div><strong>Segmento:</strong> {p.segmento || '—'}</div>
                <div><strong>Cidade:</strong> {p.cidade}{p.uf ? ` / ${p.uf}` : ''}</div>
                {p.score != null && <div><strong>Score:</strong> {p.score}/11</div>}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contato</div>
                {[p.telefone1, p.telefone2].filter(Boolean).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{fmtTel(t!)}</span>
                    <a href={`tel:+55${waNum(t!)}`} style={{ fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none', background: '#eff6ff', borderRadius: 6, padding: '2px 8px' }}>Ligar</a>
                    <a href={`https://wa.me/55${waNum(t!)}?text=Olá, estou entrando em contato sobre fixadores de porcelanato Pousinox.`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#15803d', textDecoration: 'none', background: '#dcfce7', borderRadius: 6, padding: '2px 8px' }}>WhatsApp</a>
                  </div>
                ))}
                {(!p.telefone1 && !p.telefone2) && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Sem telefone cadastrado</div>}
                {p.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.82rem', color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</span>
                    <button onClick={() => { navigator.clipboard.writeText(p.email!).catch(() => {}); setEmailToast(p.email!); setTimeout(() => setEmailToast(null), 3000) }}
                      style={{ fontSize: '0.75rem', color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Copiar</button>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pesquisar na internet</div>
                <a href={`https://www.google.com/search?q=${googleQ}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                  🔍 Google — telefone, celular, site
                </a>
                {cnpjRaw.length === 14 && (
                  <a href={`https://www.cnpj.biz/${cnpjRaw}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                    🏢 CNPJ.biz — dados Receita Federal
                  </a>
                )}
              </div>

              {p.cliente_ativo && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    ✓ Cliente — Histórico de compras
                  </div>
                  {loadingNFs && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Carregando…</div>}
                  {!loadingNFs && clienteNFs.length === 0 && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Nenhuma NF encontrada.</div>}
                  {!loadingNFs && clienteNFs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 300, overflowY: 'auto' }}>
                      {clienteNFs.map(nf => (
                        <div key={nf.numero}>
                          <div
                            onClick={() => expandirNF(nf.numero)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '5px 4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', borderRadius: 4, background: nfExpandida === nf.numero ? '#f0fdf4' : 'transparent' }}
                          >
                            <span style={{ fontWeight: 600 }}>{nfExpandida === nf.numero ? '▾' : '▸'} NF {nf.numero}</span>
                            <span style={{ color: '#64748b' }}>{nf.emissao ? new Date(nf.emissao).toLocaleDateString('pt-BR') : '—'}</span>
                            <span style={{ fontWeight: 600, color: '#15803d' }}>
                              {nf.total != null ? nf.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                            </span>
                          </div>
                          {nfExpandida === nf.numero && (
                            <div style={{ background: '#f8fafc', borderRadius: 4, padding: '6px 8px', marginBottom: 4 }}>
                              {!nfItensCache[nf.numero] && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Carregando…</div>}
                              {nfItensCache[nf.numero]?.length === 0 && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Sem itens.</div>}
                              {nfItensCache[nf.numero]?.map((it, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '2px 0', borderBottom: '1px solid #e2e8f0' }}>
                                  <span style={{ flex: 1, color: '#1e293b' }}>{it.descricao || '—'}</span>
                                  <span style={{ color: '#64748b', marginLeft: 8, whiteSpace: 'nowrap' }}>{it.quantidade}× {it.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 'auto' }}>
                <button onClick={() => criarDealDireto(p)}
                  style={{ width: '100%', padding: '12px', background: 'var(--color-primary, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                  ➡ Criar deal no Pipeline
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {historicoProspect && (
        <HistoricoModal
          prospectId={historicoProspect.id}
          prospectNome={historicoProspect.nome}
          onClose={() => setHistoricoProspect(null)}
          onInteracaoSalva={() => buscar(pagina)}
        />
      )}
    </div>
  )
}
