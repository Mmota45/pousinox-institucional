import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminLeads.module.css'
import AiActionButton from '../components/assistente/AiActionButton'
import { aiChat } from '../lib/aiHelper'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'

interface Lead {
  id: number
  produto_titulo: string | null
  cliente_nome: string | null
  cliente_whatsapp: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  status: string | null
  created_at: string
}

type Status = 'novo' | 'em_contato' | 'proposta' | 'fechado' | 'perdido'

const STATUS_OPCOES: { value: Status; label: string }[] = [
  { value: 'novo',       label: 'Novo' },
  { value: 'em_contato', label: 'Em contato' },
  { value: 'proposta',   label: 'Proposta enviada' },
  { value: 'fechado',    label: 'Fechado' },
  { value: 'perdido',    label: 'Perdido' },
]

const STATUS_STYLE: Record<Status, string> = {
  novo:       styles.statusNovo,
  em_contato: styles.statusEmContato,
  proposta:   styles.statusProposta,
  fechado:    styles.statusFechado,
  perdido:    styles.statusPerdido,
}

const POR_PAGINA = 50

export default function AdminLeads() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [total, setTotal]         = useState(0)
  const [pagina, setPagina]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const lp = useLoadingProgress(1)
  const [busca, setBusca]               = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [dataInicio, setDataInicio]     = useState('')
  const [dataFim, setDataFim]           = useState('')

  async function carregar(pag = 0, termo = busca, fstatus = filtroStatus, dInicio = dataInicio, dFim = dataFim) {
    setLoading(true)
    let q = supabaseAdmin
      .from('interesses')
      .select('id, produto_titulo, cliente_nome, cliente_whatsapp, cidade, uf, cep, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (termo.trim()) {
      q = q.or(`cliente_nome.ilike.%${termo.trim()}%,produto_titulo.ilike.%${termo.trim()}%,cidade.ilike.%${termo.trim()}%`)
    }
    if (fstatus !== 'todos') q = q.eq('status', fstatus)
    if (dInicio) q = q.gte('created_at', dInicio)
    if (dFim)    q = q.lte('created_at', dFim + 'T23:59:59')

    q = q.range(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA - 1)

    const { data, count } = await q
    setLeads(data ?? [])
    setTotal(count ?? 0)
    setPagina(pag)
    lp.step()
    setLoading(false)
  }

  useEffect(() => { carregar(0) }, [])

  async function atualizarStatus(id: number, novoStatus: Status) {
    await supabaseAdmin.from('interesses').update({ status: novoStatus }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: novoStatus } : l))
  }

  function exportarCSV() {
    const header = 'Nome;WhatsApp;Produto;Cidade;UF;CEP;Status;Data'
    const linhas = leads.map(l => [
      l.cliente_nome, l.cliente_whatsapp, l.produto_titulo,
      l.cidade, l.uf, l.cep,
      STATUS_OPCOES.find(s => s.value === l.status)?.label ?? l.status ?? 'novo',
      l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : '',
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(';'))
    const blob = new Blob([header + '\n' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_outlet_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className={styles.wrap}>

      {/* ── Header ── */}
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.titulo}>Leads — Outlet</h2>
          <p className={styles.subtitulo}>Interesses recebidos pelo site (pronta entrega / sob encomenda)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {leads.length > 0 && (
            <button className={styles.exportBtn} onClick={exportarCSV}>↓ Exportar CSV</button>
          )}
          {leads.length > 0 && (
            <AiActionButton label="Analisar Leads" icon="🤖" modelName="Groq" action={async () => {
              const resumo = leads.slice(0, 30).map(l => `${l.cliente_nome || 'Anônimo'} | ${l.produto_titulo || 'N/I'} | ${l.cidade || 'N/I'} | ${l.status || 'novo'}`).join('\n')
              const r = await aiChat({
                prompt: `Leads recentes da Pousinox (fixadores de porcelanato inox):\nNome | Produto | Cidade | Status\n${resumo}\n\nAnalise os leads: identifique padrões (produtos mais buscados, cidades com mais demanda, leads quentes vs frios), sugira priorização e ações de follow-up.`,
                system: 'Analista comercial da Pousinox. Responda direto com insights acionáveis. Português brasileiro.',
                model: 'groq',
              })
              return r.error ? `Erro: ${r.error}` : r.content
            }} />
          )}
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filtros}>
        <input
          className={styles.buscaInput}
          type="text"
          placeholder="Cliente, produto ou cidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && carregar(0, busca, filtroStatus, dataInicio, dataFim)}
        />
        <select
          className={styles.statusFiltro}
          value={filtroStatus}
          onChange={e => { setFiltroStatus(e.target.value); carregar(0, busca, e.target.value, dataInicio, dataFim) }}
        >
          <option value="todos">Todos os status</option>
          {STATUS_OPCOES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div className={styles.dataGrupo}>
          <span className={styles.dataLabel}>De</span>
          <input
            className={styles.dataInput}
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
          />
          <span className={styles.dataLabel}>até</span>
          <input
            className={styles.dataInput}
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
          />
        </div>
        <button className={styles.buscaBtn} onClick={() => carregar(0, busca, filtroStatus, dataInicio, dataFim)}>Buscar</button>
      </div>

      {/* ── Tabela ── */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>
            {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} lead${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <AdminLoading total={lp.total} current={lp.current} label="Carregando leads..." />
        ) : leads.length === 0 ? (
          <div className={styles.vazio}>Nenhum lead encontrado.</div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Produto</th>
                    <th>Cidade / UF</th>
                    <th>WhatsApp</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => {
                    const wa = l.cliente_whatsapp?.replace(/\D/g, '')
                    const waLink = wa ? `https://wa.me/55${wa}` : null
                    const status = (l.status ?? 'novo') as Status
                    return (
                      <tr key={l.id}>
                        <td className={styles.nome}>{l.cliente_nome || '—'}</td>
                        <td>
                          {l.produto_titulo
                            ? <span className={styles.pill}>{l.produto_titulo}</span>
                            : '—'}
                        </td>
                        <td>
                          {l.cidade
                            ? <span>{l.cidade}{l.uf ? ` — ${l.uf}` : ''}</span>
                            : <span className={styles.semInfo}>Não informado</span>}
                        </td>
                        <td>
                          {waLink
                            ? <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.waLink}>{l.cliente_whatsapp}</a>
                            : l.cliente_whatsapp || '—'}
                        </td>
                        <td>
                          <select
                            className={`${styles.statusSelect} ${STATUS_STYLE[status]}`}
                            value={status}
                            onChange={e => atualizarStatus(l.id, e.target.value as Status)}
                          >
                            {STATUS_OPCOES.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className={styles.data}>
                          {l.created_at ? new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className={styles.paginacao}>
                <span>Página {pagina + 1} de {totalPaginas}</span>
                <div className={styles.pagBtns}>
                  <button className={styles.pagBtn} disabled={pagina === 0} onClick={() => carregar(pagina - 1)}>← Anterior</button>
                  <button className={styles.pagBtn} disabled={pagina >= totalPaginas - 1} onClick={() => carregar(pagina + 1)}>Próxima →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
