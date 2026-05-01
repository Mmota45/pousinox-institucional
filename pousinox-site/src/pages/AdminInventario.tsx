import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminEstoqueIndustrial.module.css'
import AdminLoading from '../components/AdminLoading/AdminLoading'
import { useLoadingProgress } from '../hooks/useLoadingProgress'

// ── Types ─────────────────────────────────────────────────────────
type StatusInv = 'aberto' | 'em_contagem' | 'finalizado' | 'cancelado'
type TipoInv   = 'geral' | 'mp' | 'pa'
type Vista = 'lista' | 'detalhe'

interface Inventario {
  id: number
  numero: string
  data_inventario: string
  tipo_inventario: TipoInv
  responsavel: string
  status: StatusInv
  observacoes: string | null
  created_at: string
}

interface InvItem {
  id?: number
  inventario_id?: number
  item_id: number
  item_nome: string
  item_unidade: string
  saldo_sistema: number
  saldo_contado: number | null
  diferenca: number | null
  ajustado: boolean
  lote: string | null
  localizacao: string | null
  observacao: string | null
}

interface EstoqueItem { id: number; nome: string; tipo: string; unidade: string; saldo_atual: number; ativo: boolean }

// ── Helpers ───────────────────────────────────────────────────────
function fmtData(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function BadgeStatus({ status }: { status: StatusInv }) {
  const map: Record<StatusInv, string> = {
    aberto: styles.badgeAberto,
    em_contagem: styles.badgeEmContagem,
    finalizado: styles.badgeFinalizado,
    cancelado: styles.badgeCancelado,
  }
  const label: Record<StatusInv, string> = {
    aberto: 'Aberto', em_contagem: 'Em Contagem', finalizado: 'Finalizado', cancelado: 'Cancelado',
  }
  return <span className={map[status]}>{label[status]}</span>
}

// ── Component ─────────────────────────────────────────────────────
export default function AdminInventario() {
  const [vista, setVista] = useState<Vista>('lista')
  const [lista, setLista] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const lp = useLoadingProgress(1)
  const [detalhe, setDetalhe] = useState<Inventario | null>(null)
  const [invItens, setInvItens] = useState<InvItem[]>([])
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Form novo inventário
  const [showForm, setShowForm] = useState(false)
  const [fData, setFData] = useState('')
  const [fTipo, setFTipo] = useState<TipoInv>('geral')
  const [fResp, setFResp] = useState('')
  const [fObs, setFObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('estoque_inventario')
      .select('*')
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    lp.step()
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criarInventario() {
    if (!fResp.trim()) { setMsg({ tipo: 'erro', texto: 'Responsável obrigatório.' }); return }
    setSalvando(true)

    const { data: inv, error } = await supabaseAdmin
      .from('estoque_inventario')
      .insert({
        data_inventario: fData || new Date().toISOString().slice(0, 10),
        tipo_inventario: fTipo,
        responsavel: fResp.trim(),
        status: 'aberto',
        observacoes: fObs.trim() || null,
      })
      .select()
      .single()

    if (error || !inv) { setMsg({ tipo: 'erro', texto: error?.message ?? 'Erro.' }); setSalvando(false); return }

    await carregar()
    setSalvando(false)
    setShowForm(false)
    setFResp('')
    setFObs('')

    // Abrir direto no detalhe
    await abrirDetalhe(inv)
  }

  async function abrirDetalhe(inv: Inventario) {
    setDetalhe(inv)
    setMsg(null)

    // Carregar itens do inventário
    const { data: existentes } = await supabaseAdmin
      .from('estoque_inventario_itens')
      .select('*, estoque_itens(nome, unidade)')
      .eq('inventario_id', inv.id)

    if (existentes && existentes.length > 0) {
      setInvItens(existentes.map((e: any) => ({
        id: e.id,
        inventario_id: e.inventario_id,
        item_id: e.item_id,
        item_nome: e.estoque_itens?.nome ?? '',
        item_unidade: e.estoque_itens?.unidade ?? 'un',
        saldo_sistema: e.saldo_sistema,
        saldo_contado: e.saldo_contado,
        diferenca: e.diferenca,
        ajustado: e.ajustado,
        lote: e.lote,
        localizacao: e.localizacao,
        observacao: e.observacao,
      })))
    } else {
      setInvItens([])
    }

    setVista('detalhe')
  }

  async function iniciarContagem() {
    if (!detalhe) return
    setSalvando(true)

    // Snapshot do saldo atual de todos os itens do tipo do inventário
    let query = supabaseAdmin.from('estoque_itens').select('*').eq('ativo', true)
    if (detalhe.tipo_inventario !== 'geral') {
      query = query.eq('tipo', detalhe.tipo_inventario)
    }
    const { data: itens } = await query.order('nome')

    if (!itens || itens.length === 0) {
      setMsg({ tipo: 'erro', texto: 'Nenhum item de estoque encontrado para este tipo.' })
      setSalvando(false)
      return
    }

    // Inserir linhas de contagem com saldo_sistema = snapshot atual
    const linhas = itens.map((it: EstoqueItem) => ({
      inventario_id: detalhe.id,
      item_id: it.id,
      saldo_sistema: it.saldo_atual,
      saldo_contado: null,
      diferenca: null,
      ajustado: false,
    }))

    await supabaseAdmin.from('estoque_inventario_itens').delete().eq('inventario_id', detalhe.id)
    await supabaseAdmin.from('estoque_inventario_itens').insert(linhas)
    await supabaseAdmin.from('estoque_inventario').update({ status: 'em_contagem' }).eq('id', detalhe.id)

    const atualizado = { ...detalhe, status: 'em_contagem' as StatusInv }
    setDetalhe(atualizado)
    setLista(l => l.map(i => i.id === detalhe.id ? atualizado : i))

    // Recarregar itens
    const mapeados: InvItem[] = itens.map((it: EstoqueItem) => ({
      item_id: it.id,
      inventario_id: detalhe.id,
      item_nome: it.nome,
      item_unidade: it.unidade,
      saldo_sistema: it.saldo_atual,
      saldo_contado: null,
      diferenca: null,
      ajustado: false,
      lote: null,
      localizacao: null,
      observacao: null,
    }))
    setInvItens(mapeados)
    setSalvando(false)
  }

  function updateSaldoContado(idx: number, valor: string) {
    const contado = valor === '' ? null : parseFloat(valor)
    setInvItens(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const dif = contado !== null ? contado - it.saldo_sistema : null
      return { ...it, saldo_contado: contado, diferenca: dif }
    }))
  }

  async function salvarContagem() {
    if (!detalhe) return
    setSalvando(true)

    // Upsert de todos os itens com saldo_contado
    const { data: existentes } = await supabaseAdmin
      .from('estoque_inventario_itens')
      .select('id, item_id')
      .eq('inventario_id', detalhe.id)

    const idMap = new Map((existentes ?? []).map((e: any) => [e.item_id, e.id]))

    for (const it of invItens) {
      const existeId = idMap.get(it.item_id)
      const payload = {
        inventario_id: detalhe.id,
        item_id: it.item_id,
        saldo_sistema: it.saldo_sistema,
        saldo_contado: it.saldo_contado,
        diferenca: it.diferenca,
        ajustado: it.ajustado,
        lote: it.lote,
        localizacao: it.localizacao,
        observacao: it.observacao,
      }
      if (existeId) {
        await supabaseAdmin.from('estoque_inventario_itens').update(payload).eq('id', existeId)
      }
    }

    setSalvando(false)
    setMsg({ tipo: 'ok', texto: 'Contagem salva.' })
  }

  async function finalizarInventario() {
    if (!detalhe) return
    if (!confirm('Finalizar inventário? Isso gerará movimentações de ajuste para todos os itens com diferença.')) return
    setSalvando(true)

    // Gerar ajustes para itens com diferença e não ajustados
    const itensComDiff = invItens.filter(it => it.saldo_contado !== null && it.diferenca !== null && it.diferenca !== 0 && !it.ajustado)

    for (const it of itensComDiff) {
      const dif = it.diferenca!
      const tipoMov = dif > 0 ? 'ajuste_positivo' : 'ajuste_negativo'
      const qtd = Math.abs(dif)

      // Buscar saldo atual do item para calcular saldo_posterior
      const { data: itemAtual } = await supabaseAdmin.from('estoque_itens').select('saldo_atual, custo_medio').eq('id', it.item_id).single()
      const saldoAnt = itemAtual?.saldo_atual ?? it.saldo_sistema
      const saldoPost = it.saldo_contado!

      await supabaseAdmin.from('estoque_movimentacoes').insert({
        item_id: it.item_id,
        tipo_movimentacao: tipoMov,
        quantidade: qtd,
        custo_unitario: itemAtual?.custo_medio ?? 0,
        valor_total: qtd * (itemAtual?.custo_medio ?? 0),
        saldo_anterior: saldoAnt,
        saldo_posterior: saldoPost,
        origem_tipo: 'inventario',
        origem_id: detalhe.id,
        origem_label: detalhe.numero,
        responsavel: detalhe.responsavel,
        observacoes: `Ajuste de inventário ${detalhe.numero}`,
      })

      // Atualizar saldo_atual do item
      await supabaseAdmin.from('estoque_itens').update({ saldo_atual: saldoPost }).eq('id', it.item_id)

      // Marcar linha como ajustada
      const existeId = invItens.find(i => i.item_id === it.item_id)?.id
      if (existeId) {
        await supabaseAdmin.from('estoque_inventario_itens').update({ ajustado: true }).eq('id', existeId)
      }
    }

    // Marcar inventário como finalizado
    await supabaseAdmin.from('estoque_inventario').update({ status: 'finalizado' }).eq('id', detalhe.id)
    const atualizado = { ...detalhe, status: 'finalizado' as StatusInv }
    setDetalhe(atualizado)
    setLista(l => l.map(i => i.id === detalhe.id ? atualizado : i))
    setInvItens(prev => prev.map(it => ({ ...it, ajustado: it.diferenca !== 0 && it.diferenca !== null ? true : it.ajustado })))

    setSalvando(false)
    setMsg({ tipo: 'ok', texto: `Inventário finalizado. ${itensComDiff.length} ajuste(s) gerado(s).` })
  }

  // ── Render: Lista ──
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Inventário / Ajustes</h1>
          <p className={styles.pageSubtitle}>Contagem física e reconciliação de saldos do estoque industrial</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => { setShowForm(true); setFData(new Date().toISOString().slice(0, 10)); setMsg(null) }}>
          + Novo Inventário
        </button>
      </div>

      {/* Form novo inventário */}
      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitulo}>Novo Inventário</h2>
            <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Responsável *</label>
              <input className={styles.formInput} value={fResp} onChange={e => setFResp(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data</label>
              <input className={styles.formInput} type="date" value={fData} onChange={e => setFData(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Escopo</label>
              <select className={styles.formSelect} value={fTipo} onChange={e => setFTipo(e.target.value as TipoInv)}>
                <option value="geral">Geral (MP + PA)</option>
                <option value="mp">Somente Matéria-Prima</option>
                <option value="pa">Somente Produto Acabado</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Observações</label>
              <input className={styles.formInput} value={fObs} onChange={e => setFObs(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={criarInventario} disabled={salvando}>{salvando ? 'Criando…' : 'Criar e Abrir'}</button>
          </div>
        </div>
      )}

      <div className={styles.card}>
        {loading ? (
          <AdminLoading total={lp.total} current={lp.current} label="Carregando inventário..." />
        ) : lista.length === 0 ? (
          <div className={styles.vazio}>Nenhum inventário realizado.</div>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Número</th>
                <th>Data</th>
                <th>Escopo</th>
                <th>Responsável</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(inv => (
                <tr key={inv.id} onClick={() => abrirDetalhe(inv)}>
                  <td><span className={styles.codigo}>{inv.numero}</span></td>
                  <td><span className={styles.data}>{fmtData(inv.data_inventario)}</span></td>
                  <td>{inv.tipo_inventario === 'geral' ? 'Geral' : inv.tipo_inventario === 'mp' ? 'Matéria-Prima' : 'Produto Acabado'}</td>
                  <td><span className={styles.nome}>{inv.responsavel}</span></td>
                  <td><BadgeStatus status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // ── Render: Detalhe ──
  if (vista === 'detalhe' && detalhe) {
    const podeIniciar = detalhe.status === 'aberto'
    const podeContar  = detalhe.status === 'em_contagem'
    const podeFinalizar = detalhe.status === 'em_contagem' && invItens.some(it => it.saldo_contado !== null)
    const isFinalizado  = detalhe.status === 'finalizado' || detalhe.status === 'cancelado'

    const totalItens = invItens.length
    const contados = invItens.filter(it => it.saldo_contado !== null).length
    const comDiff = invItens.filter(it => it.diferenca !== null && it.diferenca !== 0).length

    return (
      <div className={styles.wrap}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.detalheNumero}>{detalhe.numero}</div>
            <h1 className={styles.pageTitle}>Inventário — {fmtData(detalhe.data_inventario)}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecondary} onClick={() => setVista('lista')}>← Voltar</button>
          </div>
        </div>

        <div className={styles.detalheCard}>
          <div className={styles.detalheGrid}>
            <div className={styles.detalheField}><label>Status</label><span><BadgeStatus status={detalhe.status} /></span></div>
            <div className={styles.detalheField}><label>Escopo</label><span>{detalhe.tipo_inventario === 'geral' ? 'Geral' : detalhe.tipo_inventario === 'mp' ? 'Matéria-Prima' : 'Produto Acabado'}</span></div>
            <div className={styles.detalheField}><label>Responsável</label><span>{detalhe.responsavel}</span></div>
            {totalItens > 0 && <>
              <div className={styles.detalheField}><label>Total de itens</label><span>{totalItens}</span></div>
              <div className={styles.detalheField}><label>Contados</label><span>{contados}/{totalItens}</span></div>
              <div className={styles.detalheField}><label>Com divergência</label><span style={{ color: comDiff > 0 ? '#d97706' : 'inherit', fontWeight: comDiff > 0 ? 700 : 400 }}>{comDiff}</span></div>
            </>}
          </div>

          {/* Ações de status */}
          {podeIniciar && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className={styles.btnPrimary} onClick={iniciarContagem} disabled={salvando}>
                {salvando ? 'Carregando itens…' : '▶ Iniciar Contagem'}
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                Cria snapshot dos saldos atuais e abre a planilha de contagem.
              </span>
            </div>
          )}

          {msg && <div className={`${styles.formMsg} ${msg.tipo === 'ok' ? styles.formMsgOk : styles.formMsgErro}`}>{msg.texto}</div>}

          {/* Planilha de contagem */}
          {invItens.length > 0 && (
            <div className={styles.historicoSection}>
              <div className={styles.historicoTitulo}>
                Planilha de Contagem
                {podeContar && <span style={{ fontWeight: 400, fontSize: '0.8rem', marginLeft: 8, color: 'var(--color-text-light)' }}>— preencha o saldo contado fisicamente</span>}
              </div>
              <div className={styles.card}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Un</th>
                      <th>Saldo Sistema</th>
                      <th>Saldo Contado</th>
                      <th>Diferença</th>
                      <th>Ajustado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invItens.map((it, idx) => {
                      const dif = it.diferenca
                      const difCls = dif === null ? '' : dif > 0 ? styles.difPositiva : dif < 0 ? styles.difNegativa : styles.difZero
                      return (
                        <tr key={it.item_id} style={{ cursor: 'default' }}>
                          <td><span className={styles.nome}>{it.item_nome}</span></td>
                          <td>{it.item_unidade}</td>
                          <td style={{ fontWeight: 600 }}>{it.saldo_sistema}</td>
                          <td>
                            {podeContar ? (
                              <input
                                className={styles.contaInput}
                                type="number"
                                min="0"
                                step="0.001"
                                value={it.saldo_contado ?? ''}
                                onChange={e => updateSaldoContado(idx, e.target.value)}
                                placeholder="—"
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{it.saldo_contado ?? '—'}</span>
                            )}
                          </td>
                          <td>
                            {dif !== null ? (
                              <span className={difCls}>{dif > 0 ? `+${dif}` : dif}</span>
                            ) : '—'}
                          </td>
                          <td>
                            {it.ajustado ? <span className={styles.ajustadoBadge}>✓ Ajustado</span> : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {podeContar && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className={styles.btnSecondary} onClick={salvarContagem} disabled={salvando}>
                    {salvando ? 'Salvando…' : '💾 Salvar contagem'}
                  </button>
                  {podeFinalizar && (
                    <button className={styles.btnPrimary} onClick={finalizarInventario} disabled={salvando}>
                      {salvando ? 'Finalizando…' : '✅ Finalizar e gerar ajustes'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!podeIniciar && invItens.length === 0 && (
            <div className={styles.vazio} style={{ padding: '24px' }}>
              {isFinalizado ? 'Inventário finalizado.' : 'Nenhum item carregado ainda.'}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
