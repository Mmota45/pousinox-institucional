import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { gerarPixQRCodeDataUrl, gerarPixPayload } from '../lib/pix'
import logoIcon from '../assets/logo-icon.png'
import styles from './PedidoStatus.module.css'

interface Pedido {
  id: number
  codigo: string
  status: string
  cliente_nome: string
  cliente_email: string
  cliente_telefone: string
  cliente_cidade: string
  cliente_uf: string
  frete_servico: string
  frete_preco: number
  frete_prazo_texto: string | null
  subtotal: number
  total: number
  codigo_rastreio: string | null
  transportadora: string | null
  criado_em: string
  data_pagamento: string | null
}

interface PedidoItem {
  titulo: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

interface DadoBancario {
  pix_chave: string
  pix_tipo: string
  titular: string
  banco: string
}

const IconClock = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IconCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconBox = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
const IconTruck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
const IconFlag = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
const IconShield = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>

const STATUS_FLOW = [
  { key: 'aguardando_pagamento', label: 'Aguardando pagamento', icon: <IconClock /> },
  { key: 'pago', label: 'Pago', icon: <IconCheck /> },
  { key: 'preparando', label: 'Preparando', icon: <IconBox /> },
  { key: 'enviado', label: 'Enviado', icon: <IconTruck /> },
  { key: 'entregue', label: 'Entregue', icon: <IconFlag /> },
]

function PedidoStatus() {
  const { codigo } = useParams<{ codigo: string }>()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [dadosBancarios, setDadosBancarios] = useState<DadoBancario[]>([])
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [pixPayloadStr, setPixPayloadStr] = useState('')

  useEffect(() => {
    if (!codigo) return
    const load = async () => {
      const { data: p } = await supabase.from('pedidos_outlet').select('*').eq('codigo', codigo).single()
      if (p) {
        setPedido(p)
        const { data: it } = await supabase.from('pedidos_outlet_itens').select('titulo, quantidade, preco_unitario, subtotal').eq('pedido_id', p.id)
        if (it) setItens(it)
      }
      const { data: db } = await supabase.from('dados_bancarios').select('pix_chave, pix_tipo, titular, banco').eq('ativo', true).order('ordem').limit(1)
      if (db) setDadosBancarios(db)
      setLoading(false)
    }
    load()
  }, [codigo])

  useEffect(() => {
    if (!pedido || pedido.status !== 'aguardando_pagamento' || dadosBancarios.length === 0) return
    const db = dadosBancarios[0]
    const opts = { chave: db.pix_chave, nome: db.titular || 'Pousinox', cidade: 'Pouso Alegre', valor: pedido.total }
    setPixPayloadStr(gerarPixPayload(opts))
    gerarPixQRCodeDataUrl(opts).then(setQrDataUrl)
  }, [pedido, dadosBancarios])

  if (loading) return <div className={styles.wrap}><p>Carregando...</p></div>
  if (!pedido) return <div className={styles.wrap}><p>Pedido não encontrado.</p><Link to="/pronta-entrega" className={styles.voltar}>← Voltar</Link></div>

  const statusIdx = STATUS_FLOW.findIndex(s => s.key === pedido.status)
  const cancelado = pedido.status === 'cancelado'
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const copiarPix = (texto: string) => {
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className={styles.wrap} style={{ '--wm-url': `url(${logoIcon})` } as React.CSSProperties}>
      <Link to="/pronta-entrega" className={styles.voltar}>← Voltar ao Outlet</Link>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.titulo}>Acompanhe seu pedido</h1>
        <div className={styles.subtituloRow}>
          <span className={styles.codigoBadge}>#{pedido.codigo}</span>
          <span className={styles.dataText}>{fmtData(pedido.criado_em)}</span>
        </div>
      </div>

      {/* Timeline horizontal */}
      {!cancelado && (
        <div className={styles.card}>
          <div className={styles.timeline}>
            {STATUS_FLOW.map((s, i) => {
              const ativo = i <= statusIdx
              const atual = i === statusIdx
              return (
                <div key={s.key} className={`${styles.timelineStep} ${ativo ? styles.timelineStepAtivo : ''}`}>
                  <div className={`${styles.timelineDot} ${ativo ? styles.timelineDotAtivo : ''} ${atual ? styles.timelineDotAtual : ''}`}>
                    {s.icon}
                  </div>
                  <div className={styles.timelineLabel}>{s.label}</div>
                  {atual && <div className={styles.timelineSub}>Atual</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {cancelado && (
        <div className={styles.cancelado}>
          <div className={styles.canceladoIcon}>✕</div>
          <p className={styles.canceladoText}>Este pedido foi cancelado</p>
        </div>
      )}

      {/* Pix — aguardando pagamento */}
      {pedido.status === 'aguardando_pagamento' && dadosBancarios.length > 0 && (
        <div className={styles.pixBox}>
          <div className={styles.pixHeader}>
            <span className={styles.pixIconShield}><IconShield /></span>
            <p className={styles.pixAviso}>Pague via Pix para confirmar seu pedido</p>
          </div>

          <div className={styles.pixValor}>R$ {fmtBRL(pedido.total)}</div>

          {qrDataUrl && (
            <div className={styles.pixQr}>
              <img src={qrDataUrl} alt="QR Code Pix" width={240} height={240} />
            </div>
          )}

          {pixPayloadStr && (
            <>
              <p className={styles.pixDica}>Ou copie o código Pix Copia e Cola:</p>
              <div className={styles.pixCopiaCola}>
                <span>{pixPayloadStr}</span>
                <button
                  className={`${styles.pixCopiar} ${copiado ? styles.pixCopiado : ''}`}
                  onClick={() => copiarPix(pixPayloadStr)}
                >
                  {copiado ? '✓ Copiado!' : 'Copiar'}
                </button>
              </div>
            </>
          )}

          {dadosBancarios.map((db, i) => (
            <div key={i} className={styles.pixDadosBanco}>
              <strong>{db.titular}</strong> · {db.banco}<br />
              Chave {db.pix_tipo}: {db.pix_chave}
            </div>
          ))}

          <div className={styles.pixSeguranca}>
            <IconShield />
            <span>Pagamento seguro · Pousinox · CNPJ verificado</span>
          </div>
        </div>
      )}

      {/* Rastreio */}
      {pedido.codigo_rastreio && (
        <div className={styles.rastreio}>
          <div className={styles.rastreioInfo}>
            <span className={styles.rastreioLabel}>Código de rastreio</span>
            <span className={styles.rastreioCodigo}>{pedido.codigo_rastreio}</span>
            {pedido.transportadora && <span className={styles.rastreioTransp}>{pedido.transportadora}</span>}
          </div>
          <a href={`https://www.linkcorreios.com.br/?id=${pedido.codigo_rastreio}`}
            target="_blank" rel="noopener noreferrer" className={styles.rastreioLink}>
            Rastrear
          </a>
        </div>
      )}

      {/* Itens + Resumo */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Resumo do pedido</h2>
        {itens.map((it, i) => (
          <div key={i} className={styles.resumoLinha}>
            <span>{it.titulo} ({it.quantidade}×)</span>
            <span>R$ {fmtBRL(it.subtotal)}</span>
          </div>
        ))}
        <div className={styles.resumoLinha}>
          <span>Frete ({pedido.frete_servico})</span>
          <span>{pedido.frete_preco === 0 ? 'Grátis' : `R$ ${fmtBRL(pedido.frete_preco)}`}</span>
        </div>
        <div className={`${styles.resumoLinha} ${styles.resumoTotal}`}>
          <span>Total</span>
          <span>R$ {fmtBRL(pedido.total)}</span>
        </div>
      </div>

      {/* Dados da entrega */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Dados da entrega</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Nome</span>
            <span className={styles.infoValue}>{pedido.cliente_nome}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Destino</span>
            <span className={styles.infoValue}>{pedido.cliente_cidade}/{pedido.cliente_uf}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Prazo estimado</span>
            <span className={styles.infoValue}>{pedido.frete_prazo_texto ?? '-'}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footerNote}>
        Dúvidas? Entre em contato pelo{' '}
        <a href={`https://wa.me/5535999709878?text=Olá! Gostaria de informações sobre o pedido ${pedido.codigo}`}
          target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  )
}

export default PedidoStatus
