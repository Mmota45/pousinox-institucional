import type { Status, Instalacao } from '../types'
import { fmtBRL, STATUS_CFG } from '../types'
import type { FreteSummary } from '../../../types/frete'

interface Props {
  numero: string
  status: Status
  empresaNome: string | null
  clienteNome: string
  subtotal: number
  valorDesc: number
  tipoDesc: string
  frete: FreteSummary
  instalacao: Instalacao
  total: number
  ocultarValores: boolean
  salvando: boolean
  onSalvar: (novoStatus?: Status) => void
  onImprimir: () => void
  onCanva?: () => void
  gerandoCanva?: boolean
  // Status actions
  finLancId: number | null
  gerandoRec: boolean
  onGerarReceivel: () => void
  // Etiqueta
  etiquetaPreId: string | null
  gerandoEtiq: boolean
  baixandoRotulo: boolean
  baixandoDace: boolean
  cancelandoEtiq: boolean
  onGerarEtiqueta: () => void
  onBaixarRotulo: () => void
  onBaixarDace: () => void
  onCancelarEtiqueta: () => void
  // Excluir
  editandoId: number | null
  isAdminUser: boolean
  confirmExcluir: boolean
  setConfirmExcluir: (v: boolean) => void
  onExcluir: (id: number) => void
  styles: Record<string, string>
}

export default function ResumoSidebar({
  numero, status, empresaNome, clienteNome,
  subtotal, valorDesc, tipoDesc, frete, instalacao, total,
  ocultarValores, salvando, onSalvar, onImprimir, onCanva, gerandoCanva,
  finLancId, gerandoRec, onGerarReceivel,
  etiquetaPreId, gerandoEtiq, baixandoRotulo, baixandoDace, cancelandoEtiq,
  onGerarEtiqueta, onBaixarRotulo, onBaixarDace, onCancelarEtiqueta,
  editandoId, isAdminUser, confirmExcluir, setConfirmExcluir, onExcluir,
  styles,
}: Props) {
  const fmt = (v: number) => ocultarValores ? '••••' : fmtBRL(v)
  const cfg = STATUS_CFG[status]

  const valorFrete = frete.modalidade === 'bonus' || frete.tipo === 'FOB' ? 0 : frete.valor
  const valorInst = instalacao.inclui && instalacao.modalidade === 'cobrar' ? (parseFloat(instalacao.valor.replace(',', '.')) || 0) : 0

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarCard}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarNumero}>{numero || 'Novo'}</span>
          <span className={styles.statusBadge} style={{ background: cfg.cor + '22', color: cfg.cor }}>{cfg.label}</span>
        </div>

        {empresaNome && (
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarLabel}>Empresa</span>
            <span className={styles.sidebarValue}>{empresaNome}</span>
          </div>
        )}

        {clienteNome && (
          <div className={styles.sidebarMeta}>
            <span className={styles.sidebarLabel}>Cliente</span>
            <span className={styles.sidebarValue}>{clienteNome}</span>
          </div>
        )}

        <div className={styles.sidebarDivider} />

        <div className={styles.sidebarLine}>
          <span>Subtotal</span>
          <span>{fmt(subtotal)}</span>
        </div>

        {valorDesc > 0 && (
          <div className={styles.sidebarLine}>
            <span>Desconto {tipoDesc === '%' ? `(${tipoDesc})` : ''}</span>
            <span style={{ color: '#dc2626' }}>−{fmt(valorDesc)}</span>
          </div>
        )}

        {valorFrete > 0 && (
          <div className={styles.sidebarLine}>
            <span>Frete {frete.servico ? `(${frete.servico})` : ''}</span>
            <span>{fmt(valorFrete)}</span>
          </div>
        )}
        {frete.tipo === 'FOB' && (
          <div className={styles.sidebarLine}>
            <span>Frete</span>
            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>FOB</span>
          </div>
        )}

        {valorInst > 0 && (
          <div className={styles.sidebarLine}>
            <span>Instalação</span>
            <span>{fmt(valorInst)}</span>
          </div>
        )}
        {instalacao.inclui && instalacao.modalidade === 'bonus' && (
          <div className={styles.sidebarLine}>
            <span>Instalação</span>
            <span style={{ color: '#16a34a', fontSize: '0.78rem' }}>Bonificada</span>
          </div>
        )}

        <div className={styles.sidebarDivider} />

        <div className={styles.sidebarTotal}>
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>

        {/* Ações principais */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
          <button className={styles.btnPrimary} onClick={() => onSalvar()} disabled={salvando} style={{ width: '100%' }}>
            {salvando ? 'Salvando...' : '💾 Salvar'}
          </button>
          <button className={styles.btnImprimir} onClick={onImprimir} style={{ minWidth: 60 }}>
            🖨️ PDF
          </button>
          {onCanva && (
            <button
              className={styles.btnImprimir}
              onClick={onCanva}
              disabled={gerandoCanva}
              style={{ minWidth: 60, background: '#7c3aed', color: '#fff', border: 'none' }}
              title="Gerar proposta visual no Canva"
            >
              {gerandoCanva ? '⏳' : '🎨'}
            </button>
          )}
        </div>

        {/* Ações de status */}
        <div className={styles.sidebarDivider} />
        <div className={styles.sidebarActions}>
          {status === 'rascunho' && (
            <button className={styles.btnEnviar} onClick={() => onSalvar('enviado')} disabled={salvando} style={{ width: '100%' }}>
              📤 Marcar Enviado
            </button>
          )}
          {status === 'enviado' && <>
            <button className={styles.btnAprovar} onClick={() => onSalvar('aprovado')} disabled={salvando} style={{ width: '100%' }}>
              ✅ Aprovado
            </button>
            <button className={styles.btnRecusar} onClick={() => onSalvar('recusado')} disabled={salvando} style={{ width: '100%' }}>
              ❌ Recusado
            </button>
          </>}

          {status === 'aprovado' && !finLancId && (
            <button className={styles.btnReceivel} onClick={onGerarReceivel} disabled={gerandoRec} style={{ width: '100%' }}>
              {gerandoRec ? '...' : '💰 Gerar Recebível'}
            </button>
          )}
          {status === 'aprovado' && finLancId && (
            <span className={styles.receivelOk} style={{ textAlign: 'center', display: 'block' }}>✓ Recebível #{finLancId}</span>
          )}

          {status === 'aprovado' && !etiquetaPreId && (
            <button className={styles.btnEnviar} onClick={onGerarEtiqueta} disabled={gerandoEtiq} style={{ width: '100%' }}>
              {gerandoEtiq ? '⏳ Gerando...' : '📦 Etiqueta Correios'}
            </button>
          )}
          {etiquetaPreId && <>
            <button className={styles.btnAprovar} onClick={onBaixarRotulo} disabled={baixandoRotulo} style={{ width: '100%' }}>
              {baixandoRotulo ? '⏳ Processando...' : '🏷 Baixar Rótulo'}
            </button>
            <button className={styles.btnImprimir} onClick={onBaixarDace} disabled={baixandoDace} style={{ width: '100%' }}>
              {baixandoDace ? '⏳ Gerando...' : '📄 DACE'}
            </button>
            <button className={styles.btnRecusar} onClick={onCancelarEtiqueta} disabled={cancelandoEtiq} style={{ width: '100%', fontSize: '0.78rem' }}>
              {cancelandoEtiq ? '⏳...' : '✕ Cancelar Envio'}
            </button>
          </>}
        </div>

        {/* Excluir */}
        {isAdminUser && editandoId && <>
          <div className={styles.sidebarDivider} />
          {confirmExcluir ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#dc2626', textAlign: 'center' }}>Confirmar exclusão?</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                  onClick={() => onExcluir(editandoId)}>Sim</button>
                <button style={{ flex: 1, background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem' }}
                  onClick={() => setConfirmExcluir(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button style={{ width: '100%', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem' }}
              onClick={() => setConfirmExcluir(true)}>🗑 Excluir orçamento</button>
          )}
        </>}
      </div>
    </div>
  )
}
