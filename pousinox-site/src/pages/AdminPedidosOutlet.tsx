import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin, supabase } from '../lib/supabase'
import styles from './AdminCompras.module.css'

interface Pedido {
  id: number; codigo: string; status: string
  cliente_nome: string; cliente_email: string; cliente_telefone: string
  cliente_cpf_cnpj: string | null
  cliente_cep: string; cliente_endereco: string; cliente_numero: string | null
  cliente_complemento: string | null; cliente_bairro: string
  cliente_cidade: string; cliente_uf: string
  frete_servico: string; frete_preco: number; frete_prazo_texto: string | null
  subtotal: number; total: number
  forma_pagamento: string; data_pagamento: string | null
  comprovante_url: string | null
  codigo_rastreio: string | null; transportadora: string | null
  obs_cliente: string | null; obs_interna: string | null
  criado_em: string; atualizado_em: string
}

interface PedidoItem {
  titulo: string; quantidade: number; preco_unitario: number; subtotal: number
}

type Vista = 'lista' | 'detalhe'

const STATUS_LABELS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando Pgto',
  pago: 'Pago',
  preparando: 'Preparando',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const STATUS_CLASSES: Record<string, string> = {
  aguardando_pagamento: 'badgePendente',
  pago: 'badgeAprovada',
  preparando: 'badgeEnviada',
  enviado: 'badgeAtendida',
  entregue: 'badgeConfirmado',
  cancelado: 'badgeCancelado',
}

const NEXT_STATUS: Record<string, string> = {
  aguardando_pagamento: 'pago',
  pago: 'preparando',
  preparando: 'enviado',
  enviado: 'entregue',
}

const NEXT_LABELS: Record<string, string> = {
  aguardando_pagamento: 'Confirmar Pagamento',
  pago: 'Marcar Preparando',
  preparando: 'Marcar Enviado',
  enviado: 'Marcar Entregue',
}

function AdminPedidosOutlet() {
  const [vista, setVista] = useState<Vista>('lista')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [sel, setSel] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [rastreio, setRastreio] = useState('')
  const [transp, setTransp] = useState('')
  const [obsInterna, setObsInterna] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    let q = supabaseAdmin.from('pedidos_outlet').select('*').order('criado_em', { ascending: false })
    if (filtroStatus) q = q.eq('status', filtroStatus)
    const { data } = await q
    if (data) setPedidos(data)
  }, [filtroStatus])

  useEffect(() => { carregar() }, [carregar])

  const abrirDetalhe = async (p: Pedido) => {
    setSel(p)
    setRastreio(p.codigo_rastreio ?? '')
    setTransp(p.transportadora ?? '')
    setObsInterna(p.obs_interna ?? '')
    const { data } = await supabaseAdmin.from('pedidos_outlet_itens').select('titulo, quantidade, preco_unitario, subtotal').eq('pedido_id', p.id)
    if (data) setItens(data)
    setVista('detalhe')
  }

  const avancarStatus = async () => {
    if (!sel) return
    const novoStatus = NEXT_STATUS[sel.status]
    if (!novoStatus) return
    setSalvando(true)
    const update: Record<string, unknown> = { status: novoStatus }
    if (novoStatus === 'pago') update.data_pagamento = new Date().toISOString()
    if (novoStatus === 'enviado' && rastreio.trim()) {
      update.codigo_rastreio = rastreio.trim()
      update.transportadora = transp.trim() || null
    }
    await supabaseAdmin.from('pedidos_outlet').update(update).eq('id', sel.id)

    // Notificar
    try {
      await supabase.functions.invoke('notificar-pedido', {
        body: { pedido_id: sel.id, evento: novoStatus },
      })
    } catch { /* não bloqueia */ }

    setSalvando(false)
    carregar()
    const { data } = await supabaseAdmin.from('pedidos_outlet').select('*').eq('id', sel.id).single()
    if (data) { setSel(data); setRastreio(data.codigo_rastreio ?? ''); setTransp(data.transportadora ?? '') }
  }

  const cancelar = async () => {
    if (!sel || !confirm('Cancelar este pedido?')) return
    await supabaseAdmin.from('pedidos_outlet').update({ status: 'cancelado' }).eq('id', sel.id)
    carregar()
    const { data } = await supabaseAdmin.from('pedidos_outlet').select('*').eq('id', sel.id).single()
    if (data) setSel(data)
  }

  const salvarObs = async () => {
    if (!sel) return
    await supabaseAdmin.from('pedidos_outlet').update({ obs_interna: obsInterna.trim() || null }).eq('id', sel.id)
  }

  const whatsappUrl = (p: Pedido, msg: string) => {
    const tel = p.cliente_telefone.replace(/\D/g, '')
    const num = tel.startsWith('55') ? tel : `55${tel}`
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  /* ── LISTA ── */
  if (vista === 'lista') return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Pedidos Outlet</h1>
          <p className={styles.pageSubtitle}>{pedidos.length} pedido(s)</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select className={styles.selectFiltro} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className={styles.card}>
        {pedidos.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nenhum pedido encontrado</p>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Cidade</th>
                <th>Total</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(p => (
                <tr key={p.id} onClick={() => abrirDetalhe(p)}>
                  <td className={styles.numero}>{p.codigo}</td>
                  <td className={styles.tituloCell}>{p.cliente_nome}</td>
                  <td>{p.cliente_cidade}/{p.cliente_uf}</td>
                  <td style={{ fontWeight: 600 }}>R$ {fmtBRL(p.total)}</td>
                  <td><span className={styles[STATUS_CLASSES[p.status] ?? 'badgePendente']}>{STATUS_LABELS[p.status]}</span></td>
                  <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{fmtData(p.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  /* ── DETALHE ── */
  if (!sel) return null
  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{sel.codigo}</h1>
          <p className={styles.pageSubtitle}>{STATUS_LABELS[sel.status]} — {fmtData(sel.criado_em)}</p>
        </div>
        <button className={styles.btnSecondary} onClick={() => { setVista('lista'); setSel(null) }}>← Voltar</button>
      </div>

      {/* Status + Ações */}
      <div className={styles.detalheCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={styles[STATUS_CLASSES[sel.status] ?? 'badgePendente']} style={{ fontSize: '0.88rem', padding: '6px 16px' }}>
            {STATUS_LABELS[sel.status]}
          </span>
          {NEXT_STATUS[sel.status] && (
            <button className={styles.btnPrimary} onClick={avancarStatus} disabled={salvando}>
              {salvando ? 'Salvando...' : NEXT_LABELS[sel.status]}
            </button>
          )}
          {sel.status !== 'cancelado' && sel.status !== 'entregue' && (
            <button className={styles.btnDanger} onClick={cancelar}>Cancelar</button>
          )}
        </div>

        {/* Rastreio (se preparando ou enviado) */}
        {(sel.status === 'preparando' || sel.status === 'enviado') && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Código rastreio</label>
              <input className={styles.formInput} value={rastreio} onChange={e => setRastreio(e.target.value)} placeholder="AA123456789BR" />
            </div>
            <div className={styles.formGroup} style={{ width: 160 }}>
              <label className={styles.formLabel}>Transportadora</label>
              <input className={styles.formInput} value={transp} onChange={e => setTransp(e.target.value)} placeholder="Correios" />
            </div>
          </div>
        )}

        {/* WhatsApp */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={whatsappUrl(sel, `Olá ${sel.cliente_nome}! Seu pedido ${sel.codigo} foi recebido. Valor: R$ ${fmtBRL(sel.total)}. Aguardamos seu pagamento via Pix.`)}
            target="_blank" rel="noopener noreferrer" className={styles.btnSecondary}>WhatsApp: Confirmar recebimento</a>
          {sel.status === 'pago' && (
            <a href={whatsappUrl(sel, `Olá ${sel.cliente_nome}! Pagamento do pedido ${sel.codigo} confirmado! Estamos preparando o envio.`)}
              target="_blank" rel="noopener noreferrer" className={styles.btnSecondary}>WhatsApp: Pgto confirmado</a>
          )}
          {sel.codigo_rastreio && (
            <a href={whatsappUrl(sel, `Olá ${sel.cliente_nome}! Seu pedido ${sel.codigo} foi enviado! Rastreie aqui: https://www.linkcorreios.com.br/?id=${sel.codigo_rastreio}`)}
              target="_blank" rel="noopener noreferrer" className={styles.btnSecondary}>WhatsApp: Enviado + rastreio</a>
          )}
        </div>
      </div>

      {/* Cliente */}
      <div className={styles.detalheCard}>
        <h3 className={styles.formTitle}>Cliente</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}><label className={styles.formLabel}>Nome</label><div>{sel.cliente_nome}</div></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Email</label><div>{sel.cliente_email}</div></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Telefone</label><div>{sel.cliente_telefone}</div></div>
          {sel.cliente_cpf_cnpj && <div className={styles.formGroup}><label className={styles.formLabel}>CPF/CNPJ</label><div>{sel.cliente_cpf_cnpj}</div></div>}
        </div>
        <h3 className={styles.formTitle}>Endereço</h3>
        <div>{sel.cliente_endereco}{sel.cliente_numero ? `, ${sel.cliente_numero}` : ''}{sel.cliente_complemento ? ` — ${sel.cliente_complemento}` : ''}</div>
        <div>{sel.cliente_bairro} — {sel.cliente_cidade}/{sel.cliente_uf} — CEP {sel.cliente_cep}</div>
      </div>

      {/* Itens + Resumo */}
      <div className={styles.detalheCard}>
        <h3 className={styles.formTitle}>Itens</h3>
        {itens.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span>{it.titulo} ({it.quantidade}×)</span>
            <span style={{ fontWeight: 600 }}>R$ {fmtBRL(it.subtotal)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span>Frete ({sel.frete_servico})</span>
          <span>{sel.frete_preco === 0 ? 'Grátis' : `R$ ${fmtBRL(sel.frete_preco)}`}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #1a3a5c', fontWeight: 700, fontSize: '1.05rem', color: '#1a3a5c' }}>
          <span>Total</span>
          <span>R$ {fmtBRL(sel.total)}</span>
        </div>
      </div>

      {/* Obs interna */}
      <div className={styles.detalheCard}>
        <h3 className={styles.formTitle}>Observações internas</h3>
        <textarea className={styles.formTextarea} value={obsInterna} onChange={e => setObsInterna(e.target.value)}
          placeholder="Notas internas sobre o pedido..." style={{ minHeight: 60 }} />
        <div className={styles.formActions}>
          <button className={styles.btnSecondary} onClick={salvarObs}>Salvar obs</button>
        </div>
        {sel.obs_cliente && (
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: '0.85rem' }}>
            <strong>Obs do cliente:</strong> {sel.obs_cliente}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPedidosOutlet
