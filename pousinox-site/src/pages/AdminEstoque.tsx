import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminVendas.module.css'

interface Produto { id: string; titulo: string; quantidade: number; disponivel: boolean }
interface Movimentacao {
  id: string
  produto_titulo: string
  tipo: string
  quantidade: number
  observacao: string | null
  created_at: string
}

const TIPOS = ['entrada', 'ajuste', 'saída']

export default function AdminEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [form, setForm] = useState({
    produto_id: '',
    produto_titulo: '',
    tipo: 'entrada',
    quantidade: '1',
    observacao: '',
  })

  useEffect(() => {
    fetchProdutos()
    fetchMovimentacoes()
  }, [])

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3000)
      return () => clearTimeout(t)
    }
  }, [msg])

  async function fetchProdutos() {
    const { data } = await supabaseAdmin.from('produtos').select('id, titulo, quantidade, disponivel').order('titulo')
    setProdutos(data ?? [])
  }

  async function fetchMovimentacoes() {
    setLoading(true)
    const { data } = await supabaseAdmin.from('movimentacoes_estoque').select('*').order('created_at', { ascending: false }).limit(50)
    setMovimentacoes(data ?? [])
    setLoading(false)
  }

  function selecionarProduto(id: string) {
    const p = produtos.find(p => p.id === id)
    if (p) setForm(f => ({ ...f, produto_id: id, produto_titulo: p.titulo }))
  }

  async function registrarMovimentacao(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    const qtd = parseInt(form.quantidade)
    const delta = form.tipo === 'entrada' ? qtd : form.tipo === 'saída' ? -qtd : qtd

    const { error } = await supabaseAdmin.from('movimentacoes_estoque').insert({
      produto_id: form.produto_id || null,
      produto_titulo: form.produto_titulo.trim(),
      tipo: form.tipo,
      quantidade: delta,
      observacao: form.observacao.trim() || null,
    })

    if (!error && form.produto_id) {
      const prod = produtos.find(p => p.id === form.produto_id)
      if (prod) {
        const novaQtd = Math.max(0, prod.quantidade + delta)
        await supabaseAdmin.from('produtos').update({ quantidade: novaQtd, disponivel: novaQtd > 0 }).eq('id', form.produto_id)
      }
    }

    if (!error) {
      setMsg({ tipo: 'ok', texto: 'Movimentação registrada!' })
      setForm({ produto_id: '', produto_titulo: '', tipo: 'entrada', quantidade: '1', observacao: '' })
      fetchProdutos()
      fetchMovimentacoes()
    } else {
      setMsg({ tipo: 'erro', texto: 'Erro ao registrar movimentação.' })
    }
    setSalvando(false)
  }

  const fmtData = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const [prodKey, setProdKey] = useState<keyof Produto>('titulo')
  const [prodDir, setProdDir] = useState<'asc' | 'desc'>('asc')
  const [movKey, setMovKey] = useState<keyof Movimentacao>('created_at')
  const [movDir, setMovDir] = useState<'asc' | 'desc'>('desc')

  function toggleProd(k: keyof Produto) {
    if (k === prodKey) setProdDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setProdKey(k); setProdDir('desc') }
  }
  function toggleMov(k: keyof Movimentacao) {
    if (k === movKey) setMovDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setMovKey(k); setMovDir('desc') }
  }
  function indProd(k: keyof Produto) { return prodKey === k ? (prodDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }
  function indMov(k: keyof Movimentacao) { return movKey === k ? (movDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅' }

  const prodSorted = [...produtos].sort((a, b) => {
    const av = a[prodKey] ?? ''; const bv = b[prodKey] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return prodDir === 'asc' ? cmp : -cmp
  })
  const movSorted = [...movimentacoes].sort((a, b) => {
    const av = a[movKey] ?? ''; const bv = b[movKey] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return movDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className={styles.wrap}>
      {msg && <div className={`${styles.msg} ${msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}`}>{msg.texto}</div>}

      <div className={styles.grid2col}>
        {/* Situação atual */}
        <div>
          <h2 className={styles.formTitle}>Situação do estoque</h2>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th className={styles.sortable} onClick={() => toggleProd('titulo')}>Produto{indProd('titulo')}</th>
                <th className={styles.sortable} onClick={() => toggleProd('quantidade')}>Qtd{indProd('quantidade')}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(prodSorted as Produto[]).map(p => (
                <tr key={p.id}>
                  <td>{p.titulo}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.quantidade}</td>
                  <td>
                    <span className={p.disponivel ? (p.quantidade === 1 ? styles.badgeUltima : styles.badgeOk) : styles.badgeVendido}>
                      {p.disponivel ? (p.quantidade === 1 ? 'Última unidade' : 'Em estoque') : 'Indisponível'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form movimentação */}
        <div>
          <form className={styles.form} onSubmit={registrarMovimentacao}>
            <h2 className={styles.formTitle}>Registrar movimentação</h2>

            <div className={styles.field}>
              <label>Produto</label>
              <select className={styles.input} value={form.produto_id} onChange={e => selecionarProduto(e.target.value)}>
                <option value="">— Selecione —</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>

            <div className={styles.row3}>
              <div className={styles.field}>
                <label>Tipo *</label>
                <select className={styles.input} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Quantidade *</label>
                <input className={styles.input} type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} required />
              </div>
            </div>

            <div className={styles.field}>
              <label>Observação</label>
              <input className={styles.input} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={salvando}>
                {salvando ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={styles.lista}>
        <h2 className={styles.formTitle}>Histórico de movimentações</h2>
        {loading ? (
          <p className={styles.vazio}>Carregando...</p>
        ) : movimentacoes.length === 0 ? (
          <p className={styles.vazio}>Nenhuma movimentação registrada.</p>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th className={styles.sortable} onClick={() => toggleMov('produto_titulo')}>Produto{indMov('produto_titulo')}</th>
                <th className={styles.sortable} onClick={() => toggleMov('tipo')}>Tipo{indMov('tipo')}</th>
                <th className={styles.sortable} onClick={() => toggleMov('quantidade')}>Qtd{indMov('quantidade')}</th>
                <th>Obs</th>
                <th className={styles.sortable} onClick={() => toggleMov('created_at')}>Data{indMov('created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {(movSorted as Movimentacao[]).map(m => (
                <tr key={m.id}>
                  <td>{m.produto_titulo}</td>
                  <td><span className={m.tipo === 'entrada' ? styles.badgeOk : m.tipo === 'venda' ? styles.badgeVendido : styles.badgeUltima}>{m.tipo}</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: m.quantidade > 0 ? '#16a34a' : '#dc2626' }}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
                  <td className={styles.obs}>{m.observacao ?? '—'}</td>
                  <td>{fmtData(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
