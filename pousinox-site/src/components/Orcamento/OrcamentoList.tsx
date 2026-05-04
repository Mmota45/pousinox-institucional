import { useState } from 'react'
import type { OrcamentoResumo, Status } from './types'
import { STATUS_CFG, fmtBRL, fmtDataISO } from './types'

interface Props {
  lista: OrcamentoResumo[]
  loading: boolean
  editandoId: number | null
  filtroStatus: Status | 'todos'
  setFiltroStatus: (s: Status | 'todos') => void
  ocultarValores: boolean
  isAdminUser: boolean
  onSelecionar: (id: number) => void
  onEditar: (id: number) => void
  onNovo: () => void
  onExcluir: (id: number) => void
  onExportCsv: () => void
  styles: Record<string, string>
}

export default function OrcamentoList({
  lista, loading, editandoId, filtroStatus, setFiltroStatus,
  ocultarValores, isAdminUser,
  onSelecionar, onEditar, onNovo, onExcluir, onExportCsv, styles: s,
}: Props) {
  const [busca, setBusca] = useState('')

  const filtrada = busca.trim()
    ? lista.filter(o => {
        const q = busca.toLowerCase()
        return (
          o.numero?.toLowerCase().includes(q) ||
          o.cliente_empresa?.toLowerCase().includes(q) ||
          o.cliente_nome?.toLowerCase().includes(q) ||
          o.empresa_nome?.toLowerCase().includes(q)
        )
      })
    : lista

  return (
    <>
      {/* Header */}
      <div className={s.panelHeader}>
        <span className={s.panelTitle}>Orçamentos</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {lista.length > 0 && (
            <button className={s.btnMini} onClick={onExportCsv} style={{ fontSize: '0.74rem', padding: '4px 8px' }} title="Exportar CSV">📥</button>
          )}
          <button className={s.btnNovo} onClick={onNovo} style={{ padding: '5px 12px', fontSize: '0.76rem' }}>+ Novo</button>
        </div>
      </div>

      {/* Search */}
      <div className={s.listSearch}>
        <input
          className={s.listSearchInput}
          placeholder="Buscar número, cliente..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Filtros */}
      <div style={{ padding: '6px 10px', display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
        {(['todos', 'rascunho', 'enviado', 'aprovado', 'recusado', 'cancelado'] as const).map(st => (
          <button
            key={st}
            className={`${s.filtroBtn} ${filtroStatus === st ? s.filtroBtnAtivo : ''}`}
            onClick={() => setFiltroStatus(st)}
            style={{ padding: '4px 8px', fontSize: '0.7rem', minHeight: 26 }}
          >
            {st === 'todos' ? 'Todos' : STATUS_CFG[st as Status].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className={s.listScroll}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>Carregando...</div>
        ) : filtrada.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>Nenhum orçamento.</div>
        ) : (
          filtrada.map(o => {
            const cfg = STATUS_CFG[o.status as Status]
            return (
              <div
                key={o.id}
                className={`${s.listItem} ${editandoId === o.id ? s.listItemActive : ''}`}
                onClick={() => onSelecionar(o.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={s.listItemNum}>{o.numero}</span>
                  <span className={s.statusBadge} style={{ background: cfg?.cor + '22', color: cfg?.cor, fontSize: '0.66rem', padding: '2px 8px' }}>
                    {cfg?.label}
                  </span>
                </div>
                <div className={s.listItemCliente}>{o.cliente_empresa || o.cliente_nome || '—'}</div>
                <div className={s.listItemMeta}>
                  <span className={s.listItemTotal}>{ocultarValores ? '••••' : fmtBRL(Number(o.total))}</span>
                  <span className={s.listItemData}>{fmtDataISO(o.criado_em)}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                  <button className={s.btnMini} onClick={() => onEditar(o.id)} title="Editar" style={{ fontSize: '0.78rem', padding: '4px 8px' }}>✏️</button>
                  {isAdminUser && (
                    <button
                      className={`${s.btnMini} ${s.btnMiniDanger}`}
                      title="Excluir"
                      style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                      onClick={() => { if (window.confirm(`Excluir orçamento ${o.numero}?`)) onExcluir(o.id) }}
                    >🗑</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
