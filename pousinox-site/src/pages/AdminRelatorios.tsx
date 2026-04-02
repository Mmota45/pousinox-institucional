import { useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminVendas.module.css'

interface Venda {
  id: string
  produto_titulo: string
  valor_recebido: number
  forma_pagamento: string
  data_venda: string
  observacao: string | null
}

export default function AdminRelatorios() {
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const hojeStr = hoje.toISOString().slice(0, 10)

  const [dataInicio, setDataInicio] = useState(inicioMes)
  const [dataFim, setDataFim] = useState(hojeStr)
  const [vendas, setVendas] = useState<Venda[]>([])
  const [buscado, setBuscado] = useState(false)
  const [loading, setLoading] = useState(false)

  async function buscar() {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('vendas')
      .select('*')
      .gte('data_venda', new Date(dataInicio).toISOString())
      .lte('data_venda', new Date(dataFim + 'T23:59:59').toISOString())
      .order('data_venda', { ascending: false })
    setVendas(data ?? [])
    setBuscado(true)
    setLoading(false)
  }

  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const total = vendas.reduce((s, v) => s + Number(v.valor_recebido), 0)
  const ticket = vendas.length > 0 ? total / vendas.length : 0

  const porForma: Record<string, { qtd: number; valor: number }> = {}
  vendas.forEach(v => {
    if (!porForma[v.forma_pagamento]) porForma[v.forma_pagamento] = { qtd: 0, valor: 0 }
    porForma[v.forma_pagamento].qtd++
    porForma[v.forma_pagamento].valor += Number(v.valor_recebido)
  })

  const porProduto: Record<string, { qtd: number; valor: number }> = {}
  vendas.forEach(v => {
    if (!porProduto[v.produto_titulo]) porProduto[v.produto_titulo] = { qtd: 0, valor: 0 }
    porProduto[v.produto_titulo].qtd++
    porProduto[v.produto_titulo].valor += Number(v.valor_recebido)
  })

  const formaArray = Object.entries(porForma).map(([forma, d]) => ({ forma, ...d }))
  const prodArray = Object.entries(porProduto).map(([titulo, d]) => ({ titulo, ...d }))

  const [vendKey, setVendKey] = useState<keyof Venda>('data_venda')
  const [vendDir, setVendDir] = useState<'asc' | 'desc'>('desc')
  const [formaKey, setFormaKey] = useState<'forma' | 'qtd' | 'valor'>('valor')
  const [formaDir, setFormaDir] = useState<'asc' | 'desc'>('desc')
  const [prodKey2, setProdKey2] = useState<'titulo' | 'qtd' | 'valor'>('valor')
  const [prodDir2, setProdDir2] = useState<'asc' | 'desc'>('desc')

  function toggleVend(k: keyof Venda) {
    if (k === vendKey) setVendDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setVendKey(k); setVendDir('desc') }
  }
  function toggleForma(k: 'forma' | 'qtd' | 'valor') {
    if (k === formaKey) setFormaDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setFormaKey(k); setFormaDir('desc') }
  }
  function toggleProd2(k: 'titulo' | 'qtd' | 'valor') {
    if (k === prodKey2) setProdDir2(d => d === 'asc' ? 'desc' : 'asc')
    else { setProdKey2(k); setProdDir2('desc') }
  }
  function indVend(k: keyof Venda) { return vendKey === k ? (vendDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }
  function indForma(k: string) { return formaKey === k ? (formaDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }
  function indProd2(k: string) { return prodKey2 === k ? (prodDir2 === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }

  function sortArr<T>(arr: T[], key: keyof T, dir: 'asc' | 'desc') {
    return [...arr].sort((a, b) => {
      const av = a[key] ?? ''; const bv = b[key] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return dir === 'asc' ? cmp : -cmp
    })
  }

  function exportarCSV() {
    const header = 'Produto,Valor,Pagamento,Data,Observação'
    const rows = vendas.map(v =>
      `"${v.produto_titulo}","${fmt(v.valor_recebido)}","${v.forma_pagamento}","${fmtData(v.data_venda)}","${v.observacao ?? ''}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendas-${dataInicio}-${dataFim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.form}>
        <h2 className={styles.formTitle}>Relatório de vendas</h2>
        <div className={styles.row3}>
          <div className={styles.field}>
            <label>Data início</label>
            <input className={styles.input} type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Data fim</label>
            <input className={styles.input} type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
            <label>&nbsp;</label>
            <button className={styles.btnPrimary} onClick={buscar} disabled={loading}>
              {loading ? 'Buscando...' : 'Gerar relatório'}
            </button>
          </div>
        </div>
      </div>

      {buscado && (
        <>
          {/* Indicadores */}
          <div className={styles.indicadores}>
            <div className={styles.indicador}>
              <span>Total de vendas</span>
              <strong>{vendas.length}</strong>
            </div>
            <div className={styles.indicador}>
              <span>Faturamento</span>
              <strong>{fmt(total)}</strong>
            </div>
            <div className={styles.indicador}>
              <span>Ticket médio</span>
              <strong>{fmt(ticket)}</strong>
            </div>
          </div>

          {vendas.length > 0 && (
            <div className={styles.grid2col}>
              {/* Por forma de pagamento */}
              <div>
                <h3 className={styles.formTitle}>Por forma de pagamento</h3>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th className={styles.sortable} onClick={() => toggleForma('forma')}>Forma{indForma('forma')}</th>
                      <th className={styles.sortable} onClick={() => toggleForma('qtd')}>Qtd{indForma('qtd')}</th>
                      <th className={styles.sortable} onClick={() => toggleForma('valor')}>Total{indForma('valor')}</th>

                    </tr>
                  </thead>
                  <tbody>
                    {sortArr(formaArray, formaKey, formaDir).map(d => (
                      <tr key={d.forma}>
                        <td>{d.forma.charAt(0).toUpperCase() + d.forma.slice(1)}</td>
                        <td style={{ textAlign: 'center' }}>{d.qtd}</td>
                        <td className={styles.valor}>{fmt(d.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Por produto */}
              <div>
                <h3 className={styles.formTitle}>Por produto</h3>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th className={styles.sortable} onClick={() => toggleProd2('titulo')}>Produto{indProd2('titulo')}</th>
                      <th className={styles.sortable} onClick={() => toggleProd2('qtd')}>Qtd{indProd2('qtd')}</th>
                      <th className={styles.sortable} onClick={() => toggleProd2('valor')}>Total{indProd2('valor')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortArr(prodArray, prodKey2, prodDir2).map(d => (
                      <tr key={d.titulo}>
                        <td>{d.titulo}</td>
                        <td style={{ textAlign: 'center' }}>{d.qtd}</td>
                        <td className={styles.valor}>{fmt(d.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela completa */}
          <div className={styles.lista}>
            <div className={styles.listaHeader}>
              <h3 className={styles.formTitle}>Detalhamento ({vendas.length} venda{vendas.length !== 1 ? 's' : ''})</h3>
              {vendas.length > 0 && (
                <button className={styles.btnSecondary} onClick={exportarCSV}>Exportar CSV</button>
              )}
            </div>
            {vendas.length === 0 ? (
              <p className={styles.vazio}>Nenhuma venda no período selecionado.</p>
            ) : (
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th className={styles.sortable} onClick={() => toggleVend('produto_titulo')}>Produto{indVend('produto_titulo')}</th>
                    <th className={styles.sortable} onClick={() => toggleVend('valor_recebido')}>Valor{indVend('valor_recebido')}</th>
                    <th className={styles.sortable} onClick={() => toggleVend('forma_pagamento')}>Pagamento{indVend('forma_pagamento')}</th>
                    <th className={styles.sortable} onClick={() => toggleVend('data_venda')}>Data{indVend('data_venda')}</th>

                    <th>Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {sortArr(vendas, vendKey, vendDir).map(v => (
                    <tr key={v.id}>
                      <td>{v.produto_titulo}</td>
                      <td className={styles.valor}>{fmt(v.valor_recebido)}</td>
                      <td>{v.forma_pagamento}</td>
                      <td>{fmtData(v.data_venda)}</td>
                      <td className={styles.obs}>{v.observacao ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
