import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminProspeccao.module.css'
import MapaProspects, { type CidadeMapa } from './MapaProspects'
import HistoricoModal from '../components/HistoricoModal/HistoricoModal'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'
import AgentProspector from '../components/assistente/AgentProspector'

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
  nome_contato: string | null
  cep: string | null
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
  portal?: boolean
}

function MultiDropdown({ label, options, value, onChange, placeholder = 'Todos', disabled, loading, minWidth = 160, portal = false }: MultiDropdownProps) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
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
    if (open && portal && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [open, portal])

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

  const dropdown = open && (
    <div
      className={styles.segDropdown}
      style={portal && dropPos ? {
        position: 'fixed',
        top: dropPos.top,
        left: dropPos.left,
        width: dropPos.width,
        zIndex: 9999,
      } : undefined}
    >
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
  )

  return (
    <div className={styles.filtroGrupo} ref={ref} style={{ position: 'relative' }}>
      <span className={styles.filtroLabel}>{label}</span>
      <button
        ref={btnRef}
        className={styles.filtroSelect}
        style={{ textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', minWidth, opacity: disabled ? 0.5 : 1 }}
        onClick={() => !disabled && !loading && setOpen(o => !o)}
        type="button"
      >
        <span style={{ flex: 1 }}>{btnLabel}</span>
        <span style={{ float: 'right', opacity: 0.5 }}>▾</span>
      </button>
      {portal && dropPos ? createPortal(dropdown, document.body) : dropdown}
    </div>
  )
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SEGMENTOS = [
  'Restaurantes', 'Panificação / Confeitaria', 'Supermercados', 'Açougues', 'Peixarias',
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
  const [scoreMin, setScoreMin]           = useState<string>('')

  const [prospects, setProspects]   = useState<Prospect[]>([])
  const [total, setTotal]           = useState(0)
  const [totalInox, setTotalInox]         = useState(0)
  const [totalInoxCont, setTotalInoxCont] = useState(0)
  const [totalFixador, setTotalFixador]   = useState(0)
  const [totalFixCont, setTotalFixCont]   = useState(0)
  const [pagina, setPagina]         = useState(0)
  const [agentProspector, setAgentProspector] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [buscado, setBuscado]       = useState(false)
  const [erroQuery, setErroQuery]   = useState<string | null>(null)
  const [vistaAtiva, setVistaAtiva]     = useState<'lista' | 'mapa' | 'calor' | 'cobertura' | 'funil'>('lista')

  // ── Cobertura e Funil ──
  type Cobertura = { mesorregiao: string; uf: string; total: number; contatados: number; interessados: number; aguardando: number; cobertura_pct: number; score_medio: number; clientes: number }
  type Funil = { mercado: number; contatados: number; interessados: number; orcamentos: number; vendas: number; receita: number; ticket_medio: number }
  const [coberturaData, setCoberturaData] = useState<Cobertura[]>([])
  const [coberturaLoading, setCoberturaLoading] = useState(false)
  const [coberturaOrdem, setCoberturaOrdem] = useState<'total' | 'cobertura_pct' | 'score_medio' | 'clientes' | 'virgem'>('total')
  const [coberturaAsc, setCoberturaAsc] = useState(false)
  const [funilData, setFunilData] = useState<Funil | null>(null)
  const [funilLoading, setFunilLoading] = useState(false)
  const [dadosMapa, setDadosMapa]       = useState<CidadeMapa[]>([])
  const [loadingMapa, setLoadingMapa]   = useState(false)
  const [historicoProspect, setHistoricoProspect] = useState<{ id: number; nome: string } | null>(null)
  const [emailToast, setEmailToast] = useState<string | null>(null)
  const [prospectDetalhe, setProspectDetalhe] = useState<Prospect | null>(null)
  const [dealToast, setDealToast] = useState<string | null>(null)
  const [drawerAba, setDrawerAba] = useState<'geral' | 'enderecos' | 'contatos' | 'historico'>('geral')
  const [contatosExtra, setContatosExtra] = useState<{ id: number; nome: string | null; cargo: string | null; telefone: string | null; email: string | null }[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)
  const [novoContato, setNovoContato] = useState<{ nome: string; cargo: string; telefone: string; email: string } | null>(null)
  const [enderecosExtra, setEnderecosExtra] = useState<{ id: number; tipo: string; logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; observacao: string | null }[]>([])
  const [loadingEnderecos, setLoadingEnderecos] = useState(false)
  const [novoEndereco, setNovoEndereco] = useState<{ tipo: string; logradouro: string; bairro: string; cidade: string; uf: string; cep: string; observacao: string } | null>(null)
  const [clienteNFs, setClienteNFs] = useState<{ numero: string; emissao: string | null; total: number | null }[]>([])
  const [loadingNFs, setLoadingNFs] = useState(false)
  const [nfExpandida, setNfExpandida] = useState<string | null>(null)
  const [nfItensCache, setNfItensCache] = useState<Record<string, { descricao: string | null; quantidade: number | null; valor_unitario: number | null; valor_total: number | null }[]>>({})
  const [clientesCidade, setClientesCidade] = useState<{ cidade: string; uf: string; count: number; lat: number | null; lng: number | null }[]>([])

  // ── Cadastro / enriquecimento via BrasilAPI ───────────────────────────────
  const [modalCadastro, setModalCadastro] = useState(false)
  const [cnpjInput,     setCnpjInput]     = useState('')
  const [buscandoCnpj,  setBuscandoCnpj]  = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dadosCnpjApi,  setDadosCnpjApi]  = useState<any>(null)
  const [erroCnpj,      setErroCnpj]      = useState<string | null>(null)
  const [salvandoCnpj,  setSalvandoCnpj]  = useState(false)
  const [enriquecendo,  setEnriquecendo]  = useState(false)
  const [filtroDrawer,  setFiltroDrawer]  = useState(false)

  // Badge: conta filtros secundários ativos
  const filtrosAtivos = [
    produtos.length > 0,
    segmentos.length > 0,
    ufs.length > 0,
    cidadesSel.length > 0,
    mesorregioesSel.length > 0,
    portes.length > 0,
    contatoFiltro !== 'todos',
    tipoFiltro !== 'todos',
    temTelefone,
    raioKm !== '',
  ].filter(Boolean).length

  // Calcular distância quando drawer abre e distancia_km está ausente
  useEffect(() => {
    const p = prospectDetalhe
    if (!p || p.distancia_km != null || !p.cidade || !p.uf) return
    supabaseAdmin
      .from('ibge_municipios')
      .select('lat, lng')
      .eq('uf', p.uf)
      .ilike('nome', p.cidade)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.lat || !data?.lng) return
        const R = 6371
        const dLat = (data.lat - (-22.2289)) * Math.PI / 180
        const dLng = (data.lng - (-45.9358)) * Math.PI / 180
        const a = Math.sin(dLat/2)**2 + Math.cos((-22.2289)*Math.PI/180) * Math.cos(data.lat*Math.PI/180) * Math.sin(dLng/2)**2
        const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
        supabaseAdmin.from('prospeccao').update({ distancia_km: dist }).eq('id', p.id)
        setProspectDetalhe(prev => prev ? { ...prev, distancia_km: dist } : prev)
        setProspects(prev => prev.map((x: Prospect) => x.id === p.id ? { ...x, distancia_km: dist } : x))
      })
  }, [prospectDetalhe?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Busca só quando o usuário clicar em "Buscar"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function aplicarFiltrosBase(q: any) {
    if (busca.trim()) {
      const termo = busca.trim()
      const cnpjLimpo = termo.replace(/\D/g, '')
      if (cnpjLimpo.length >= 14) {
        // CNPJ completo — busca exata só pelo CNPJ, ignora demais filtros
        return q.eq('cnpj', cnpjLimpo)
      }
      if (cnpjLimpo.length >= 8) {
        // CNPJ parcial — busca pelo número limpo, sem outros filtros geográficos
        q = q.ilike('cnpj', `%${cnpjLimpo}%`)
        return q
      }
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
    const sMin = parseInt(scoreMin)
    if (!isNaN(sMin) && sMin > 0)    q = q.gte('score', sMin)
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
      if (cnpjLimpo.length >= 14) {
        qCli = qCli.eq('cnpj', cnpjLimpo)
      } else if (cnpjLimpo.length >= 8) {
        qCli = qCli.ilike('cnpj', `%${cnpjLimpo}%`)
      } else if (cnpjLimpo.length >= 4) {
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

  async function buscarCobertura() {
    setCoberturaLoading(true)
    const { data } = await supabaseAdmin.rpc('get_cobertura_regional', {
      p_segmentos: segmentos.length > 0 ? segmentos : null,
      p_ufs: ufs.length > 0 ? ufs : null,
      p_raio: parseFloat(raioKm) || null,
    })
    setCoberturaData(data ?? [])
    setCoberturaLoading(false)
  }

  async function buscarFunil() {
    setFunilLoading(true)
    const { data } = await supabaseAdmin.rpc('get_funil_prospects', {
      p_segmentos: segmentos.length > 0 ? segmentos : null,
      p_ufs: ufs.length > 0 ? ufs : null,
      p_raio: parseFloat(raioKm) || null,
    })
    setFunilData(data?.[0] ?? null)
    setFunilLoading(false)
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
      `Olá! Sou da Pousinox®, fabricante de equipamentos em aço inox de Pouso Alegre/MG.\n\n` +
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

  // ── BrasilAPI helpers ────────────────────────────────────────────────────────
  function mapCnaeSegmento(cnae: number): string | null {
    const d2 = Math.floor(cnae / 100000) // 2 primeiros dígitos da divisão
    const d4 = Math.floor(cnae / 1000)   // 4 primeiros dígitos (grupo)
    // Construção civil
    if (d2 >= 41 && d2 <= 43) return 'Construtoras'
    // Arquitetura e engenharia
    if (d4 === 7111 || d4 === 7119) return 'Arquitetura'
    // Revestimentos / materiais de construção
    if (d4 === 4744 || d4 === 4743 || d4 === 4679) return 'Revestimentos'
    // Restaurantes e alimentação
    if (d4 === 5611 || d4 === 5612 || d4 === 5620) return 'Restaurantes'
    // Panificação / Confeitaria
    if (d4 === 1091 || d4 === 4721) return 'Panificação / Confeitaria'
    // Supermercados
    if (d4 === 4711 || d4 === 4712 || d4 === 4713) return 'Supermercados'
    // Açougues
    if (d4 === 4722) return 'Açougues'
    // Peixarias
    if (d4 === 4723) return 'Peixarias'
    // Hospitalar
    if (d2 === 86) return 'Hospitalar'
    // Laboratórios
    if (d4 === 8640 || d4 === 8650) return 'Laboratórios'
    // Veterinária
    if (d2 === 75) return 'Veterinária'
    // Hotelaria
    if (d4 === 5510 || d4 === 5590) return 'Hotelaria'
    return null
  }

  function mapPorte(p: string) {
    if (p === 'ME') return 'Micro Empresa'
    if (p === 'EPP') return 'Pequeno Porte'
    return 'Médio/Grande'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function apiParaRow(d: any) {
    const tel1 = (d.ddd_telefone_1 ?? '').replace(/\D/g, '')
    const tel2 = (d.ddd_telefone_2 ?? '').replace(/\D/g, '')
    const segmento = d.cnae_fiscal ? mapCnaeSegmento(Number(d.cnae_fiscal)) : null
    return {
      cnpj:         (d.cnpj ?? '').replace(/\D/g, ''),
      razao_social: d.razao_social ?? null,
      nome_fantasia: d.nome_fantasia || null,
      uf:           d.uf ?? null,
      cidade:       d.municipio ?? null,
      bairro:       d.bairro || null,
      endereco:     [d.logradouro, d.numero].filter(Boolean).join(', ') || null,
      cep:          (d.cep ?? '').replace(/\D/g, '') || null,
      telefone1:    tel1 || null,
      telefone2:    tel2 || null,
      email:        d.email || null,
      porte:        mapPorte(d.porte ?? ''),
      ...(segmento ? { segmento } : {}),
    }
  }

  async function buscarCnpjApi() {
    const limpo = cnpjInput.replace(/\D/g, '')
    if (limpo.length !== 14) { setErroCnpj('Digite o CNPJ completo (14 dígitos).'); return }
    setBuscandoCnpj(true)
    setErroCnpj(null)
    setDadosCnpjApi(null)
    try {
      const res = await fetch(`${import.meta.env.DEV ? '/api/brasilapi' : 'https://brasilapi.com.br'}/api/cnpj/v1/${limpo}`)
      if (!res.ok) throw new Error('CNPJ não encontrado na Receita Federal.')
      const data = await res.json()
      setDadosCnpjApi(data)
    } catch (e: unknown) {
      setErroCnpj(e instanceof Error ? e.message : 'Erro ao consultar Receita Federal.')
    }
    setBuscandoCnpj(false)
  }

  async function salvarProspectApi() {
    if (!dadosCnpjApi) return
    setSalvandoCnpj(true)
    const row = apiParaRow(dadosCnpjApi)
    const { error } = await supabaseAdmin.from('prospeccao').upsert(row, { onConflict: 'cnpj' })
    if (error) { setErroCnpj(error.message); setSalvandoCnpj(false); return }
    setModalCadastro(false)
    setCnpjInput('')
    setDadosCnpjApi(null)
    setSalvandoCnpj(false)
    buscar(0)
  }

  async function enriquecerProspect(p: Prospect) {
    setEnriquecendo(true)
    try {
      const limpo = p.cnpj.replace(/\D/g, '')

      // Busca prospect completo do banco para garantir todos os campos atuais
      const { data: pCompleto } = await supabaseAdmin.from('prospeccao').select('*').eq('id', p.id).single()
      if (!pCompleto) throw new Error('Prospect não encontrado.')

      const res = await fetch(`${import.meta.env.DEV ? '/api/brasilapi' : 'https://brasilapi.com.br'}/api/cnpj/v1/${limpo}`)
      if (!res.ok) throw new Error('CNPJ não encontrado.')
      const d = await res.json()
      const apiRow = apiParaRow(d)

      // Só preenche campos que estão vazios/nulos no banco — preserva edições manuais
      const mergedRow: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(apiRow)) {
        const atual = (pCompleto as Record<string, unknown>)[key]
        if (atual === null || atual === undefined || atual === '') {
          mergedRow[key] = val
        }
      }
      if (Object.keys(mergedRow).length === 0) {
        alert('Todos os campos já estão preenchidos — nenhum dado novo da Receita Federal.')
        setEnriquecendo(false)
        return
      }
      const { error } = await supabaseAdmin.from('prospeccao').update(mergedRow).eq('id', p.id)
      if (!error) {
        setProspectDetalhe(prev => prev ? { ...prev, ...mergedRow } : prev)
        buscar(pagina)
      } else {
        alert(error.message)
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao consultar Receita Federal.')
    }
    setEnriquecendo(false)
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

      {/* ── Filtros mobile: barra compacta + drawer ── */}
      <div className={styles.filtroBarMobile}>
        <input
          className={styles.filtroInputMobile}
          type="text"
          placeholder="Buscar empresa..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar(0)}
        />
        <button
          className={`${styles.filtroToggleBtn} ${filtrosAtivos > 0 ? styles.filtroToggleBtnAtivo : ''}`}
          onClick={() => setFiltroDrawer(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          Filtros{filtrosAtivos > 0 && <span className={styles.filtroBadge}>{filtrosAtivos}</span>}
        </button>
        <button className={styles.buscarBtnMobile} onClick={() => buscar(0)} disabled={loading}>
          {loading ? '...' : 'Buscar'}
        </button>
        <button style={{ padding: '6px 10px', background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onClick={() => setAgentProspector(true)}>🎯 Prospector IA</button>
        <button
          className={styles.novoProspectBtn}
          onClick={() => { setModalCadastro(true); setCnpjInput(''); setDadosCnpjApi(null); setErroCnpj(null) }}
        >+</button>
      </div>

      {/* Drawer de filtros — mobile */}
      {filtroDrawer && <div className={styles.drawerOverlay} onClick={() => setFiltroDrawer(false)} />}
      <div className={`${styles.filtroDrawer} ${filtroDrawer ? styles.filtroDrawerAberto : ''}`}>
        <div className={styles.drawerHandle} />
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitulo}>Filtros</span>
          <button className={styles.drawerFechar} onClick={() => setFiltroDrawer(false)}>✕</button>
        </div>
        <div className={styles.drawerBody}>

      {/* ── Filtros ── */}
      <div className={styles.filtros}>

        {/* Busca + ações na mesma linha */}
        <div className={styles.filtroPrimario}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.filtroInput}
            type="text"
            placeholder="Buscar por nome, razão social ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar(0)}
          />
          <button
            className={styles.buscarBtnPrimary}
            onClick={() => buscar(0)}
            disabled={loading}
          >
            {loading ? '...' : 'Buscar'}
          </button>
          <button
            className={styles.cadastrarBtn}
            onClick={() => { setModalCadastro(true); setCnpjInput(''); setDadosCnpjApi(null); setErroCnpj(null) }}
          >
            + CNPJ
          </button>
        </div>

        <div className={styles.filtroDivider} />

        {/* Filtros principais — sempre visíveis */}
        <div className={styles.filtroRow}>
          <MultiDropdown
            label="Produto"
            options={PRODUTOS}
            value={produtos}
            onChange={setProdutos}
            portal={filtroDrawer}
          />

          <MultiDropdown
            label="Segmento"
            options={SEGMENTOS}
            value={segmentos}
            onChange={setSegmentos}
            minWidth={150}
            portal={filtroDrawer}
          />

          {parseFloat(raioKm) > 0 ? (
            <MultiDropdown
              label={`Cidades (${raioKm} km)`}
              options={cidadesRaio}
              value={cidadesSel}
              onChange={setCidadesSel}
              placeholder="Todas no raio"
              loading={loadingCidadesRaio}
              minWidth={160}
              portal={filtroDrawer}
            />
          ) : (
            <>
              <MultiDropdown
                label="UF"
                options={UFS}
                value={ufs}
                onChange={setUfs}
                minWidth={70}
                portal={filtroDrawer}
              />

              {ufs.length > 0 && (
                <MultiDropdown
                  label="Mesorregião"
                  options={mesorregioes}
                  value={mesorregioesSel}
                  onChange={setMesorregioesSel}
                  placeholder="Todas"
                  loading={loadingMeso}
                  minWidth={150}
                  portal={filtroDrawer}
                />
              )}

              <MultiDropdown
                label="Cidade"
                options={cidades}
                value={cidadesSel}
                onChange={setCidadesSel}
                placeholder={ufs.length === 0 ? 'Selecione UF' : mesorregioesSel.length === 0 ? 'Selecione meso' : 'Todas'}
                disabled={ufs.length === 0 || mesorregioesSel.length === 0}
                loading={loadingCidades}
                minWidth={140}
                portal={filtroDrawer}
              />
            </>
          )}

          <MultiDropdown
            label="Porte"
            options={PORTES}
            value={portes}
            onChange={setPortes}
            portal={filtroDrawer}
          />

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Ordenar</span>
            <select
              className={styles.filtroSelect}
              value={ordenar}
              onChange={e => setOrdenar(e.target.value as 'score' | 'nome')}
            >
              <option value="score">Score</option>
              <option value="nome">A–Z</option>
            </select>
          </div>

          <div className={styles.filtroSep} />

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Região</span>
            <select
              className={styles.filtroSelect}
              value=""
              onChange={e => {
                const regiao = e.target.value
                if (regiao && REGIOES[regiao]) setUfs(REGIOES[regiao])
              }}
            >
              <option value="">Sel...</option>
              {Object.keys(REGIOES).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Contato</span>
            <select
              className={styles.filtroSelect}
              value={contatoFiltro}
              onChange={e => setContatoFiltro(e.target.value as 'todos' | 'sim' | 'nao')}
            >
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Tipo</span>
            <select
              className={styles.filtroSelect}
              value={tipoFiltro}
              onChange={e => setTipoFiltro(e.target.value as 'todos' | 'clientes' | 'novos')}
            >
              <option value="todos">Todos</option>
              <option value="clientes">Cli.</option>
              <option value="novos">Novos</option>
            </select>
          </div>

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Tel.</span>
            <select
              className={styles.filtroSelect}
              value={temTelefone ? 'sim' : 'todos'}
              onChange={e => setTemTelefone(e.target.value === 'sim')}
            >
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
            </select>
          </div>

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Raio</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input
                className={styles.filtroInput}
                style={{ width: 50 }}
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1 }}
                >×</button>
              )}
            </div>
          </div>

          <div className={styles.filtroGrupo}>
            <span className={styles.filtroLabel}>Score</span>
            <select
              className={styles.filtroSelect}
              value={scoreMin}
              onChange={e => setScoreMin(e.target.value)}
            >
              <option value="">—</option>
              <option value="8">8+</option>
              <option value="6">6+</option>
              <option value="4">4+</option>
            </select>
          </div>
        </div>

      </div>

        </div>{/* drawerBody */}
        <div className={styles.drawerFooter}>
          <button className={styles.drawerAplicar} onClick={() => { buscar(0); setFiltroDrawer(false) }}>
            Aplicar filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
          </button>
        </div>
      </div>{/* filtroDrawer */}

      {/* ── Aviso de filtro insuficiente ── */}
      {ufs.length > 0 && mesorregioesSel.length === 0 && cidadesSel.length === 0 && segmentos.length === 0 && produtos.length === 0 && (
        <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px' }}>
          ⚠ Com apenas UF selecionada, adicione também mesorregião, cidade, segmento ou produto para evitar timeout.
        </div>
      )}

      {/* ── Stats ── */}
      {buscado && !loading && (() => {
        const totalClientes = clientesCidade.reduce((s, c) => s + c.count, 0)
        const totalContatados = totalInoxCont + totalFixCont
        const pctInox = total > 0 ? (totalInox / total) * 100 : 0
        const pctContatado = total > 0 ? (totalContatados / total) * 100 : 0
        const penetracao = total > 0 ? (totalClientes / total) * 100 : 0
        const scoresMedio = prospects.length > 0
          ? prospects.reduce((s, p) => s + (p.score ?? 0), 0) / prospects.length
          : 0
        const cidadesSemContato = dadosMapa.length > 0
          ? dadosMapa.filter(d => {
              const cli = clientesCidade.find(c => c.cidade === d.cidade && c.uf === d.uf)
              return !cli
            }).length
          : 0

        return (
          <>
            <div className={styles.stats}>
              {/* Total */}
              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: '#f1f5f9', color: '#475569' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </div>
                <div className={styles.statBody}>
                  <span className={styles.statLabel}>Total</span>
                  <span className={styles.statVal}>{total.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Composição Inox vs Fixador */}
              <div className={`${styles.statCard} ${styles.statCardWide}`}>
                <div className={styles.statBody} style={{ width: '100%' }}>
                  <span className={styles.statLabel}>Composição por produto</span>
                  <div style={{ display: 'flex', gap: 14, marginTop: 1 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      <span style={{ color: '#3b82f6' }}>Inox</span>{' '}
                      <span style={{ color: '#1e293b' }}>{totalInox.toLocaleString('pt-BR')}</span>
                      <span style={{ color: '#b0b8c4', fontWeight: 400 }}> · {totalInoxCont} cont.</span>
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      <span style={{ color: '#f59e0b' }}>Fixador</span>{' '}
                      <span style={{ color: '#1e293b' }}>{totalFixador.toLocaleString('pt-BR')}</span>
                      <span style={{ color: '#b0b8c4', fontWeight: 400 }}> · {totalFixCont} cont.</span>
                    </span>
                  </div>
                  <div className={styles.barWrap}>
                    <div className={styles.barFill} style={{ width: `${pctInox}%`, background: '#3b82f6' }} />
                    <div className={styles.barFill} style={{ width: `${100 - pctInox}%`, background: '#f59e0b' }} />
                  </div>
                </div>
              </div>

              {/* Taxa de contato */}
              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: '#dcfce7', color: '#15803d' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                </div>
                <div className={styles.statBody}>
                  <span className={styles.statLabel}>Contato</span>
                  <span className={styles.statVal}>{pctContatado.toFixed(1)}%</span>
                  <span className={styles.statSub}>{totalContatados.toLocaleString('pt-BR')} contatados</span>
                </div>
              </div>

              {/* Score médio */}
              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{
                  background: scoresMedio >= 7 ? '#dcfce7' : scoresMedio >= 4 ? '#fef9c3' : '#f1f5f9',
                  color: scoresMedio >= 7 ? '#15803d' : scoresMedio >= 4 ? '#92400e' : '#64748b',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z"/></svg>
                </div>
                <div className={styles.statBody}>
                  <span className={styles.statLabel}>Score</span>
                  <span className={styles.statVal}>{scoresMedio.toFixed(1)}</span>
                  <span className={styles.statSub}>média da página</span>
                </div>
              </div>

              {/* Clientes consolidados */}
              <div className={styles.statCard} style={{ borderLeft: '2px solid #3b82f6' }}>
                <div className={styles.statIcon} style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
                <div className={styles.statBody}>
                  <span className={styles.statLabel}>Clientes</span>
                  <span className={styles.statVal} style={{ color: '#1d4ed8' }}>
                    {totalClientes.toLocaleString('pt-BR')}
                  </span>
                  <span className={styles.statSub}>
                    {clientesCidade.length > 0
                      ? `${clientesCidade.length} cid. · ${penetracao.toFixed(1)}%`
                      : 'nenhum na região'}
                  </span>
                </div>
              </div>

              {/* Cidades no raio */}
              {parseFloat(raioKm) > 0 && dadosMapa.length > 0 && (
                <div className={styles.statCard}>
                  <div className={styles.statIcon} style={{ background: '#ede9fe', color: '#7c3aed' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div className={styles.statBody}>
                    <span className={styles.statLabel}>No raio</span>
                    <span className={styles.statVal}>{dadosMapa.length}</span>
                    <span className={styles.statSub} style={{ color: cidadesSemContato > 0 ? '#7c3aed' : '#16a34a' }}>
                      {cidadesSemContato > 0 ? `${cidadesSemContato} sem cliente` : 'cobertas'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Clientes consolidados por cidade ── */}
            {clientesCidade.length > 0 && (() => {
              const sorted = [...clientesCidade].sort((a, b) => b.count - a.count)
              const top5 = sorted.slice(0, 5)
              const rest = sorted.slice(5)
              const maxCount = sorted[0]?.count ?? 1

              function badgeColor(count: number) {
                const ratio = count / maxCount
                if (ratio >= 0.6) return { bg: '#1d4ed8', color: '#fff' }
                if (ratio >= 0.3) return { bg: '#3b82f6', color: '#fff' }
                return { bg: '#dbeafe', color: '#1d4ed8' }
              }

              return (
                <div className={styles.clientesCidadeWrap}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className={styles.clientesCidadeTitulo}>Clientes consolidados</div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {totalClientes} em {clientesCidade.length} cidades
                    </span>
                  </div>
                  <div className={styles.clientesCidadeCards}>
                    {top5.map(c => {
                      const bc = badgeColor(c.count)
                      return (
                        <div key={`${c.cidade}|${c.uf}`} className={styles.clientesCidadeCard} style={{ borderColor: '#93c5fd' }}>
                          <span className={styles.clientesCidadeNome}>{c.cidade}</span>
                          <span className={styles.clientesCidadeUf}>{c.uf}</span>
                          <span className={styles.clientesCidadeCount} style={{ background: bc.bg, color: bc.color }}>
                            {c.count}
                          </span>
                        </div>
                      )
                    })}
                    {rest.map(c => {
                      const bc = badgeColor(c.count)
                      return (
                        <div key={`${c.cidade}|${c.uf}`} className={styles.clientesCidadeCard}>
                          <span className={styles.clientesCidadeNome}>{c.cidade}</span>
                          <span className={styles.clientesCidadeUf}>{c.uf}</span>
                          <span className={styles.clientesCidadeCount} style={{ background: bc.bg, color: bc.color }}>
                            {c.count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </>
        )
      })()}

      {/* ── Tabela / Mapa ── */}
      {buscado && (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>
              {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} prospects`}
            </span>
            <div className={styles.tableActions}>
              <div className={styles.vistaTabs}>
                <button
                  className={`${styles.vistaTab} ${vistaAtiva === 'lista' ? styles.vistaTabAtiva : ''}`}
                  onClick={() => setVistaAtiva('lista')}
                >☰ Lista</button>
                <button
                  className={`${styles.vistaTab} ${vistaAtiva === 'mapa' ? styles.vistaTabAtiva : ''}`}
                  onClick={() => { setVistaAtiva('mapa'); if (buscado && dadosMapa.length === 0) buscarMapa() }}
                >⬡ Mapa</button>
                <button
                  className={`${styles.vistaTab} ${vistaAtiva === 'calor' ? styles.vistaTabAtiva : ''}`}
                  onClick={() => { setVistaAtiva('calor'); if (buscado && dadosMapa.length === 0) buscarMapa() }}
                >🔥 Calor</button>
                <button
                  className={`${styles.vistaTab} ${vistaAtiva === 'cobertura' ? styles.vistaTabAtiva : ''}`}
                  onClick={() => { setVistaAtiva('cobertura'); if (coberturaData.length === 0) buscarCobertura() }}
                >📊 Cobertura</button>
                <button
                  className={`${styles.vistaTab} ${vistaAtiva === 'funil' ? styles.vistaTabAtiva : ''}`}
                  onClick={() => { setVistaAtiva('funil'); if (!funilData) buscarFunil() }}
                >🔻 Funil</button>
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

          ) : vistaAtiva === 'cobertura' ? (
            <div style={{ padding: 16 }}>
              {coberturaLoading ? (
                <div className={styles.loading}>Calculando cobertura...</div>
              ) : coberturaData.length === 0 ? (
                <div className={styles.vazio}>Nenhum dado de cobertura. Aplique filtros e busque.</div>
              ) : (() => {
                const sorted = [...coberturaData].sort((a, b) => {
                  const col = coberturaOrdem
                  const va = col === 'virgem' ? a.total - a.contatados : a[col]
                  const vb = col === 'virgem' ? b.total - b.contatados : b[col]
                  return coberturaAsc ? va - vb : vb - va
                })
                const totMerc = coberturaData.reduce((s, d) => s + d.total, 0)
                const totCont = coberturaData.reduce((s, d) => s + d.contatados, 0)
                const totInt = coberturaData.reduce((s, d) => s + d.interessados, 0)
                const totCli = coberturaData.reduce((s, d) => s + d.clientes, 0)
                const cobGeral = totMerc > 0 ? (totCont / totMerc) * 100 : 0

                function sortCol(col: typeof coberturaOrdem) {
                  if (coberturaOrdem === col) setCoberturaAsc(!coberturaAsc)
                  else { setCoberturaOrdem(col); setCoberturaAsc(false) }
                }
                const arrow = (col: typeof coberturaOrdem) => coberturaOrdem === col ? (coberturaAsc ? ' ▲' : ' ▼') : ''

                return (
                  <>
                    <div className={styles.stats} style={{ marginBottom: 14 }}>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Mercado</span>
                          <span className={styles.statVal}>{totMerc.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Cobertura</span>
                          <span className={styles.statVal} style={{ color: cobGeral >= 20 ? '#16a34a' : '#d97706' }}>{cobGeral.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Interessados</span>
                          <span className={styles.statVal}>{totInt.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Clientes</span>
                          <span className={styles.statVal} style={{ color: '#1d4ed8' }}>{totCli.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Virgem</span>
                          <span className={styles.statVal}>{(totMerc - totCont).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.tableScroll}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Mesorregião</th>
                            <th>UF</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => sortCol('total')}>Prospects{arrow('total')}</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => sortCol('clientes')}>Clientes{arrow('clientes')}</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => sortCol('score_medio')}>Score{arrow('score_medio')}</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => sortCol('cobertura_pct')}>Cobertura{arrow('cobertura_pct')}</th>
                            <th>Interessados</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => sortCol('virgem')}>Virgem{arrow('virgem')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((d, i) => {
                            const virgem = d.total - d.contatados
                            const barColor = d.cobertura_pct >= 50 ? '#16a34a' : d.cobertura_pct >= 20 ? '#d97706' : '#3b82f6'
                            return (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{d.mesorregiao}</td>
                                <td>{d.uf}</td>
                                <td>{d.total.toLocaleString('pt-BR')}</td>
                                <td>
                                  {d.clientes > 0 && (
                                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600 }}>
                                      {d.clientes}
                                    </span>
                                  )}
                                </td>
                                <td>{d.score_medio?.toFixed(1) ?? '—'}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                                      <div style={{ width: `${Math.min(d.cobertura_pct, 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: barColor, fontWeight: 600, minWidth: 32 }}>{d.cobertura_pct.toFixed(0)}%</span>
                                  </div>
                                </td>
                                <td>
                                  {d.interessados > 0 && (
                                    <span style={{ background: '#fef9c3', color: '#92400e', padding: '1px 7px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600 }}>
                                      {d.interessados}
                                    </span>
                                  )}
                                </td>
                                <td style={{ color: '#64748b' }}>{virgem.toLocaleString('pt-BR')}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              })()}
            </div>

          ) : vistaAtiva === 'funil' ? (
            <div style={{ padding: 16 }}>
              {funilLoading ? (
                <div className={styles.loading}>Calculando funil...</div>
              ) : !funilData ? (
                <div className={styles.vazio}>Nenhum dado de funil. Aplique filtros e busque.</div>
              ) : (() => {
                const f = funilData
                const stages = [
                  { label: '🌐 Mercado', value: f.mercado, color: '#3b82f6' },
                  { label: '📞 Contatados', value: f.contatados, color: '#8b5cf6' },
                  { label: '🟢 Interessados', value: f.interessados, color: '#16a34a' },
                  { label: '📄 Orçamentos', value: f.orcamentos, color: '#d97706' },
                  { label: '🏆 Vendas', value: f.vendas, color: '#dc2626' },
                ]
                const maxVal = Math.max(...stages.map(s => s.value), 1)
                const taxa = (val: number, base: number) => base > 0 ? ((val / base) * 100).toFixed(1) + '%' : '—'
                const convGeral = f.mercado > 0 ? (f.vendas / f.mercado) * 100 : 0

                return (
                  <>
                    <div className={styles.stats} style={{ marginBottom: 14 }}>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Receita fechada</span>
                          <span className={styles.statVal} style={{ color: '#7c3aed' }}>
                            {f.receita > 0 ? `R$ ${f.receita.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Ticket médio</span>
                          <span className={styles.statVal}>
                            {f.ticket_medio > 0 ? `R$ ${f.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Conversão geral</span>
                          <span className={styles.statVal} style={{ color: '#16a34a' }}>{convGeral.toFixed(2)}%</span>
                          <span className={styles.statSub}>mercado → venda</span>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statBody}>
                          <span className={styles.statLabel}>Interessado → Venda</span>
                          <span className={styles.statVal} style={{ color: '#d97706' }}>{taxa(f.vendas, f.interessados)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.funilWrap}>
                      {stages.map((s, i) => (
                        <div key={s.label}>
                          <div className={styles.funilStage}>
                            <span className={styles.funilLabel}>{s.label}</span>
                            <span className={styles.funilCount}>{s.value.toLocaleString('pt-BR')}</span>
                            <div className={styles.funilBar}>
                              <div
                                className={styles.funilBarFill}
                                style={{ width: `${(s.value / maxVal) * 100}%`, background: s.color }}
                              />
                            </div>
                          </div>
                          {i < stages.length - 1 && (
                            <div className={styles.funilArrow}>
                              ↓ {taxa(stages[i + 1].value, s.value)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
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
                      <th style={{ cursor: 'pointer' }} onClick={() => { setOrdenar('nome'); buscar(0) }}>
                        Empresa {ordenar === 'nome' ? '↑' : ''}
                      </th>
                      <th>Produto</th>
                      <th>Segmento</th>
                      <th>Cidade/UF</th>
                      <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => { setOrdenar('score'); buscar(0) }}>
                        Score {ordenar === 'score' ? '↓' : ''}
                      </th>
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
                          <td style={{ textAlign: 'center' }}>
                            {p.score != null ? (
                              <span style={{
                                fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px',
                                borderRadius: 20, display: 'inline-block',
                                background: p.score >= 8 ? '#dcfce7' : p.score >= 5 ? '#fef9c3' : '#f1f5f9',
                                color: p.score >= 8 ? '#15803d' : p.score >= 5 ? '#92400e' : '#64748b',
                              }}>
                                {p.score}
                              </span>
                            ) : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>}
                          </td>
                          <td>
                            {p.telefone1 && <div>{p.telefone1.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}</div>}
                            {p.telefone2 && <div className={styles.fantasia}>{p.telefone2.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}</div>}
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
                                  onClick={() => {
                                    setProspectDetalhe(p)
                                    setDrawerAba('geral')
                                    setNovoContato(null)
                                    setNovoEndereco(null)
                                    setContatosExtra([])
                                    setEnderecosExtra([])
                                    setLoadingContatos(true)
                                    setLoadingEnderecos(true)
                                    supabaseAdmin.from('prospeccao_contatos').select('*').eq('prospect_id', p.id).order('id').then(({ data }) => {
                                      setContatosExtra(data ?? [])
                                      setLoadingContatos(false)
                                    })
                                    supabaseAdmin.from('prospeccao_enderecos').select('*').eq('prospect_id', p.id).order('id').then(({ data }) => {
                                      setEnderecosExtra(data ?? [])
                                      setLoadingEnderecos(false)
                                    })
                                  }}
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

      {/* ── Modal Cadastrar Prospect por CNPJ ── */}
      {modalCadastro && (
        <>
          <div onClick={() => setModalCadastro(false)} style={{ position: 'fixed', inset: 0, background: '#0005', zIndex: 1100 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxWidth: '95vw', background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px #0003', zIndex: 1101, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Cadastrar Prospect por CNPJ</span>
              <button onClick={() => setModalCadastro(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.9rem', fontFamily: 'inherit' }}
                placeholder="Digite o CNPJ (com ou sem formatação)"
                value={cnpjInput}
                onChange={e => setCnpjInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarCnpjApi()}
              />
              <button onClick={buscarCnpjApi} disabled={buscandoCnpj} title="Consultar CNPJ"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0, opacity: buscandoCnpj ? 0.6 : 1 }}>
                {buscandoCnpj
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.7s linear infinite' }}><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
              </button>
            </div>

            {erroCnpj && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>{erroCnpj}</div>}

            {dadosCnpjApi && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{dadosCnpjApi.razao_social}</div>
                {dadosCnpjApi.nome_fantasia && <div style={{ color: '#64748b' }}>{dadosCnpjApi.nome_fantasia}</div>}
                <div><strong>CNPJ:</strong> {dadosCnpjApi.cnpj}</div>
                <div><strong>Situação:</strong> {dadosCnpjApi.situacao_cadastral}</div>
                <div><strong>Porte:</strong> {mapPorte(dadosCnpjApi.porte ?? '')}</div>
                <div><strong>CNAE:</strong> {dadosCnpjApi.cnae_fiscal} — {dadosCnpjApi.cnae_fiscal_descricao}</div>
                <div><strong>Endereço:</strong> {dadosCnpjApi.logradouro}, {dadosCnpjApi.numero} — {dadosCnpjApi.municipio}/{dadosCnpjApi.uf}</div>
                {dadosCnpjApi.ddd_telefone_1 && <div><strong>Telefone:</strong> {dadosCnpjApi.ddd_telefone_1}</div>}
                {dadosCnpjApi.email && <div><strong>E-mail:</strong> {dadosCnpjApi.email}</div>}
              </div>
            )}

            {dadosCnpjApi && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setModalCadastro(false)}
                  style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={salvarProspectApi} disabled={salvandoCnpj}
                  style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
                  {salvandoCnpj ? 'Salvando...' : '✓ Salvar prospect'}
                </button>
              </div>
            )}
          </div>
        </>
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
            <div onClick={() => { setProspectDetalhe(null); setNovoContato(null); setNovoEndereco(null); setContatosExtra([]); setEnderecosExtra([]) }} style={{ position: 'fixed', inset: 0, background: '#0005', zIndex: 1000 }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#fff', zIndex: 1001, overflowY: 'auto', boxShadow: '-4px 0 24px #0002', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3 }}>{p.razao_social || '—'}</div>
                  {p.nome_fantasia && p.nome_fantasia !== p.razao_social && (
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>{p.nome_fantasia}</div>
                  )}
                </div>
                <button onClick={() => { setProspectDetalhe(null); setNovoContato(null); setNovoEndereco(null); setContatosExtra([]); setEnderecosExtra([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8', padding: '0 4px' }}>✕</button>
              </div>

              {/* Linha CNPJ + badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                <span style={{ fontFamily: 'monospace', letterSpacing: '0.02em' }}>{cnpjFmt}</span>
                {p.porte && <span style={{ background: '#f1f5f9', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>{p.porte}</span>}
                {p.score != null && (() => {
                  const scoreTel = p.telefone1 ? 3 : 0
                  const scoreSegmento = { 'Revestimentos': 3, 'Construtoras': 2, 'Arquitetura': 2, 'Hotelaria': 1, 'Hospitalar': 1 }[p.segmento ?? ''] ?? 0
                  const scoreDist = p.distancia_km != null ? (p.distancia_km <= 150 ? 3 : p.distancia_km <= 300 ? 2 : p.distancia_km <= 500 ? 1 : 0) : 0
                  const scoreEmail = p.email ? 1 : 0
                  const criterios = [
                    { label: 'Telefone', pts: scoreTel, max: 3, ok: scoreTel > 0 },
                    { label: 'Segmento', pts: scoreSegmento, max: 3, ok: scoreSegmento > 0 },
                    { label: 'Distância', pts: scoreDist, max: 3, ok: scoreDist > 0, extra: p.distancia_km != null ? `${Math.round(p.distancia_km)} km` : 'sem coord.' },
                    { label: 'E-mail', pts: scoreEmail, max: 1, ok: scoreEmail > 0 },
                  ]
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ background: p.score >= 8 ? '#dcfce7' : p.score >= 5 ? '#fef9c3' : '#fee2e2', color: p.score >= 8 ? '#166534' : p.score >= 5 ? '#854d0e' : '#991b1b', borderRadius: 20, padding: '2px 10px', fontWeight: 600, alignSelf: 'flex-start' }}>⭐ {p.score}/10</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 8px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        {criterios.map(c => (
                          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                            <span style={{ width: 14, textAlign: 'center' }}>{c.ok ? '✅' : '❌'}</span>
                            <span style={{ flex: 1, color: c.ok ? '#1e293b' : '#94a3b8' }}>{c.label}{c.extra ? ` — ${c.extra}` : ''}</span>
                            <span style={{ fontWeight: 600, color: c.ok ? '#15803d' : '#cbd5e1' }}>+{c.pts}/{c.max}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {p.cliente_ativo && <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>✓ Cliente</span>}
              </div>

              {/* ── Abas ── */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: 0 }}>
                {([
                  { id: 'geral', label: 'Geral' },
                  { id: 'enderecos', label: `Endereços${enderecosExtra.length > 0 ? ` (${enderecosExtra.length + 1})` : ''}` },
                  { id: 'contatos', label: `Contatos${contatosExtra.length > 0 ? ` (${contatosExtra.length + 1})` : ''}` },
                  { id: 'historico', label: 'Histórico' },
                ] as const).map(tab => (
                  <button key={tab.id} onClick={() => setDrawerAba(tab.id)}
                    style={{ flex: 1, padding: '8px 4px', fontSize: '0.78rem', fontWeight: drawerAba === tab.id ? 700 : 500, color: drawerAba === tab.id ? 'var(--color-primary)' : '#64748b', background: 'none', border: 'none', borderBottom: drawerAba === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ══ ABA GERAL ══ */}
              {drawerAba === 'geral' && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: '0.67rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Segmento</label>
                    <select value={SEGMENTOS.includes(p.segmento ?? '') ? (p.segmento ?? '') : ''}
                      onChange={async e => {
                        const val = e.target.value || null
                        await supabaseAdmin.from('prospeccao').update({ segmento: val }).eq('id', p.id)
                        setProspectDetalhe(prev => prev ? { ...prev, segmento: val } : prev)
                        setProspects(prev => prev.map(r => r.id === p.id ? { ...r, segmento: val } : r))
                      }}
                      style={{ padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', background: '#f8fafc' }}>
                      <option value="">— Selecione —</option>
                      {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: '0.67rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produto</label>
                    <select value={p.produto ?? ''}
                      onChange={async e => {
                        const val = e.target.value || null
                        await supabaseAdmin.from('prospeccao').update({ produto: val }).eq('id', p.id)
                        setProspectDetalhe(prev => prev ? { ...prev, produto: val } : prev)
                        setProspects(prev => prev.map(r => r.id === p.id ? { ...r, produto: val } : r))
                      }}
                      style={{ padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', background: '#f8fafc' }}>
                      <option value="">— Selecione —</option>
                      {PRODUTOS.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                    </select>
                  </div>
                </div>

                {/* Links rápidos */}
                <div style={{ display: 'grid', gridTemplateColumns: cnpjRaw.length === 14 && (p.endereco || p.cidade) ? '1fr 1fr 1fr' : cnpjRaw.length === 14 ? '1fr 1fr' : '1fr', gap: 6 }}>
                  <a href={`https://www.google.com/search?q=${googleQ}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 500, textAlign: 'center' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔍</span>Google
                  </a>
                  {cnpjRaw.length === 14 && (
                    <a href={`https://www.cnpj.biz/${cnpjRaw}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 500, textAlign: 'center' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏢</span>CNPJ.biz
                    </a>
                  )}
                  {(p.endereco || p.cidade) && (
                    <a href={`https://www.google.com/maps/dir/${encodeURIComponent('Av. Antonio Mariosa, 4545, Santa Angelina, Pouso Alegre, MG, 37550-360')}/${encodeURIComponent([p.endereco, p.bairro, p.cidade, p.uf].filter(Boolean).join(', '))}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 500, textAlign: 'center' }}>
                      <span style={{ fontSize: '1.2rem' }}>📍</span>Maps
                    </a>
                  )}
                </div>

                <button onClick={() => enriquecerProspect(p)} disabled={enriquecendo}
                  style={{ width: '100%', padding: '8px 0', background: enriquecendo ? '#f3f4f6' : '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', cursor: enriquecendo ? 'wait' : 'pointer' }}>
                  {enriquecendo ? 'Consultando...' : '🔄 Enriquecer dados da Receita Federal'}
                </button>
              </>}

              {/* ══ ABA ENDEREÇOS ══ */}
              {drawerAba === 'enderecos' && (() => {
                const fld = (label: string, value: string | null, placeholder: string, onSave: (v: string | null) => Promise<void>, flex = 1, upper = false, maxLen?: number) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex }}>
                    <label style={{ fontSize: '0.67rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                    <input type="text" defaultValue={value ?? ''} placeholder={placeholder} maxLength={maxLen}
                      onBlur={async e => { const v = (upper ? e.target.value.trim().toUpperCase() : e.target.value.trim()) || null; if (v === (value ?? null)) return; await onSave(v) }}
                      style={{ fontSize: '0.83rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b', textTransform: upper ? 'uppercase' : 'none', boxSizing: 'border-box' as const }} />
                  </div>
                )
                const saveProsp = (col: string) => async (val: string | null) => {
                  await supabaseAdmin.from('prospeccao').update({ [col]: val }).eq('id', p.id)
                  setProspectDetalhe(prev => prev ? { ...prev, [col]: val } : prev)
                  setProspects(prev => prev.map(r => r.id === p.id ? { ...r, [col]: val } : r))
                }
                return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Endereço principal (sede) */}
                  <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>🏢 Sede (Receita Federal)</span>
                      {(p.endereco || p.cidade) && (
                        <a href={`https://www.google.com/maps/dir/${encodeURIComponent('Av. Antonio Mariosa, 4545, Santa Angelina, Pouso Alegre, MG, 37550-360')}/${encodeURIComponent([p.endereco, p.bairro, p.cidade, p.uf].filter(Boolean).join(', '))}`}
                          target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none' }}>📍 Rota</a>
                      )}
                    </div>
                    {fld('Logradouro', p.endereco, 'Ex: Av. Principal, 123', saveProsp('endereco'))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {fld('Bairro', p.bairro, 'Ex: Centro', saveProsp('bairro'), 2)}
                      {fld('CEP', p.cep ? p.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : null, '00000-000',
                        async val => { const v = val?.replace(/\D/g, '') || null; await supabaseAdmin.from('prospeccao').update({ cep: v }).eq('id', p.id); setProspectDetalhe(prev => prev ? { ...prev, cep: v } : prev); setProspects(prev => prev.map(r => r.id === p.id ? { ...r, cep: v } : r)) }, 1)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {fld('Cidade', p.cidade, 'Ex: Pouso Alegre', saveProsp('cidade'), 3)}
                      {fld('UF', p.uf, 'MG', saveProsp('uf'), 1, true, 2)}
                    </div>
                  </div>

                  {/* Endereços extras (obras/filiais) */}
                  {loadingEnderecos && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Carregando...</div>}
                  {enderecosExtra.map(e => (
                    <div key={e.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select value={e.tipo} onChange={async ev => {
                          const val = ev.target.value
                          await supabaseAdmin.from('prospeccao_enderecos').update({ tipo: val }).eq('id', e.id)
                          setEnderecosExtra(prev => prev.map(x => x.id === e.id ? { ...x, tipo: val } : x))
                        }} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                          <option value="Obra">🏗 Obra</option>
                          <option value="Filial">🏬 Filial</option>
                          <option value="Sede">🏢 Sede</option>
                          <option value="Outro">📌 Outro</option>
                        </select>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {(e.logradouro || e.cidade) && (
                            <a href={`https://www.google.com/maps/dir/${encodeURIComponent('Av. Antonio Mariosa, 4545, Santa Angelina, Pouso Alegre, MG, 37550-360')}/${encodeURIComponent([e.logradouro, e.bairro, e.cidade, e.uf].filter(Boolean).join(', '))}`}
                              target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none' }}>📍 Rota</a>
                          )}
                          <button onClick={async () => {
                            await supabaseAdmin.from('prospeccao_enderecos').delete().eq('id', e.id)
                            setEnderecosExtra(prev => prev.filter(x => x.id !== e.id))
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1, padding: 0 }}>✕</button>
                        </div>
                      </div>
                      {[
                        { label: 'Logradouro', col: 'logradouro', val: e.logradouro, ph: 'Ex: Rua da Obra, 100', flex: 1 },
                      ].map(f => (
                        <div key={f.col} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: '0.67rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
                          <input type="text" defaultValue={f.val ?? ''} placeholder={f.ph}
                            onBlur={async ev => {
                              const v = ev.target.value.trim() || null
                              await supabaseAdmin.from('prospeccao_enderecos').update({ [f.col]: v }).eq('id', e.id)
                              setEnderecosExtra(prev => prev.map(x => x.id === e.id ? { ...x, [f.col]: v } : x))
                            }}
                            style={{ fontSize: '0.83rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b' }} />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: '0.67rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cidade</label>
                          <input type="text" defaultValue={e.cidade ?? ''} placeholder="Cidade..."
                            onBlur={async ev => { const v = ev.target.value.trim() || null; await supabaseAdmin.from('prospeccao_enderecos').update({ cidade: v }).eq('id', e.id); setEnderecosExtra(prev => prev.map(x => x.id === e.id ? { ...x, cidade: v } : x)) }}
                            style={{ fontSize: '0.83rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: '0.67rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UF</label>
                          <input type="text" defaultValue={e.uf ?? ''} placeholder="UF..." maxLength={2}
                            onBlur={async ev => { const v = ev.target.value.trim().toUpperCase() || null; await supabaseAdmin.from('prospeccao_enderecos').update({ uf: v }).eq('id', e.id); setEnderecosExtra(prev => prev.map(x => x.id === e.id ? { ...x, uf: v } : x)) }}
                            style={{ fontSize: '0.83rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b', textTransform: 'uppercase' }} />
                        </div>
                      </div>
                      <input type="text" defaultValue={e.observacao ?? ''} placeholder="Observação (ex: canteiro de obras norte)..."
                        onBlur={async ev => { const v = ev.target.value.trim() || null; await supabaseAdmin.from('prospeccao_enderecos').update({ observacao: v }).eq('id', e.id); setEnderecosExtra(prev => prev.map(x => x.id === e.id ? { ...x, observacao: v } : x)) }}
                        style={{ fontSize: '0.8rem', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#f8fafc', color: '#64748b' }} />
                    </div>
                  ))}

                  {!novoEndereco ? (
                    <button onClick={() => setNovoEndereco({ tipo: 'Obra', logradouro: '', bairro: '', cidade: p.cidade ?? '', uf: p.uf ?? '', cep: '', observacao: '' })}
                      style={{ alignSelf: 'flex-start', fontSize: '0.8rem', color: 'var(--color-primary)', background: '#eff6ff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Endereço (obra/filial)
                    </button>
                  ) : (
                    <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px dashed #93c5fd', background: '#f0f9ff', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <select value={novoEndereco.tipo} onChange={ev => setNovoEndereco(x => x ? { ...x, tipo: ev.target.value } : x)}
                        style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }}>
                        <option value="Obra">🏗 Obra</option>
                        <option value="Filial">🏬 Filial</option>
                        <option value="Sede">🏢 Sede</option>
                        <option value="Outro">📌 Outro</option>
                      </select>
                      <input autoFocus value={novoEndereco.logradouro} onChange={ev => setNovoEndereco(x => x ? { ...x, logradouro: ev.target.value } : x)}
                        placeholder="Logradouro e número..." style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={novoEndereco.cidade} onChange={ev => setNovoEndereco(x => x ? { ...x, cidade: ev.target.value } : x)}
                          placeholder="Cidade..." style={{ flex: 3, fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                        <input value={novoEndereco.uf} onChange={ev => setNovoEndereco(x => x ? { ...x, uf: ev.target.value.toUpperCase() } : x)}
                          placeholder="UF" maxLength={2} style={{ flex: 1, fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff', textTransform: 'uppercase' }} />
                      </div>
                      <input value={novoEndereco.observacao} onChange={ev => setNovoEndereco(x => x ? { ...x, observacao: ev.target.value } : x)}
                        placeholder="Observação (ex: canteiro norte)..." style={{ fontSize: '0.8rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={async () => {
                          const { tipo, logradouro, bairro, cidade, uf, cep, observacao } = novoEndereco!
                          const { data, error } = await supabaseAdmin.from('prospeccao_enderecos')
                            .insert({ prospect_id: p.id, tipo, logradouro: logradouro || null, bairro: bairro || null, cidade: cidade || null, uf: uf || null, cep: cep.replace(/\D/g,'') || null, observacao: observacao || null })
                            .select().single()
                          if (error) { alert('Erro: ' + error.message); return }
                          setEnderecosExtra(prev => [...prev, data])
                          setNovoEndereco(null)
                        }} style={{ flex: 1, fontSize: '0.8rem', padding: '5px 0', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Salvar</button>
                        <button onClick={() => setNovoEndereco(null)}
                          style={{ fontSize: '0.8rem', padding: '5px 12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              })()}

              {/* ══ ABA CONTATOS ══ */}
              {drawerAba === 'contatos' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Contato principal */}
                <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>👤 Contato principal</span>
                  <input type="text" defaultValue={p.nome_contato ?? ''} placeholder="Nome do responsável..."
                    onBlur={async e => {
                      const val = e.target.value.trim() || null
                      if (val === (p.nome_contato ?? null)) return
                      await supabaseAdmin.from('prospeccao').update({ nome_contato: val }).eq('id', p.id)
                      setProspectDetalhe(prev => prev ? { ...prev, nome_contato: val } : prev)
                      setProspects(prev => prev.map(r => r.id === p.id ? { ...r, nome_contato: val } : r))
                    }}
                    style={{ fontSize: '0.85rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#fff', color: '#1e293b' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', minWidth: 16 }}>📞</span>
                    <input type="tel" defaultValue={p.telefone1 ? fmtTel(p.telefone1) : ''} placeholder="Telefone principal..."
                      onBlur={async e => {
                        const val = e.target.value.replace(/\D/g, '') || null
                        if (val === (p.telefone1?.replace(/\D/g, '') ?? null)) return
                        await supabaseAdmin.from('prospeccao').update({ telefone1: val }).eq('id', p.id)
                        setProspectDetalhe(prev => prev ? { ...prev, telefone1: val } : prev)
                        setProspects(prev => prev.map(r => r.id === p.id ? { ...r, telefone1: val } : r))
                      }}
                      style={{ flex: 1, fontSize: '0.85rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#fff', color: '#1e293b' }} />
                    {p.telefone1 && <>
                      <a href={`tel:+55${waNum(p.telefone1)}`} style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', background: '#eff6ff', borderRadius: 6, padding: '4px 7px', whiteSpace: 'nowrap' }}>Ligar</a>
                      <a href={`https://wa.me/55${waNum(p.telefone1)}?text=Olá, estou entrando em contato sobre fixadores de porcelanato Pousinox.`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#15803d', textDecoration: 'none', background: '#dcfce7', borderRadius: 6, padding: '4px 7px', whiteSpace: 'nowrap' }}>WA</a>
                    </>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', minWidth: 16 }}>📱</span>
                    <input type="tel" defaultValue={p.telefone2 ? fmtTel(p.telefone2) : ''} placeholder="Telefone secundário..."
                      onBlur={async e => {
                        const val = e.target.value.replace(/\D/g, '') || null
                        if (val === (p.telefone2?.replace(/\D/g, '') ?? null)) return
                        await supabaseAdmin.from('prospeccao').update({ telefone2: val }).eq('id', p.id)
                        setProspectDetalhe(prev => prev ? { ...prev, telefone2: val } : prev)
                        setProspects(prev => prev.map(r => r.id === p.id ? { ...r, telefone2: val } : r))
                      }}
                      style={{ flex: 1, fontSize: '0.85rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#fff', color: '#1e293b' }} />
                    {p.telefone2 && <>
                      <a href={`tel:+55${waNum(p.telefone2)}`} style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', background: '#eff6ff', borderRadius: 6, padding: '4px 7px', whiteSpace: 'nowrap' }}>Ligar</a>
                      <a href={`https://wa.me/55${waNum(p.telefone2)}?text=Olá, estou entrando em contato sobre fixadores de porcelanato Pousinox.`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#15803d', textDecoration: 'none', background: '#dcfce7', borderRadius: 6, padding: '4px 7px', whiteSpace: 'nowrap' }}>WA</a>
                    </>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', minWidth: 16 }}>✉️</span>
                    <input type="email" defaultValue={p.email ?? ''} placeholder="E-mail..."
                      onBlur={async e => {
                        const val = e.target.value.trim() || null
                        if (val === (p.email ?? null)) return
                        await supabaseAdmin.from('prospeccao').update({ email: val }).eq('id', p.id)
                        setProspectDetalhe(prev => prev ? { ...prev, email: val } : prev)
                      }}
                      style={{ flex: 1, fontSize: '0.85rem', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', background: '#fff', color: '#1e293b' }} />
                    {p.email && (
                      <button onClick={() => { navigator.clipboard.writeText(p.email!).catch(() => {}); setEmailToast(p.email!); setTimeout(() => setEmailToast(null), 3000) }}
                        style={{ fontSize: '0.72rem', color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copiar</button>
                    )}
                  </div>
                </div>

                {/* Contatos por área */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Contatos por área</span>
                  {!novoContato && (
                    <button onClick={() => setNovoContato({ nome: '', cargo: '', telefone: '', email: '' })}
                      style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: '#eff6ff', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Contato
                    </button>
                  )}
                </div>
                {loadingContatos && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Carregando...</div>}
                {contatosExtra.map(c => (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', position: 'relative' }}>
                    <button onClick={async () => { await supabaseAdmin.from('prospeccao_contatos').delete().eq('id', c.id); setContatosExtra(prev => prev.filter(x => x.id !== c.id)) }}
                      style={{ position: 'absolute', top: 4, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.8rem' }}>✕</button>
                    <input defaultValue={c.nome ?? ''} placeholder="Nome..." onBlur={async e => { const val = e.target.value.trim() || null; await supabaseAdmin.from('prospeccao_contatos').update({ nome: val }).eq('id', c.id); setContatosExtra(prev => prev.map(x => x.id === c.id ? { ...x, nome: val } : x)) }}
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontFamily: 'inherit', background: '#fff', gridColumn: '1 / -1' }} />
                    <input defaultValue={c.cargo ?? ''} placeholder="Área / cargo..." onBlur={async e => { const val = e.target.value.trim() || null; await supabaseAdmin.from('prospeccao_contatos').update({ cargo: val }).eq('id', c.id); setContatosExtra(prev => prev.map(x => x.id === c.id ? { ...x, cargo: val } : x)) }}
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                    <input defaultValue={c.telefone ?? ''} placeholder="Telefone..." onBlur={async e => { const val = e.target.value.replace(/\D/g, '') || null; await supabaseAdmin.from('prospeccao_contatos').update({ telefone: val }).eq('id', c.id); setContatosExtra(prev => prev.map(x => x.id === c.id ? { ...x, telefone: val } : x)) }}
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                    <input defaultValue={c.email ?? ''} placeholder="E-mail..." type="email" onBlur={async e => { const val = e.target.value.trim() || null; await supabaseAdmin.from('prospeccao_contatos').update({ email: val }).eq('id', c.id); setContatosExtra(prev => prev.map(x => x.id === c.id ? { ...x, email: val } : x)) }}
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontFamily: 'inherit', background: '#fff', gridColumn: '1 / -1' }} />
                  </div>
                ))}
                {novoContato && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '8px 10px', background: '#f0f9ff', borderRadius: 8, border: '1px dashed #93c5fd' }}>
                    <input autoFocus value={novoContato.nome} onChange={e => setNovoContato(x => x ? { ...x, nome: e.target.value } : x)} placeholder="Nome..."
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff', gridColumn: '1 / -1' }} />
                    <input value={novoContato.cargo} onChange={e => setNovoContato(x => x ? { ...x, cargo: e.target.value } : x)} placeholder="Área / cargo..."
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                    <input value={novoContato.telefone} onChange={e => setNovoContato(x => x ? { ...x, telefone: e.target.value } : x)} placeholder="Telefone..."
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff' }} />
                    <input value={novoContato.email} onChange={e => setNovoContato(x => x ? { ...x, email: e.target.value } : x)} placeholder="E-mail..." type="email"
                      style={{ fontSize: '0.82rem', padding: '4px 6px', border: '1px solid #bae6fd', borderRadius: 5, fontFamily: 'inherit', background: '#fff', gridColumn: '1 / -1' }} />
                    <div style={{ display: 'flex', gap: 6, gridColumn: '1 / -1' }}>
                      <button onClick={async () => {
                        const { nome, cargo, telefone, email } = novoContato
                        const { data, error } = await supabaseAdmin.from('prospeccao_contatos')
                          .insert({ prospect_id: p.id, nome: nome.trim() || null, cargo: cargo.trim() || null, telefone: telefone.replace(/\D/g,'') || null, email: email.trim() || null })
                          .select().single()
                        if (error) { alert('Erro: ' + error.message); return }
                        setContatosExtra(prev => [...prev, data]); setNovoContato(null)
                      }} style={{ flex: 1, fontSize: '0.8rem', padding: '5px 0', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Salvar</button>
                      <button onClick={() => setNovoContato(null)} style={{ fontSize: '0.8rem', padding: '5px 12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    </div>
                  </div>
                )}
                {!loadingContatos && contatosExtra.length === 0 && !novoContato && (
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontStyle: 'italic' }}>Nenhum contato por área cadastrado.</div>
                )}
              </div>}

              {/* ══ ABA HISTÓRICO ══ */}
              {drawerAba === 'historico' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.cliente_ativo ? <>
                  {loadingNFs && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Carregando…</div>}
                  {!loadingNFs && clienteNFs.length === 0 && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Nenhuma NF encontrada.</div>}
                  {clienteNFs.map(nf => (
                    <div key={nf.numero}>
                      <div onClick={() => expandirNF(nf.numero)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: nfExpandida === nf.numero ? '#f0fdf4' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontWeight: 600 }}>{nfExpandida === nf.numero ? '▾' : '▸'} NF {nf.numero}</span>
                        <span style={{ color: '#64748b' }}>{nf.emissao ? new Date(nf.emissao).toLocaleDateString('pt-BR') : '—'}</span>
                        <span style={{ fontWeight: 600, color: '#15803d' }}>{nf.total != null ? nf.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
                      </div>
                      {nfExpandida === nf.numero && (
                        <div style={{ background: '#f8fafc', borderRadius: 4, padding: '6px 8px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
                          {!nfItensCache[nf.numero] && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Carregando…</div>}
                          {nfItensCache[nf.numero]?.length === 0 && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Sem itens.</div>}
                          {nfItensCache[nf.numero]?.map((it, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '3px 0', borderBottom: '1px solid #e2e8f0' }}>
                              <span style={{ flex: 1, color: '#1e293b' }}>{it.descricao || '—'}</span>
                              <span style={{ color: '#64748b', marginLeft: 8, whiteSpace: 'nowrap' }}>{it.quantidade}× {it.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </> : <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Prospect ainda não é cliente — sem histórico de compras.</div>}
              </div>}

              {/* Botão fixo no rodapé */}
              <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <AiActionButton label="Sugerir abordagem" icon="💬" modelName="Groq" action={async () => {
                  const r = await aiChat({
                    prompt: `Prospect: ${p.nome}\nCNPJ: ${p.cnpj || 'N/I'}\nSegmento: ${p.segmento || 'N/I'}\nPorte: ${p.porte || 'N/I'}\nCidade/UF: ${p.cidade || ''}/${p.uf || ''}\nScore: ${p.score ?? 'N/I'}\nCliente ativo: ${p.cliente_ativo ? 'Sim' : 'Não'}\n\nSugira uma abordagem comercial personalizada para contato via WhatsApp e email. A Pousinox fabrica fixadores de porcelanato em aço inox. Inclua: gancho de abertura, proposta de valor relevante para o segmento, e call-to-action.`,
                    system: 'Vendedor consultivo B2B da Pousinox. Crie mensagens naturais e profissionais. Português brasileiro.',
                    model: 'groq',
                  })
                  return r.error ? `Erro: ${r.error}` : r.content
                }} />
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
      <AgentProspector aberto={agentProspector} onClose={() => setAgentProspector(false)} />
    </div>
  )
}
