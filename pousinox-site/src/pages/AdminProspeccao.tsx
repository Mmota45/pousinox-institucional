import { useState, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminProspeccao.module.css'

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

  const filtrados = busca.trim()
    ? options.filter(o => o.toLowerCase().includes(busca.toLowerCase()))
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

  // Carregar mesorregiões quando UFs mudam
  useEffect(() => {
    if (ufs.length === 0) { setMesorregioes([]); setMesorregioesSel([]); setCidades([]); setCidadesSel([]); return }
    setLoadingMeso(true)
    setMesorregioesSel([])
    setCidades([])
    setCidadesSel([])
    supabaseAdmin
      .rpc('get_mesorregioes_ufs', { p_ufs: ufs })
      .then(({ data, error }) => {
        console.log('[meso] data:', data, 'error:', error)
        const lista = (data ?? []).map((r: { mesorregiao: string }) => r.mesorregiao).filter(Boolean) as string[]
        setMesorregioes(lista)
        setLoadingMeso(false)
      })
  }, [ufs])

  // Carregar cidades quando mesorregiões (ou UFs sem meso) mudam
  useEffect(() => {
    if (ufs.length === 0) return
    setLoadingCidades(true)
    setCidadesSel([])
    const rpc = mesorregioesSel.length > 0
      ? supabaseAdmin.rpc('get_cidades_meso', { p_ufs: ufs, p_meso: mesorregioesSel })
      : supabaseAdmin.rpc('get_cidades_ufs', { p_ufs: ufs })
    rpc.then(({ data }) => {
      const lista = (data ?? []).map((r: { cidade: string }) => r.cidade).filter(Boolean) as string[]
      setCidades(lista)
      setLoadingCidades(false)
    })
  }, [ufs, mesorregioesSel])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function aplicarFiltrosBase(q: any) {
    if (busca.trim()) q = q.or(`razao_social.ilike.%${busca.trim()}%,nome_fantasia.ilike.%${busca.trim()}%`)
    if (segmentos.length > 0)        q = q.in('segmento', segmentos)
    if (ufs.length > 0)              q = q.in('uf', ufs)
    if (mesorregioesSel.length > 0)  q = q.in('mesorregiao', mesorregioesSel)
    if (cidadesSel.length > 0)       q = q.in('cidade', cidadesSel)
    if (portes.length > 0)           q = q.in('porte', portes)
    if (contatoFiltro === 'sim')      q = q.eq('contatado', true)
    if (contatoFiltro === 'nao')      q = q.eq('contatado', false)
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

    const base = () => supabaseAdmin.from('prospeccao')

    const qPag = aplicarFiltros(base().select('*', { count: 'exact' }))
      .order('razao_social', { ascending: true })
      .range(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA - 1)

    const qInox     = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Equipamentos Inox')
    const qInoxCont = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Equipamentos Inox').eq('contatado', true)
    const qFix      = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Fixador Porcelanato')
    const qFixCont  = aplicarFiltrosBase(base().select('*', { count: 'exact', head: true })).eq('produto', 'Fixador Porcelanato').eq('contatado', true)

    const [res, resInox, resInoxCont, resFix, resFixCont] = await Promise.all([qPag, qInox, qInoxCont, qFix, qFixCont])

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
    }
    setLoading(false)
  }

  async function toggleContatado(p: Prospect) {
    const novoValor = !p.contatado
    await supabaseAdmin
      .from('prospeccao')
      .update({ contatado: novoValor, contato_em: novoValor ? new Date().toISOString() : null })
      .eq('id', p.id)
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, contatado: novoValor } : x))
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

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className={styles.wrap}>

      {/* ── Info ── */}
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px' }}>
        ✓ Todos os prospects são <strong>empresas ativas</strong> conforme base CNPJ da Receita Federal (março/2026).
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filtros}>

        {/* Busca livre */}
        <div className={styles.filtroGrupo} style={{ flex: 1, minWidth: 200 }}>
          <span className={styles.filtroLabel}>Busca (empresa)</span>
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
          placeholder={ufs.length === 0 ? 'Selecione uma UF' : 'Todas'}
          disabled={ufs.length === 0}
          loading={loadingCidades}
          minWidth={180}
        />

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

        <button className={styles.buscarBtn} onClick={() => buscar(0)} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
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
        </div>
      )}

      {/* ── Tabela ── */}
      {buscado && (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>
              {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} prospects`}
            </span>
            {prospects.length > 0 && (
              <button className={styles.exportBtn} onClick={exportarCSV}>↓ Exportar CSV</button>
            )}
          </div>

          {loading ? (
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
                      <th>Telefone</th>
                      <th>E-mail</th>
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
                            <div className={styles.nome}>{p.razao_social || '—'}</div>
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
                            {p.uf && <div className={styles.fantasia}>{p.uf}</div>}
                          </td>
                          <td>
                            {p.telefone1 && <div>{p.telefone1}</div>}
                            {p.telefone2 && <div className={styles.fantasia}>{p.telefone2}</div>}
                          </td>
                          <td>
                            {p.email
                              ? <a href={`mailto:${p.email}`} style={{ color: 'var(--color-primary)', fontSize: '0.82rem' }}>{p.email}</a>
                              : '—'}
                          </td>
                          <td>
                            <div className={styles.acoes}>
                              {waLink ? (
                                <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.waBtn} title="Abrir WhatsApp">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                  </svg>
                                </a>
                              ) : (
                                <span className={styles.semTel}>—</span>
                              )}
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
    </div>
  )
}
