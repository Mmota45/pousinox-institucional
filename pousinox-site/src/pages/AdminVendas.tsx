import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import { useAdmin } from '../contexts/AdminContext'
import styles from './AdminVendas.module.css'

interface Produto { id: string; titulo: string; preco: number }
interface Venda {
  id: string
  produto_titulo: string
  valor_recebido: number
  forma_pagamento: string
  data_venda: string
  observacao: string | null
}

const FORMAS = ['pix', 'dinheiro', 'cartão de débito', 'cartão de crédito', 'outros']

export default function AdminVendas() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [form, setForm] = useState({
    produto_id: '',
    produto_titulo: '',
    valor_recebido: '',
    forma_pagamento: 'pix',
    data_venda: new Date().toISOString().slice(0, 16),
    observacao: '',
  })

  useEffect(() => {
    fetchProdutos()
    fetchVendas()
  }, [])

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3000)
      return () => clearTimeout(t)
    }
  }, [msg])

  async function fetchProdutos() {
    const { data } = await supabaseAdmin.from('produtos').select('id, titulo, preco').order('titulo')
    setProdutos(data ?? [])
  }

  async function fetchVendas() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('vendas').select('*').order('data_venda', { ascending: false }).limit(50)
    setVendas(data ?? [])
    setLoading(false)
  }

  function selecionarProduto(id: string) {
    const p = produtos.find(p => p.id === id)
    if (p) setForm(f => ({ ...f, produto_id: id, produto_titulo: p.titulo, valor_recebido: String(p.preco) }))
  }

  async function registrarVenda(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    const { error } = await supabaseAdmin.from('vendas').insert({
      produto_id: form.produto_id || null,
      produto_titulo: form.produto_titulo.trim(),
      valor_recebido: parseFloat(form.valor_recebido),
      forma_pagamento: form.forma_pagamento,
      data_venda: new Date(form.data_venda).toISOString(),
      observacao: form.observacao.trim() || null,
    })

    if (!error) {
      // Marca produto como vendido se selecionado
      if (form.produto_id) {
        await supabaseAdmin.from('produtos').update({ disponivel: false, vendido_em: new Date().toISOString() }).eq('id', form.produto_id)
        await supabaseAdmin.from('movimentacoes_estoque').insert({
          produto_id: form.produto_id,
          produto_titulo: form.produto_titulo,
          tipo: 'venda',
          quantidade: -1,
          observacao: `Venda registrada — ${form.forma_pagamento}`,
        })
      }
      setMsg({ tipo: 'ok', texto: 'Venda registrada com sucesso!' })
      setForm({ produto_id: '', produto_titulo: '', valor_recebido: '', forma_pagamento: 'pix', data_venda: new Date().toISOString().slice(0, 16), observacao: '' })
      fetchVendas()
    } else {
      setMsg({ tipo: 'erro', texto: 'Erro ao registrar venda.' })
    }
    setSalvando(false)
  }

  async function excluirVenda(id: string) {
    if (!confirm('Excluir esta venda?')) return
    await supabaseAdmin.from('vendas').delete().eq('id', id)
    fetchVendas()
  }

  const { ocultarValores } = useAdmin()
  const fmt = (v: number) => ocultarValores ? '••••' : 'R$ ' + Number(v).toFixed(2).replace('.', ',')
  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const [sortKey, setSortKey] = useState<keyof Venda>('data_venda')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(k: keyof Venda) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }
  function ind(k: keyof Venda) { return sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }

  const vendasSorted = [...vendas].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className={styles.wrap}>
      {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

      <form className={styles.form} onSubmit={registrarVenda}>
        <h2 className={styles.formTitle}>Registrar venda</h2>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>Produto</label>
            <select className={styles.input} value={form.produto_id} onChange={e => selecionarProduto(e.target.value)}>
              <option value="">— Selecione ou digite abaixo —</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>Título do produto *</label>
            <input className={styles.input} value={form.produto_titulo} onChange={e => setForm(f => ({ ...f, produto_titulo: e.target.value }))} placeholder="Preenchido ao selecionar acima" required />
          </div>
        </div>

        <div className={styles.row3}>
          <div className={styles.field}>
            <label>Valor recebido (R$) *</label>
            <input className={styles.input} type="number" step="0.01" min="0" value={form.valor_recebido} onChange={e => setForm(f => ({ ...f, valor_recebido: e.target.value }))} required />
          </div>
          <div className={styles.field}>
            <label>Forma de pagamento *</label>
            <select className={styles.input} value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
              {FORMAS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Data da venda *</label>
            <input className={styles.input} type="datetime-local" value={form.data_venda} onChange={e => setForm(f => ({ ...f, data_venda: e.target.value }))} required />
          </div>
        </div>

        <div className={styles.field}>
          <label>Observação</label>
          <input className={styles.input} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={salvando}>
            {salvando ? 'Registrando...' : 'Registrar venda'}
          </button>
        </div>
      </form>

      <div className={styles.lista}>
        <h2 className={styles.formTitle}>Últimas vendas</h2>
        {loading ? (
          <p className={styles.vazio}>Carregando...</p>
        ) : vendas.length === 0 ? (
          <p className={styles.vazio}>Nenhuma venda registrada.</p>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th className={styles.sortable} onClick={() => toggleSort('produto_titulo')}>Produto{ind('produto_titulo')}</th>
                <th className={styles.sortable} onClick={() => toggleSort('valor_recebido')}>Valor{ind('valor_recebido')}</th>
                <th className={styles.sortable} onClick={() => toggleSort('forma_pagamento')}>Pagamento{ind('forma_pagamento')}</th>
                <th className={styles.sortable} onClick={() => toggleSort('data_venda')}>Data{ind('data_venda')}</th>
                <th>Obs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendasSorted.map(v => (
                <tr key={v.id}>
                  <td>{v.produto_titulo}</td>
                  <td className={styles.valor}>{fmt(v.valor_recebido)}</td>
                  <td>{v.forma_pagamento}</td>
                  <td>{fmtData(v.data_venda)}</td>
                  <td className={styles.obs}>{v.observacao ?? '—'}</td>
                  <td><button className={styles.btnDanger} onClick={() => excluirVenda(v.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
