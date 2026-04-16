import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminFinanceiro.module.css'

type Secao = 'categorias' | 'centros' | 'contas' | 'negocios' | 'formas'

interface Categoria    { id: number; nome: string; tipo: 'receita'|'despesa'; grupo: string; cor: string; parent_id: number|null; ativo: boolean }
interface CentroCusto  { id: number; nome: string; descricao: string|null; ativo: boolean }
interface ContaBancaria{ id: number; nome: string; banco: string|null; tipo: string; negocio: string; saldo_inicial: number; ativo: boolean }
interface Negocio      { id: number; nome: string; descricao: string|null; ativo: boolean }
interface FormaPgto    { id: number; nome: string; tipo: string; bandeira: string|null; modalidade: string|null; ativo: boolean }

const BANDEIRAS   = ['Visa','Mastercard','Elo','Hipercard','American Express','Cabal','Hiper']
const MODALIDADES = ['credito','debito','voucher']
const TIPOS_CONTA = ['corrente','poupanca','carteira','cartao_credito','cartao_debito']
const TIPOS_PGTO  = ['dinheiro','pix','boleto','transferencia','cartao','cheque','outro']

const LABEL_CONTA: Record<string, string> = {
  corrente:'Corrente', poupanca:'Poupança', carteira:'Carteira',
  cartao_credito:'Cartão Crédito', cartao_debito:'Cartão Débito',
}
const LABEL_PGTO: Record<string, string> = {
  dinheiro:'Dinheiro', pix:'PIX', boleto:'Boleto',
  transferencia:'Transferência', cartao:'Cartão', cheque:'Cheque', outro:'Outro',
}

const SECOES = [
  { key: 'categorias', label: '📂 Categorias'       },
  { key: 'centros',    label: '📍 Centros de Custo'  },
  { key: 'contas',     label: '🏦 Contas & Cartões'  },
  { key: 'negocios',   label: '🏢 Negócios'          },
  { key: 'formas',     label: '💳 Formas de Pgto'    },
] as const

export default function AdminConfiguracaoFinanceiro() {
  const [secao, setSecao] = useState<Secao>('categorias')

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [centros,    setCentros]    = useState<CentroCusto[]>([])
  const [contas,     setContas]     = useState<ContaBancaria[]>([])
  const [negocios,   setNegocios]   = useState<Negocio[]>([])
  const [formas,     setFormas]     = useState<FormaPgto[]>([])

  const [loading,  setLoading]  = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok'|'erro'; texto: string }|null>(null)

  // forms
  const [formCat,    setFormCat]    = useState({ nome: '', tipo: 'receita' as 'receita'|'despesa', grupo: '', cor: '#16a34a', parent_id: '' })
  const [formCentro, setFormCentro] = useState({ nome: '', descricao: '' })
  const [formConta,  setFormConta]  = useState({ nome: '', banco: '', tipo: 'corrente', negocio: '', saldo_inicial: '0' })
  const [formNeg,    setFormNeg]    = useState({ nome: '', descricao: '' })
  const [formForma,  setFormForma]  = useState({ nome: '', tipo: 'pix', bandeira: '', modalidade: '' })

  // editing
  const [editCat,    setEditCat]    = useState<Categoria|null>(null)
  const [editCentro, setEditCentro] = useState<CentroCusto|null>(null)
  const [editConta,  setEditConta]  = useState<ContaBancaria|null>(null)
  const [editNeg,    setEditNeg]    = useState<Negocio|null>(null)
  const [editForma,  setEditForma]  = useState<FormaPgto|null>(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: cts }, { data: cnts }, { data: negs }, { data: fms }] = await Promise.all([
      supabaseAdmin.from('fin_categorias').select('*').eq('ativo', true).order('tipo').order('grupo').order('nome'),
      supabaseAdmin.from('fin_centros_custo').select('*').eq('ativo', true).order('nome'),
      supabaseAdmin.from('fin_contas').select('*').eq('ativo', true).order('nome'),
      supabaseAdmin.from('fin_negocios').select('*').eq('ativo', true).order('nome'),
      supabaseAdmin.from('fin_formas_pagamento').select('*').eq('ativo', true).order('tipo').order('nome'),
    ])
    setCategorias(cats ?? [])
    setCentros(cts ?? [])
    setContas(cnts ?? [])
    setNegocios(negs ?? [])
    setFormas(fms ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const ok  = (texto: string)                  => setMsg({ tipo: 'ok',   texto })
  const err = (e: { message: string }) => setMsg({ tipo: 'erro', texto: e.message })

  // ── Categorias ────────────────────────────────────────────────────────────────
  async function salvarCategoria(e: React.FormEvent) {
    e.preventDefault()
    if (!formCat.nome.trim()) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_categorias').insert({
      nome: formCat.nome.trim(), tipo: formCat.tipo,
      grupo: formCat.grupo.trim() || null, cor: formCat.cor,
      parent_id: formCat.parent_id ? Number(formCat.parent_id) : null,
    })
    if (!error) {
      ok('Categoria criada.')
      setFormCat({ nome: '', tipo: 'receita', grupo: '', cor: '#16a34a', parent_id: '' })
      carregar()
    } else err(error)
    setSalvando(false)
  }

  async function editarCategoria(e: React.FormEvent) {
    e.preventDefault()
    if (!editCat) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_categorias').update({
      nome: editCat.nome, tipo: editCat.tipo,
      grupo: editCat.grupo, cor: editCat.cor, parent_id: editCat.parent_id,
    }).eq('id', editCat.id)
    if (!error) { ok('Categoria salva.'); setEditCat(null); carregar() } else err(error)
    setSalvando(false)
  }

  async function desativarCategoria(id: number) {
    await supabaseAdmin.from('fin_categorias').update({ ativo: false }).eq('id', id)
    carregar()
  }

  // ── Centros de custo ─────────────────────────────────────────────────────────
  async function salvarCentro(e: React.FormEvent) {
    e.preventDefault()
    if (!formCentro.nome.trim()) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_centros_custo').insert({
      nome: formCentro.nome.trim(), descricao: formCentro.descricao.trim() || null,
    })
    if (!error) { ok('Centro criado.'); setFormCentro({ nome: '', descricao: '' }); carregar() } else err(error)
    setSalvando(false)
  }

  async function editarCentro(e: React.FormEvent) {
    e.preventDefault()
    if (!editCentro) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_centros_custo').update({
      nome: editCentro.nome, descricao: editCentro.descricao,
    }).eq('id', editCentro.id)
    if (!error) { ok('Centro salvo.'); setEditCentro(null); carregar() } else err(error)
    setSalvando(false)
  }

  // ── Contas ───────────────────────────────────────────────────────────────────
  async function salvarConta(e: React.FormEvent) {
    e.preventDefault()
    if (!formConta.nome.trim()) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_contas').insert({
      nome: formConta.nome.trim(), banco: formConta.banco.trim() || null,
      tipo: formConta.tipo, negocio: formConta.negocio || null,
      saldo_inicial: parseFloat(formConta.saldo_inicial) || 0,
    })
    if (!error) {
      ok('Conta criada.')
      setFormConta({ nome: '', banco: '', tipo: 'corrente', negocio: '', saldo_inicial: '0' })
      carregar()
    } else err(error)
    setSalvando(false)
  }

  async function editarConta(e: React.FormEvent) {
    e.preventDefault()
    if (!editConta) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_contas').update({
      nome: editConta.nome, banco: editConta.banco, tipo: editConta.tipo,
      negocio: editConta.negocio, saldo_inicial: editConta.saldo_inicial,
    }).eq('id', editConta.id)
    if (!error) { ok('Conta salva.'); setEditConta(null); carregar() } else err(error)
    setSalvando(false)
  }

  async function desativarConta(id: number) {
    await supabaseAdmin.from('fin_contas').update({ ativo: false }).eq('id', id)
    carregar()
  }

  // ── Negócios ─────────────────────────────────────────────────────────────────
  async function salvarNegocio(e: React.FormEvent) {
    e.preventDefault()
    if (!formNeg.nome.trim()) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_negocios').insert({
      nome: formNeg.nome.trim(), descricao: formNeg.descricao.trim() || null,
    })
    if (!error) { ok('Negócio criado.'); setFormNeg({ nome: '', descricao: '' }); carregar() } else err(error)
    setSalvando(false)
  }

  async function editarNegocio(e: React.FormEvent) {
    e.preventDefault()
    if (!editNeg) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_negocios').update({
      nome: editNeg.nome, descricao: editNeg.descricao,
    }).eq('id', editNeg.id)
    if (!error) { ok('Negócio salvo.'); setEditNeg(null); carregar() } else err(error)
    setSalvando(false)
  }

  // ── Formas de pagamento ───────────────────────────────────────────────────────
  async function salvarForma(e: React.FormEvent) {
    e.preventDefault()
    if (!formForma.nome.trim()) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_formas_pagamento').insert({
      nome: formForma.nome.trim(), tipo: formForma.tipo,
      bandeira: formForma.bandeira || null,
      modalidade: formForma.modalidade || null,
    })
    if (!error) {
      ok('Forma criada.')
      setFormForma({ nome: '', tipo: 'pix', bandeira: '', modalidade: '' })
      carregar()
    } else err(error)
    setSalvando(false)
  }

  async function editarForma(e: React.FormEvent) {
    e.preventDefault()
    if (!editForma) return
    setSalvando(true)
    const { error } = await supabaseAdmin.from('fin_formas_pagamento').update({
      nome: editForma.nome, tipo: editForma.tipo,
      bandeira: editForma.bandeira, modalidade: editForma.modalidade,
    }).eq('id', editForma.id)
    if (!error) { ok('Forma salva.'); setEditForma(null); carregar() } else err(error)
    setSalvando(false)
  }

  // helpers
  const catsPai    = categorias.filter(c => !c.parent_id)
  const subsDe     = (id: number) => categorias.filter(c => c.parent_id === id)
  const catsPorTipo = (tipo: 'receita'|'despesa') => catsPai.filter(c => c.tipo === tipo)

  if (loading) return <div className={styles.loading}>Carregando...</div>

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <a href="/admin/financeiro" className={styles.btnLinkSmall} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Financeiro
        </a>
        <span style={{ color: '#e2e8f0' }}>|</span>
        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Configuração Financeira</span>
      </div>

      {msg && <div className={msg.tipo === 'ok' ? styles.msgOk : styles.msgErro}>{msg.texto}</div>}

      <div className={styles.abas}>
        {SECOES.map(s => (
          <button key={s.key} onClick={() => setSecao(s.key as Secao)}
            className={`${styles.aba} ${secao === s.key ? styles.abaAtiva : ''}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Categorias ── */}
      {secao === 'categorias' && (
        <div className={styles.configWrap}>
          <div>
            <div className={styles.configSecao}>Nova categoria</div>
            <form className={styles.formSmall} onSubmit={salvarCategoria}>
              <div className={styles.row3}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input className={styles.input} value={formCat.nome}
                    onChange={e => setFormCat(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Comissão de vendas" required />
                </div>
                <div className={styles.field}>
                  <label>Tipo</label>
                  <select className={styles.input} value={formCat.tipo}
                    onChange={e => setFormCat(f => ({ ...f, tipo: e.target.value as 'receita'|'despesa' }))}>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Grupo</label>
                  <input className={styles.input} value={formCat.grupo}
                    onChange={e => setFormCat(f => ({ ...f, grupo: e.target.value }))}
                    placeholder="Ex: Operacional" />
                </div>
              </div>
              <div className={styles.field}>
                <label>Subcategoria de (opcional)</label>
                <select className={styles.input} value={formCat.parent_id}
                  onChange={e => setFormCat(f => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">— Categoria principal —</option>
                  {catsPai.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
                </select>
              </div>
              <div className={styles.formActions}>
                <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.81rem', fontWeight: 600 }}>Cor</span>
                  <input type="color" className={styles.inputColor} value={formCat.cor}
                    onChange={e => setFormCat(f => ({ ...f, cor: e.target.value }))} />
                </label>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>Criar categoria</button>
              </div>
            </form>
          </div>

          <div>
            <div className={styles.configSecao}>Categorias cadastradas</div>
            <div className={styles.listaConfig}>
              {(['receita','despesa'] as const).map(tipo => (
                <div key={tipo}>
                  <div className={styles.grupoTitulo}>{tipo === 'receita' ? '↑ Receitas' : '↓ Despesas'}</div>
                  <div className={styles.catGrid}>
                    {catsPorTipo(tipo).map(c => (
                      <div key={c.id}>
                        {editCat?.id === c.id ? (
                          <form className={styles.editRow} onSubmit={editarCategoria}>
                            <input className={styles.input} style={{ flex: 2 }} value={editCat.nome}
                              onChange={e => setEditCat(v => v && ({ ...v, nome: e.target.value }))} />
                            <input className={styles.input} style={{ flex: 1 }} value={editCat.grupo ?? ''}
                              onChange={e => setEditCat(v => v && ({ ...v, grupo: e.target.value }))} placeholder="Grupo" />
                            <input type="color" className={styles.inputColor} value={editCat.cor}
                              onChange={e => setEditCat(v => v && ({ ...v, cor: e.target.value }))} />
                            <button type="submit" className={styles.btnPrimary}
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={salvando}>✓</button>
                            <button type="button" className={styles.btnSecondary}
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditCat(null)}>✕</button>
                          </form>
                        ) : (
                          <div className={styles.catItem} style={{ borderLeftColor: c.cor }}>
                            <span className={styles.catNome}>{c.nome}</span>
                            {c.grupo && <span className={styles.catGrupo}>{c.grupo}</span>}
                            <button className={styles.btnIcone} title="Editar" onClick={() => setEditCat(c)}>✏️</button>
                            <button className={styles.btnIcone} title="Remover" onClick={() => desativarCategoria(c.id)}>🗑</button>
                          </div>
                        )}
                        {subsDe(c.id).map(sub => (
                          editCat?.id === sub.id ? (
                            <form key={sub.id} className={styles.editRow} onSubmit={editarCategoria} style={{ marginLeft: 16, marginTop: 2 }}>
                              <input className={styles.input} style={{ flex: 2 }} value={editCat.nome}
                                onChange={e => setEditCat(v => v && ({ ...v, nome: e.target.value }))} />
                              <input className={styles.input} style={{ flex: 1 }} value={editCat.grupo ?? ''}
                                onChange={e => setEditCat(v => v && ({ ...v, grupo: e.target.value }))} placeholder="Grupo" />
                              <input type="color" className={styles.inputColor} value={editCat.cor}
                                onChange={e => setEditCat(v => v && ({ ...v, cor: e.target.value }))} />
                              <button type="submit" className={styles.btnPrimary}
                                style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={salvando}>✓</button>
                              <button type="button" className={styles.btnSecondary}
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditCat(null)}>✕</button>
                            </form>
                          ) : (
                            <div key={sub.id} className={styles.catItem}
                              style={{ borderLeftColor: sub.cor, marginLeft: 20, marginTop: 3 }}>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: 4 }}>↳</span>
                              <span className={styles.catNome}>{sub.nome}</span>
                              {sub.grupo && <span className={styles.catGrupo}>{sub.grupo}</span>}
                              <button className={styles.btnIcone} title="Editar" onClick={() => setEditCat(sub)}>✏️</button>
                              <button className={styles.btnIcone} title="Remover" onClick={() => desativarCategoria(sub.id)}>🗑</button>
                            </div>
                          )
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Centros de Custo ── */}
      {secao === 'centros' && (
        <div className={styles.configWrap}>
          <div>
            <div className={styles.configSecao}>Novo centro de custo</div>
            <form className={styles.formSmall} onSubmit={salvarCentro}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input className={styles.input} value={formCentro.nome}
                    onChange={e => setFormCentro(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Exportação" required />
                </div>
                <div className={styles.field}>
                  <label>Descrição</label>
                  <input className={styles.input} value={formCentro.descricao}
                    onChange={e => setFormCentro(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Opcional" />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>Criar centro</button>
              </div>
            </form>
          </div>
          <div>
            <div className={styles.configSecao}>Centros cadastrados</div>
            <div className={styles.catGrid} style={{ marginTop: 8 }}>
              {centros.map(c => editCentro?.id === c.id ? (
                <form key={c.id} className={styles.editRow} onSubmit={editarCentro}>
                  <input className={styles.input} style={{ flex: 2 }} value={editCentro.nome}
                    onChange={e => setEditCentro(v => v && ({ ...v, nome: e.target.value }))} />
                  <input className={styles.input} style={{ flex: 3 }} value={editCentro.descricao ?? ''}
                    onChange={e => setEditCentro(v => v && ({ ...v, descricao: e.target.value }))} placeholder="Descrição" />
                  <button type="submit" className={styles.btnPrimary}
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={salvando}>✓</button>
                  <button type="button" className={styles.btnSecondary}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditCentro(null)}>✕</button>
                </form>
              ) : (
                <div key={c.id} className={styles.catItem} style={{ borderLeftColor: 'var(--color-primary)' }}>
                  <span className={styles.catNome}>{c.nome}</span>
                  {c.descricao && <span className={styles.catGrupo}>{c.descricao}</span>}
                  <button className={styles.btnIcone} title="Editar" onClick={() => setEditCentro(c)}>✏️</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Contas & Cartões ── */}
      {secao === 'contas' && (
        <div className={styles.configWrap}>
          <div>
            <div className={styles.configSecao}>Nova conta / cartão</div>
            <form className={styles.formSmall} onSubmit={salvarConta}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input className={styles.input} value={formConta.nome}
                    onChange={e => setFormConta(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Bradesco PJ — Pousinox" required />
                </div>
                <div className={styles.field}>
                  <label>Banco / Bandeira</label>
                  <input className={styles.input} value={formConta.banco}
                    onChange={e => setFormConta(f => ({ ...f, banco: e.target.value }))}
                    placeholder="Ex: Bradesco, Visa, Mastercard" />
                </div>
              </div>
              <div className={styles.row3}>
                <div className={styles.field}>
                  <label>Tipo</label>
                  <select className={styles.input} value={formConta.tipo}
                    onChange={e => setFormConta(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS_CONTA.map(t => <option key={t} value={t}>{LABEL_CONTA[t] ?? t}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Negócio</label>
                  <select className={styles.input} value={formConta.negocio}
                    onChange={e => setFormConta(f => ({ ...f, negocio: e.target.value }))}>
                    <option value="">—</option>
                    {negocios.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Saldo inicial (R$)</label>
                  <input className={styles.input} type="number" step="0.01" value={formConta.saldo_inicial}
                    onChange={e => setFormConta(f => ({ ...f, saldo_inicial: e.target.value }))} />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>Criar conta</button>
              </div>
            </form>
          </div>
          <div>
            <div className={styles.configSecao}>Contas cadastradas</div>
            <div className={styles.catGrid} style={{ marginTop: 8 }}>
              {contas.map(c => editConta?.id === c.id ? (
                <form key={c.id} className={styles.editRow} onSubmit={editarConta} style={{ flexWrap: 'wrap' }}>
                  <input className={styles.input} style={{ flex: '2 1 140px' }} value={editConta.nome}
                    onChange={e => setEditConta(v => v && ({ ...v, nome: e.target.value }))} />
                  <input className={styles.input} style={{ flex: '1 1 100px' }} value={editConta.banco ?? ''}
                    onChange={e => setEditConta(v => v && ({ ...v, banco: e.target.value }))} placeholder="Banco" />
                  <select className={styles.input} style={{ flex: '1 1 120px' }} value={editConta.tipo}
                    onChange={e => setEditConta(v => v && ({ ...v, tipo: e.target.value }))}>
                    {TIPOS_CONTA.map(t => <option key={t} value={t}>{LABEL_CONTA[t] ?? t}</option>)}
                  </select>
                  <button type="submit" className={styles.btnPrimary}
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={salvando}>✓</button>
                  <button type="button" className={styles.btnSecondary}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditConta(null)}>✕</button>
                </form>
              ) : (
                <div key={c.id} className={styles.catItem} style={{ borderLeftColor: 'var(--color-primary)' }}>
                  <span className={styles.catNome}>{c.nome}</span>
                  <span className={styles.catGrupo}>{LABEL_CONTA[c.tipo] ?? c.tipo}</span>
                  {c.banco && <span className={styles.catGrupo}>{c.banco}</span>}
                  {c.negocio && <span className={styles.catGrupo} style={{ fontStyle: 'italic' }}>{c.negocio}</span>}
                  <button className={styles.btnIcone} title="Editar" onClick={() => setEditConta(c)}>✏️</button>
                  <button className={styles.btnIcone} title="Desativar" onClick={() => desativarConta(c.id)}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Negócios ── */}
      {secao === 'negocios' && (
        <div className={styles.configWrap}>
          <div>
            <div className={styles.configSecao}>Novo negócio</div>
            <form className={styles.formSmall} onSubmit={salvarNegocio}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Nome / Código *</label>
                  <input className={styles.input} value={formNeg.nome}
                    onChange={e => setFormNeg(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: pousinox" required />
                </div>
                <div className={styles.field}>
                  <label>Descrição</label>
                  <input className={styles.input} value={formNeg.descricao}
                    onChange={e => setFormNeg(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Opcional" />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>Criar negócio</button>
              </div>
            </form>
          </div>
          <div>
            <div className={styles.configSecao}>Negócios cadastrados</div>
            <div className={styles.catGrid} style={{ marginTop: 8 }}>
              {negocios.map(n => editNeg?.id === n.id ? (
                <form key={n.id} className={styles.editRow} onSubmit={editarNegocio}>
                  <input className={styles.input} style={{ flex: 1 }} value={editNeg.nome}
                    onChange={e => setEditNeg(v => v && ({ ...v, nome: e.target.value }))} />
                  <input className={styles.input} style={{ flex: 2 }} value={editNeg.descricao ?? ''}
                    onChange={e => setEditNeg(v => v && ({ ...v, descricao: e.target.value }))} placeholder="Descrição" />
                  <button type="submit" className={styles.btnPrimary}
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={salvando}>✓</button>
                  <button type="button" className={styles.btnSecondary}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditNeg(null)}>✕</button>
                </form>
              ) : (
                <div key={n.id} className={styles.catItem} style={{ borderLeftColor: 'var(--color-primary)' }}>
                  <span className={styles.catNome}>{n.nome}</span>
                  {n.descricao && <span className={styles.catGrupo}>{n.descricao}</span>}
                  <button className={styles.btnIcone} title="Editar" onClick={() => setEditNeg(n)}>✏️</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Formas de Pagamento ── */}
      {secao === 'formas' && (
        <div className={styles.configWrap}>
          <div>
            <div className={styles.configSecao}>Nova forma de pagamento</div>
            <form className={styles.formSmall} onSubmit={salvarForma}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>Nome *</label>
                  <input className={styles.input} value={formForma.nome}
                    onChange={e => setFormForma(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Visa Crédito" required />
                </div>
                <div className={styles.field}>
                  <label>Tipo</label>
                  <select className={styles.input} value={formForma.tipo}
                    onChange={e => setFormForma(f => ({
                      ...f, tipo: e.target.value,
                      bandeira: e.target.value !== 'cartao' ? '' : f.bandeira,
                      modalidade: e.target.value !== 'cartao' ? '' : f.modalidade,
                    }))}>
                    {TIPOS_PGTO.map(t => <option key={t} value={t}>{LABEL_PGTO[t] ?? t}</option>)}
                  </select>
                </div>
              </div>
              {formForma.tipo === 'cartao' && (
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label>Bandeira</label>
                    <select className={styles.input} value={formForma.bandeira}
                      onChange={e => setFormForma(f => ({ ...f, bandeira: e.target.value }))}>
                      <option value="">—</option>
                      {BANDEIRAS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Modalidade</label>
                    <select className={styles.input} value={formForma.modalidade}
                      onChange={e => setFormForma(f => ({ ...f, modalidade: e.target.value }))}>
                      <option value="">—</option>
                      {MODALIDADES.map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={salvando}>Criar forma</button>
              </div>
            </form>
          </div>
          <div>
            <div className={styles.configSecao}>Formas cadastradas</div>
            <div className={styles.catGrid} style={{ marginTop: 8 }}>
              {formas.map(f => editForma?.id === f.id ? (
                <form key={f.id} className={styles.editRow} onSubmit={editarForma} style={{ flexWrap: 'wrap' }}>
                  <input className={styles.input} style={{ flex: '2 1 140px' }} value={editForma.nome}
                    onChange={e => setEditForma(v => v && ({ ...v, nome: e.target.value }))} />
                  <select className={styles.input} style={{ flex: '1 1 100px' }} value={editForma.tipo}
                    onChange={e => setEditForma(v => v && ({ ...v, tipo: e.target.value }))}>
                    {TIPOS_PGTO.map(t => <option key={t} value={t}>{LABEL_PGTO[t] ?? t}</option>)}
                  </select>
                  {editForma.tipo === 'cartao' && <>
                    <select className={styles.input} style={{ flex: '1 1 100px' }} value={editForma.bandeira ?? ''}
                      onChange={e => setEditForma(v => v && ({ ...v, bandeira: e.target.value }))}>
                      <option value="">—</option>
                      {BANDEIRAS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select className={styles.input} style={{ flex: '1 1 100px' }} value={editForma.modalidade ?? ''}
                      onChange={e => setEditForma(v => v && ({ ...v, modalidade: e.target.value }))}>
                      <option value="">—</option>
                      {MODALIDADES.map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </>}
                  <button type="submit" className={styles.btnPrimary}
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }} disabled={salvando}>✓</button>
                  <button type="button" className={styles.btnSecondary}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditForma(null)}>✕</button>
                </form>
              ) : (
                <div key={f.id} className={styles.catItem}
                  style={{ borderLeftColor: f.tipo === 'cartao' ? '#7c3aed' : 'var(--color-primary)' }}>
                  <span className={styles.catNome}>{f.nome}</span>
                  <span className={styles.catGrupo}>{LABEL_PGTO[f.tipo] ?? f.tipo}</span>
                  {f.bandeira   && <span className={styles.catGrupo}>{f.bandeira}</span>}
                  {f.modalidade && <span className={styles.catGrupo}>{f.modalidade}</span>}
                  <button className={styles.btnIcone} title="Editar" onClick={() => setEditForma(f)}>✏️</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
