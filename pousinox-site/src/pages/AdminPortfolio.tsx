import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminCompras.module.css'

interface Produto {
  id: number; nome: string; descricao: string | null; categoria: string; ativo: boolean
}
interface Mapeamento {
  id: number; segmento: string; produto_id: number; relevancia: number; destaque: boolean
  portfolio_produtos: Produto | null
}
interface Norma {
  id: number; norma: string; orgao: string; titulo: string | null; status: string
  substituida_por: string | null; segmentos: string[]; penalidade: string | null; observacao: string | null
}
interface Exigencia {
  id: number; norma_id: number; artigo: string | null; texto_resumido: string; produto_id: number | null
  portfolio_produtos: { nome: string } | null
}

type Aba = 'produtos' | 'segmentos' | 'normas'
type Vista = 'lista' | 'form'

export default function AdminPortfolio() {
  const [aba, setAba] = useState<Aba>('produtos')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // ── Produtos ──
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [prodVista, setProdVista] = useState<Vista>('lista')
  const [prodEdit, setProdEdit] = useState<Partial<Produto>>({})
  const [prodBusca, setProdBusca] = useState('')

  // ── Segmentos ──
  const [mapeamentos, setMapeamentos] = useState<Mapeamento[]>([])
  const [segFiltro, setSegFiltro] = useState('')
  const [segmentos, setSegmentos] = useState<string[]>([])
  const [segAddOpen, setSegAddOpen] = useState(false)
  const [segAddSegmento, setSegAddSegmento] = useState('')
  const [segAddProduto, setSegAddProduto] = useState<number | null>(null)

  // ── Normas ──
  const [normas, setNormas] = useState<Norma[]>([])
  const [normaExpandida, setNormaExpandida] = useState<number | null>(null)
  const [normaExigencias, setNormaExigencias] = useState<Record<number, Exigencia[]>>({})
  const [normaBusca, setNormaBusca] = useState('')

  const showMsg = (tipo: 'ok' | 'erro', texto: string) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3000) }

  // ── Loaders ──
  const carregarProdutos = useCallback(async () => {
    const { data } = await supabaseAdmin.from('portfolio_produtos').select('*').order('nome')
    setProdutos(data ?? [])
  }, [])

  const carregarMapeamentos = useCallback(async () => {
    const q = supabaseAdmin.from('segmento_portfolio')
      .select('id, segmento, produto_id, relevancia, destaque, portfolio_produtos(id, nome, descricao, categoria, ativo)')
      .order('segmento')
    if (segFiltro) q.eq('segmento', segFiltro)
    const { data } = await q
    setMapeamentos((data as any) ?? [])
    // Extrair segmentos únicos
    const { data: allSegs } = await supabaseAdmin.from('segmento_portfolio').select('segmento')
    const uniq = [...new Set((allSegs ?? []).map((s: any) => s.segmento))].sort()
    setSegmentos(uniq as string[])
  }, [segFiltro])

  const carregarNormas = useCallback(async () => {
    const { data } = await supabaseAdmin.from('portfolio_normas').select('*').order('norma')
    setNormas(data ?? [])
  }, [])

  useEffect(() => {
    if (aba === 'produtos') carregarProdutos()
    if (aba === 'segmentos') { carregarProdutos(); carregarMapeamentos() }
    if (aba === 'normas') carregarNormas()
  }, [aba, carregarProdutos, carregarMapeamentos, carregarNormas])

  // ── Produto CRUD ──
  async function salvarProduto() {
    if (!prodEdit.nome?.trim()) { showMsg('erro', 'Nome obrigatório'); return }
    if (prodEdit.id) {
      await supabaseAdmin.from('portfolio_produtos').update({
        nome: prodEdit.nome, descricao: prodEdit.descricao || null, categoria: prodEdit.categoria || 'fabricacao', ativo: prodEdit.ativo ?? true
      }).eq('id', prodEdit.id)
      showMsg('ok', 'Produto atualizado')
    } else {
      await supabaseAdmin.from('portfolio_produtos').insert({
        nome: prodEdit.nome, descricao: prodEdit.descricao || null, categoria: prodEdit.categoria || 'fabricacao'
      })
      showMsg('ok', 'Produto criado')
    }
    setProdVista('lista')
    setProdEdit({})
    carregarProdutos()
  }

  async function excluirProduto(id: number) {
    if (!confirm('Excluir produto? Será removido de todos os segmentos.')) return
    await supabaseAdmin.from('portfolio_produtos').delete().eq('id', id)
    showMsg('ok', 'Produto excluído')
    carregarProdutos()
  }

  // ── Mapeamento CRUD ──
  async function adicionarMapeamento() {
    if (!segAddSegmento || !segAddProduto) { showMsg('erro', 'Selecione segmento e produto'); return }
    const { error } = await supabaseAdmin.from('segmento_portfolio').insert({
      segmento: segAddSegmento, produto_id: segAddProduto, relevancia: 5
    })
    if (error) { showMsg('erro', error.message.includes('unique') ? 'Já vinculado' : error.message); return }
    showMsg('ok', 'Vinculado')
    setSegAddOpen(false)
    carregarMapeamentos()
  }

  async function removerMapeamento(id: number) {
    await supabaseAdmin.from('segmento_portfolio').delete().eq('id', id)
    showMsg('ok', 'Removido')
    carregarMapeamentos()
  }

  async function toggleDestaque(m: Mapeamento) {
    await supabaseAdmin.from('segmento_portfolio').update({ destaque: !m.destaque }).eq('id', m.id)
    carregarMapeamentos()
  }

  // ── Norma expand ──
  async function expandirNorma(id: number) {
    if (normaExpandida === id) { setNormaExpandida(null); return }
    setNormaExpandida(id)
    if (!normaExigencias[id]) {
      const { data } = await supabaseAdmin
        .from('portfolio_norma_exigencias')
        .select('id, norma_id, artigo, texto_resumido, produto_id, portfolio_produtos(nome)')
        .eq('norma_id', id)
      setNormaExigencias(prev => ({ ...prev, [id]: (data as any) ?? [] }))
    }
  }

  const prodsFiltrados = produtos.filter(p =>
    !prodBusca || p.nome.toLowerCase().includes(prodBusca.toLowerCase()) || (p.descricao || '').toLowerCase().includes(prodBusca.toLowerCase())
  )

  const normasFiltradas = normas.filter(n =>
    !normaBusca || n.norma.toLowerCase().includes(normaBusca.toLowerCase()) || (n.titulo || '').toLowerCase().includes(normaBusca.toLowerCase()) || n.orgao.toLowerCase().includes(normaBusca.toLowerCase())
  )

  const statusCor = (s: string) => {
    if (s === 'vigente') return { bg: '#dcfce7', color: '#15803d' }
    if (s === 'em revisão' || s === 'atualizada' || s === 'atualizado') return { bg: '#fef3c7', color: '#92400e' }
    if (s.includes('revogada') || s.includes('substituída')) return { bg: '#fee2e2', color: '#dc2626' }
    return { bg: '#f1f5f9', color: '#64748b' }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.titulo}>🏭 Portfólio & Normas</h1>
        <p className={styles.subtitulo}>Produtos inox por segmento + normas regulatórias para argumentação comercial</p>
      </div>

      {msg && <div className={msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}>{msg.texto}</div>}

      {/* Abas */}
      <div className={styles.abas}>
        {([['produtos', '📦 Produtos (' + produtos.length + ')'], ['segmentos', '🎯 Segmentos (' + segmentos.length + ')'], ['normas', '⚖️ Normas (' + normas.length + ')']] as [Aba, string][]).map(([k, label]) => (
          <button key={k} className={`${styles.aba} ${aba === k ? styles.abaAtiva : ''}`} onClick={() => setAba(k)}>{label}</button>
        ))}
      </div>

      {/* ══════ ABA PRODUTOS ══════ */}
      {aba === 'produtos' && (
        <div className={styles.card}>
          {prodVista === 'lista' ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className={styles.inputBusca} placeholder="Buscar produto..." value={prodBusca} onChange={e => setProdBusca(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                <button className={styles.btnPrimary} onClick={() => { setProdEdit({}); setProdVista('form') }}>+ Novo Produto</button>
              </div>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Ativo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {prodsFiltrados.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nome}</td>
                      <td style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao || '—'}</td>
                      <td><span style={{ background: p.categoria === 'fixadores' ? '#dbeafe' : '#f0fdf4', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{p.categoria}</span></td>
                      <td>{p.ativo ? '✅' : '❌'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className={styles.btnSmall} onClick={() => { setProdEdit(p); setProdVista('form') }}>✏️</button>
                          <button className={styles.btnSmallDanger} onClick={() => excluirProduto(p.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <h3>{prodEdit.id ? 'Editar Produto' : 'Novo Produto'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.campo}>
                  <label>Nome *</label>
                  <input value={prodEdit.nome || ''} onChange={e => setProdEdit({ ...prodEdit, nome: e.target.value })} />
                </div>
                <div className={styles.campo}>
                  <label>Categoria</label>
                  <select value={prodEdit.categoria || 'fabricacao'} onChange={e => setProdEdit({ ...prodEdit, categoria: e.target.value })}>
                    <option value="fabricacao">Fabricação</option>
                    <option value="fixadores">Fixadores</option>
                    <option value="acessorios">Acessórios</option>
                  </select>
                </div>
                <div className={styles.campo} style={{ gridColumn: '1 / -1' }}>
                  <label>Descrição</label>
                  <textarea value={prodEdit.descricao || ''} onChange={e => setProdEdit({ ...prodEdit, descricao: e.target.value })} rows={3} />
                </div>
                {prodEdit.id && (
                  <div className={styles.campo}>
                    <label>
                      <input type="checkbox" checked={prodEdit.ativo ?? true} onChange={e => setProdEdit({ ...prodEdit, ativo: e.target.checked })} /> Ativo
                    </label>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className={styles.btnPrimary} onClick={salvarProduto}>Salvar</button>
                <button className={styles.btnSecondary} onClick={() => { setProdVista('lista'); setProdEdit({}) }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ ABA SEGMENTOS ══════ */}
      {aba === 'segmentos' && (
        <div className={styles.card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className={styles.inputBusca} value={segFiltro} onChange={e => setSegFiltro(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">Todos os segmentos ({segmentos.length})</option>
              {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className={styles.btnPrimary} onClick={() => setSegAddOpen(true)}>+ Vincular Produto</button>
          </div>

          {segAddOpen && (
            <div style={{ padding: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <div className={styles.campo}>
                <label>Segmento</label>
                <input list="seg-list" value={segAddSegmento} onChange={e => setSegAddSegmento(e.target.value)} placeholder="Ex: Pizzaria" />
                <datalist id="seg-list">{segmentos.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div className={styles.campo}>
                <label>Produto</label>
                <select value={segAddProduto ?? ''} onChange={e => setSegAddProduto(Number(e.target.value) || null)}>
                  <option value="">Selecione...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <button className={styles.btnPrimary} onClick={adicionarMapeamento}>Salvar</button>
              <button className={styles.btnSecondary} onClick={() => setSegAddOpen(false)}>Cancelar</button>
            </div>
          )}

          {segFiltro ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <h3 style={{ fontSize: '1rem', color: '#1e40af' }}>{segFiltro} — {mapeamentos.length} produtos</h3>
              {mapeamentos.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <button onClick={() => toggleDestaque(m)} title="Destaque" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>{m.destaque ? '⭐' : '☆'}</button>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem' }}>{m.portfolio_produtos?.nome || '?'}</strong>
                    {m.portfolio_produtos?.descricao && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{m.portfolio_produtos.descricao}</span>}
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2563eb' }}>Rel: {m.relevancia}</span>
                  <button className={styles.btnSmallDanger} onClick={() => removerMapeamento(m.id)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <table className={styles.tabela}>
              <thead>
                <tr><th>Segmento</th><th>Produtos vinculados</th></tr>
              </thead>
              <tbody>
                {segmentos.map(s => {
                  const count = mapeamentos.filter(m => m.segmento === s).length || '—'
                  return (
                    <tr key={s} onClick={() => setSegFiltro(s)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>{s}</td>
                      <td>{count}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════ ABA NORMAS ══════ */}
      {aba === 'normas' && (
        <div className={styles.card}>
          <input className={styles.inputBusca} placeholder="Buscar norma..." value={normaBusca} onChange={e => setNormaBusca(e.target.value)} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {normasFiltradas.map(n => {
              const sc = statusCor(n.status)
              return (
                <div key={n.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => expandirNorma(n.id)} style={{ width: '100%', padding: '12px 16px', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                    <span style={{ fontSize: '0.85rem' }}>{normaExpandida === n.id ? '▼' : '▶'}</span>
                    <span style={{ background: '#1e40af', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{n.orgao}</span>
                    <strong style={{ fontSize: '0.9rem', flex: 1 }}>{n.norma}</strong>
                    <span style={{ background: sc.bg, color: sc.color, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{n.status}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{(n.segmentos || []).length} seg.</span>
                  </button>
                  {normaExpandida === n.id && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                      {n.titulo && <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 8px' }}>{n.titulo}</p>}
                      {n.substituida_por && <p style={{ fontSize: '0.78rem', color: '#d97706', margin: '0 0 4px' }}>→ Substituída por: {n.substituida_por}</p>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0 8px' }}>
                        {(n.segmentos || []).map((s: string) => (
                          <span key={s} style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4 }}>{s}</span>
                        ))}
                      </div>
                      {n.penalidade && <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '4px 0' }}>⚠️ {n.penalidade}</p>}
                      {n.observacao && <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0', lineHeight: 1.4 }}>{n.observacao}</p>}

                      {/* Exigências */}
                      {normaExigencias[n.id] && normaExigencias[n.id].length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong style={{ fontSize: '0.78rem' }}>Exigências ({normaExigencias[n.id].length}):</strong>
                          {normaExigencias[n.id].map(ex => (
                            <div key={ex.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                              {ex.artigo && <span style={{ fontWeight: 600, color: '#1e40af' }}>{ex.artigo}: </span>}
                              <span style={{ color: '#334155' }}>{ex.texto_resumido}</span>
                              {ex.portfolio_produtos && <span style={{ color: '#16a34a', fontWeight: 600 }}> → {ex.portfolio_produtos.nome}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
