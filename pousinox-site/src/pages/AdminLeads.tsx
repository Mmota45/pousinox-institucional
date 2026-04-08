import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminLeads.module.css'

interface Lead {
  id: number
  produto_titulo: string | null
  cliente_nome: string | null
  cliente_whatsapp: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  created_at: string
}

const POR_PAGINA = 50

export default function AdminLeads() {
  const [leads, setLeads]       = useState<Lead[]>([])
  const [total, setTotal]       = useState(0)
  const [pagina, setPagina]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')

  async function carregar(pag = 0, termo = busca) {
    setLoading(true)
    let q = supabaseAdmin
      .from('interesses')
      .select('id, produto_titulo, cliente_nome, cliente_whatsapp, cidade, uf, cep, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (termo.trim()) {
      q = q.or(`cliente_nome.ilike.%${termo.trim()}%,produto_titulo.ilike.%${termo.trim()}%,cidade.ilike.%${termo.trim()}%`)
    }

    q = q.range(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA - 1)

    const { data, count } = await q
    setLeads(data ?? [])
    setTotal(count ?? 0)
    setPagina(pag)
    setLoading(false)
  }

  useEffect(() => { carregar(0) }, [])

  function exportarCSV() {
    const header = 'Nome;WhatsApp;Produto;Cidade;UF;CEP;Data'
    const linhas = leads.map(l => [
      l.cliente_nome, l.cliente_whatsapp, l.produto_titulo,
      l.cidade, l.uf, l.cep,
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
        {leads.length > 0 && (
          <button className={styles.exportBtn} onClick={exportarCSV}>↓ Exportar CSV</button>
        )}
      </div>

      {/* ── Busca ── */}
      <div className={styles.busca}>
        <input
          className={styles.buscaInput}
          type="text"
          placeholder="Buscar por nome, produto ou cidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && carregar(0, busca)}
        />
        <button className={styles.buscaBtn} onClick={() => carregar(0, busca)}>Buscar</button>
      </div>

      {/* ── Tabela ── */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>
            {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} lead${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <div className={styles.vazio}>Carregando...</div>
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
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => {
                    const wa = l.cliente_whatsapp?.replace(/\D/g, '')
                    const waLink = wa ? `https://wa.me/55${wa}` : null
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
